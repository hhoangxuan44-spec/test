import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { request as httpRequest, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { Db } from '../server/db';
import type { LlmProvider, StructuredRequest } from '../server/llm/providers';
import { MaiMemoClient, RateLimiter } from '../server/maimemo';
import { SettingsStore } from '../server/settings';
import { GENERATED } from './fixtures';

interface Ctx {
  base: string;
  server: Server;
  dir: string;
  maimemoCalls: Array<{ path: string; body: unknown }>;
  llmQueue: unknown[];
  llmPrompts: string[];
}

let ctx: Ctx;

function maimemoFetch(calls: Ctx['maimemoCalls']): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname.replace('/open/api/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data, errors: [] }));
    switch (path) {
      case '/study/get_study_progress':
        return ok({ progress: { finished: 5, total: 40, study_time: 600 } });
      case '/study/get_today_items':
        return ok({
          today_items: [
            { voc_id: 'v-mit', voc_spelling: 'mitigate', order: 2, is_new: false, is_finished: true, first_response: 'FORGET' },
            { voc_id: 'v-curb', voc_spelling: 'curb', order: 1, is_new: true, is_finished: false },
          ],
        });
      case '/study/query_study_records':
        return ok({
          records: [
            { voc_id: 'v-curb', voc_spelling: 'curb', study_count: 3, tags: ['STICKING'], last_response: 'VAGUE' },
            { voc_id: 'v-x', voc_spelling: 'reckless', study_count: 1, tags: [], last_response: 'FORGET' },
          ],
          count: 2,
        });
      case '/vocabulary/query': {
        const spellings = (body as { spellings: string[] }).spellings;
        return ok({ voc: spellings.filter((s) => s !== 'zzzz').map((s) => ({ id: `id-${s}`, spelling: s })) });
      }
      case '/phrases':
        return ok({ phrase: { id: 'p1', ...(body as { phrase: object }).phrase } });
      case '/study/add_words':
        return ok({ added_count: (body as { words: unknown[] }).words.length });
      case '/study/advance_study':
        return ok({ advanced_count: (body as { voc_ids: unknown[] }).voc_ids.length });
      default:
        return new Response('{}', { status: 404 });
    }
  }) as typeof fetch;
}

async function start(env: NodeJS.ProcessEnv = {}): Promise<Ctx> {
  const dir = await mkdtemp(join(tmpdir(), 'sp-api-'));
  const maimemoCalls: Ctx['maimemoCalls'] = [];
  const llmQueue: unknown[] = [];
  const llmPrompts: string[] = [];
  const provider: LlmProvider = {
    label: 'fake',
    async generate<T>(req: StructuredRequest<T>): Promise<T> {
      llmPrompts.push(req.prompt);
      return req.schema.parse(llmQueue.shift());
    },
  };
  const app = createApp({
    settings: await SettingsStore.open(dir, env),
    db: await Db.open(dir),
    localOnly: true,
    maimemo: (token) => new MaiMemoClient({ token, baseUrl: 'https://mm.test/open/api/v1', fetch: maimemoFetch(maimemoCalls), limiter: new RateLimiter(1000, 1000) }),
    llm: () => provider,
  });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { base: `http://127.0.0.1:${port}`, server, dir, maimemoCalls, llmQueue, llmPrompts };
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(ctx.base + path, {
    method,
    headers: body === undefined && method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

beforeEach(async () => {
  ctx = await start();
});

afterEach(async () => {
  await new Promise((r) => ctx.server.close(r));
  await rm(ctx.dir, { recursive: true, force: true });
});

describe('settings', () => {
  it('masks secrets and keeps them when the masked value comes back', async () => {
    let r = await api('GET', '/api/settings');
    expect(r.json).toMatchObject({ maimemoConfigured: false, llmConfigured: false, llmProvider: 'anthropic', anthropicModel: 'claude-opus-5-5', level: 'kaoyan1' });

    r = await api('PUT', '/api/settings', { maimemoToken: 'mm-secret-1234', anthropicApiKey: 'sk-ant-abcd', level: 'cet6', wordsPerSentence: 3 });
    expect(r.status).toBe(200);
    expect(r.json.maimemoToken).toBe('••••1234');
    expect(r.json.anthropicApiKey).toBe('••••abcd');
    expect(r.json).toMatchObject({ maimemoConfigured: true, llmConfigured: true, level: 'cet6', wordsPerSentence: 3 });

    await api('PUT', '/api/settings', { maimemoToken: '••••1234', level: 'gre' });
    const saved = JSON.parse(await readFile(join(ctx.dir, 'settings.json'), 'utf8'));
    expect(saved.maimemoToken).toBe('mm-secret-1234');
    expect(saved.level).toBe('gre');
    if (process.platform !== 'win32') expect((await stat(join(ctx.dir, 'settings.json'))).mode & 0o777).toBe(0o600);

    await api('PUT', '/api/settings', { maimemoToken: '' });
    expect((await api('GET', '/api/settings')).json.maimemoConfigured).toBe(false);
  });

  it('validates values', async () => {
    expect((await api('PUT', '/api/settings', { level: 'toeic' })).status).toBe(400);
    expect((await api('PUT', '/api/settings', { wordsPerSentence: 5 })).status).toBe(400);
    expect((await api('PUT', '/api/settings', { openaiBaseUrl: 'ftp://x' })).status).toBe(400);
    expect((await api('PUT', '/api/settings', { anthropicEffort: 'turbo' })).status).toBe(400);
  });

  it('treats an Anthropic key in the environment as configured', async () => {
    await new Promise((r) => ctx.server.close(r));
    ctx = await start({ ANTHROPIC_API_KEY: 'sk-env', MAIMEMO_TOKEN: 'env-token' });
    const r = await api('GET', '/api/settings');
    expect(r.json).toMatchObject({ llmConfigured: true, maimemoConfigured: true });
  });
});

describe('request guards', () => {
  it('rejects foreign Host headers, non-JSON writes, bad JSON and unknown routes', async () => {
    const port = new URL(ctx.base).port;
    const status = await new Promise<number>((resolve) => {
      httpRequest({ host: '127.0.0.1', port, path: '/api/settings', headers: { Host: 'evil.example:80' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }).end();
    });
    expect(status).toBe(403);

    const form = await fetch(ctx.base + '/api/maimemo/test', { method: 'POST', body: 'x=1', headers: { 'Content-Type': 'text/plain' } });
    expect(form.status).toBe(415);

    const bad = await fetch(ctx.base + '/api/attempts', { method: 'POST', body: '{oops', headers: { 'Content-Type': 'application/json' } });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain('JSON');

    const missing = await api('GET', '/api/nope');
    expect(missing.status).toBe(404);
  });

  it('explains what to configure first', async () => {
    const words = await api('GET', '/api/maimemo/words');
    expect(words.status).toBe(400);
    expect(words.json.error).toContain('墨墨');
    const gen = await api('POST', '/api/sentences/generate', { words: ['curb'] });
    expect(gen.status).toBe(400);
    expect(gen.json.error).toContain('AI');
  });
});

describe('maimemo integration', () => {
  beforeEach(async () => {
    await api('PUT', '/api/settings', { maimemoToken: 'tok', anthropicApiKey: 'sk-ant-x' });
  });

  it('lists today words in MaiMemo order with sticky flags', async () => {
    const r = await api('GET', '/api/maimemo/words?source=today');
    expect(r.json.progress).toEqual({ finished: 5, total: 40, study_time: 600 });
    expect(r.json.words).toEqual([
      { spelling: 'curb', vocId: 'v-curb', isNew: true, isFinished: false, sticking: true, usedCount: 0 },
      { spelling: 'mitigate', vocId: 'v-mit', isNew: false, isFinished: true, firstResponse: 'FORGET', sticking: false, usedCount: 0 },
    ]);
    const recordsCall = ctx.maimemoCalls.find((c) => c.path === '/study/query_study_records');
    expect(recordsCall?.body).toMatchObject({ voc_ids: ['v-curb', 'v-mit'] });
  });

  it('lists sticky and forgotten words', async () => {
    const r = await api('GET', '/api/maimemo/words?source=sticking');
    expect(r.json.words.map((w: { spelling: string }) => w.spelling)).toEqual(['curb', 'reckless']);
  });

  it('generates, stores and writes a sentence back to MaiMemo', async () => {
    ctx.llmQueue.push(GENERATED);
    const gen = await api('POST', '/api/sentences/generate', { words: [{ spelling: 'curb', vocId: 'v-curb' }, { spelling: 'mitigate' }], level: 'kaoyan2' });
    expect(gen.status).toBe(200);
    const record = gen.json.sentence;
    expect(record).toMatchObject({ source: 'generated', level: 'kaoyan2', origin: 'AI 生成 · 考研英语二' });
    expect(record.analysis.targets.map((t: { vocId?: string }) => t.vocId)).toEqual(['v-curb', undefined]);
    expect(ctx.llmPrompts[0]).toContain('考研英语二');

    const words = await api('GET', '/api/maimemo/words?source=today');
    expect(words.json.words.find((w: { spelling: string }) => w.spelling === 'curb').usedCount).toBe(1);

    const list = await api('GET', '/api/sentences');
    expect(list.json.sentences[0]).toMatchObject({ id: record.id, targets: ['curb', 'mitigate'], attempts: 0, best: null });
    expect(list.json.sentences.filter((s: { source: string }) => s.source === 'builtin').length).toBeGreaterThan(10);

    const write = await api('POST', '/api/maimemo/phrases', { sentenceId: record.id, words: ['curb', 'mitigate', 'reckless'] });
    expect(write.json.results).toEqual([
      { word: 'curb', ok: true },
      { word: 'mitigate', ok: true },
      { word: 'reckless', ok: true },
    ]);
    const phraseCalls = ctx.maimemoCalls.filter((c) => c.path === '/phrases');
    expect(phraseCalls[0].body).toEqual({
      phrase: { voc_id: 'v-curb', phrase: GENERATED.sentence, interpretation: '意译', tags: [], origin: '长难句练习（AI 生成）' },
    });
    expect((phraseCalls[1].body as { phrase: { voc_id: string } }).phrase.voc_id).toBe('id-mitigate');
    expect((await api('GET', `/api/sentences/${record.id}`)).json.phraseWrites).toEqual(['curb', 'mitigate', 'reckless']);

    const foreign = await api('POST', '/api/maimemo/phrases', { sentenceId: record.id, words: ['banana'] });
    expect(foreign.status).toBe(400);

    expect((await api('DELETE', `/api/sentences/${record.id}`)).status).toBe(200);
    expect((await api('GET', `/api/sentences/${record.id}`)).status).toBe(404);
    expect((await api('DELETE', '/api/sentences/builtin-2010-1-t1')).status).toBe(400);
  });

  it('adds, advances and looks up words', async () => {
    const add = await api('POST', '/api/maimemo/add', { words: ['reckless', 'zzzz'] });
    expect(add.json).toEqual({ added: 1, missing: ['zzzz'] });
    const advance = await api('POST', '/api/maimemo/advance', { words: [{ spelling: 'curb', vocId: 'v-curb' }, { spelling: 'mitigate' }] });
    expect(advance.json).toEqual({ advanced: 2, missing: [] });
    expect(ctx.maimemoCalls.find((c) => c.path === '/study/advance_study')?.body).toEqual({ voc_ids: ['v-curb', 'id-mitigate'] });
    const lookup = await api('POST', '/api/maimemo/lookup', { words: ['curb', 'reckless', 'scope'] });
    expect(lookup.json.inPlan).toEqual(['curb', 'reckless']);
    expect((await api('POST', '/api/maimemo/add', { words: ['DROP TABLE;'] })).status).toBe(400);
  });
});

describe('practice records', () => {
  it('stores attempts, computes stats and surfaces weak labels to the generator', async () => {
    await api('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-x' });
    const wrong = { label: 'appositive_clause', result: 'wrong' };
    for (let i = 0; i < 3; i++) {
      const r = await api('POST', '/api/attempts', {
        sentenceId: 'builtin-classic-idea',
        scores: { chunking: 80, skeleton: 100, tagging: 50, translation: null },
        labelResults: [{ label: 'main', result: 'exact' }, wrong],
        wordRatings: [{ word: 'hypothesis', rating: 'vague' }],
      });
      expect(r.json.attempt.overall).toBe(77);
    }
    const stats = await api('GET', '/api/stats');
    expect(stats.json).toMatchObject({ attempts: 3, sentences: 1, average: 77, weakLabels: ['appositive_clause'] });
    expect(stats.json.sections).toEqual({ chunking: 80, skeleton: 100, tagging: 50, translation: null });

    const attempts = await api('GET', '/api/attempts');
    expect(attempts.json.attempts[0].sentence).toContain('The idea that');

    ctx.llmQueue.push(GENERATED);
    const gen = await api('POST', '/api/sentences/generate', { words: ['curb'] });
    expect(gen.json.focus).toEqual(['appositive_clause']);
    expect(ctx.llmPrompts[0]).toContain('同位语从句');

    const bad = await api('POST', '/api/attempts', { sentenceId: 'builtin-classic-idea', scores: { chunking: 150, skeleton: 0, tagging: 0 } });
    expect(bad.status).toBe(400);
  });

  it('grades a translation and analyzes a pasted sentence', async () => {
    await api('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-x' });
    ctx.llmQueue.push({ score: 85, verdict: '不错', issues: [{ type: '词义', detail: 'x' }], improved: '更好' });
    const grade = await api('POST', '/api/grade', { sentenceId: 'builtin-2010-1-t1', translation: '我的翻译' });
    expect(grade.json.grade).toMatchObject({ score: 85, verdict: '不错' });
    expect(ctx.llmPrompts[0]).toContain('我的翻译');

    ctx.llmQueue.push(GENERATED);
    const pasted = await api('POST', '/api/sentences/analyze', { text: GENERATED.sentence, targets: ['curb'] });
    expect(pasted.json.sentence).toMatchObject({ source: 'pasted', origin: '粘贴的句子' });
    expect((await api('POST', '/api/sentences/analyze', { text: '' })).status).toBe(400);
  });
});
