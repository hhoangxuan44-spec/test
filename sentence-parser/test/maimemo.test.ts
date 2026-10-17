import { describe, expect, it } from 'vitest';
import { MaiMemoClient, MaiMemoError, RateLimiter, notepadWords, type Notepad } from '../server/maimemo';
import { pickWords } from '../shared/pick';
import type { PracticeWord } from '../shared/types';

interface Call {
  method: string;
  url: string;
  auth: string | null;
  body: unknown;
}

function fakeFetch(respond: (call: Call) => { status?: number; json?: unknown; text?: string }) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call: Call = {
      method: init?.method ?? 'GET',
      url: String(input),
      auth: headers.get('Authorization'),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const r = respond(call);
    const text = r.text ?? (r.json === undefined ? '' : JSON.stringify(r.json));
    return new Response(text, { status: r.status ?? 200 });
  }) as typeof fetch;
  return { impl, calls };
}

const ok = (data: unknown) => ({ json: { success: true, data, errors: [] } });

function client(respond: Parameters<typeof fakeFetch>[0]) {
  const fake = fakeFetch(respond);
  const c = new MaiMemoClient({ token: 'tok-123', baseUrl: 'https://mm.test/open/api/v1/', fetch: fake.impl, limiter: new RateLimiter(1000, 1000) });
  return { c, calls: fake.calls };
}

describe('MaiMemoClient', () => {
  it('fetches today items with the documented request body', async () => {
    const { c, calls } = client(() =>
      ok({ today_items: [{ voc_id: 'v1', voc_spelling: 'abandon', order: 1, is_new: true, is_finished: false, first_response: 'FORGET' }] }),
    );
    const items = await c.getTodayItems();
    expect(items[0].voc_spelling).toBe('abandon');
    expect(calls[0]).toEqual({
      method: 'POST',
      url: 'https://mm.test/open/api/v1/study/get_today_items',
      auth: 'Bearer tok-123',
      body: { voc_ids: [], spellings: [], limit: 1000 },
    });
  });

  it('maps the other study and vocabulary endpoints', async () => {
    const { c, calls } = client((call) => {
      if (call.url.endsWith('/study/get_study_progress')) return ok({ progress: { finished: 3, total: 10, study_time: 60 } });
      if (call.url.endsWith('/study/query_study_records')) return ok({ records: [], count: 0 });
      if (call.url.endsWith('/study/add_words')) return ok({ added_count: 2 });
      if (call.url.endsWith('/study/advance_study')) return ok({ advanced_count: 1 });
      if (call.url.endsWith('/vocabulary/query')) return ok({ voc: [{ id: 'v9', spelling: 'curb' }] });
      if (call.url.endsWith('/phrases')) return ok({ phrase: { id: 'p1', phrase: 'x', interpretation: 'y', tags: [], origin: 'o' } });
      return { status: 404 };
    });
    expect(await c.getStudyProgress()).toEqual({ finished: 3, total: 10, study_time: 60 });
    await c.queryStudyRecords({ spellings: ['curb'] });
    expect(await c.addWords(['v1', 'v2'])).toBe(2);
    expect(await c.advanceStudy(['v1'])).toBe(1);
    expect(await c.queryVocabulary(['curb'])).toEqual([{ id: 'v9', spelling: 'curb' }]);
    expect(await c.queryVocabulary([])).toEqual([]);
    const phrase = await c.createPhrase({ vocId: 'v9', phrase: 'Long sentence.', interpretation: '长句。', origin: '长难句练习' });
    expect(phrase.id).toBe('p1');

    expect(calls.map((x) => [x.method, x.url.replace('https://mm.test/open/api/v1', ''), x.body])).toEqual([
      ['POST', '/study/get_study_progress', {}],
      ['POST', '/study/query_study_records', { voc_ids: [], spellings: ['curb'], as_count: false, limit: 1000 }],
      ['POST', '/study/add_words', { words: [{ id: 'v1' }, { id: 'v2' }], advance: false }],
      ['POST', '/study/advance_study', { voc_ids: ['v1'] }],
      ['POST', '/vocabulary/query', { spellings: ['curb'], ids: [] }],
      [
        'POST',
        '/phrases',
        { phrase: { voc_id: 'v9', phrase: 'Long sentence.', interpretation: '长句。', tags: [], origin: '长难句练习' } },
      ],
    ]);
  });

  it('lists notepads with query params and extracts words', async () => {
    const notepad: Notepad = {
      id: 'n1',
      title: '考研',
      brief: '',
      tags: [],
      content: '',
      list: [
        { type: 'CHAPTER', data: { chapter: 'Unit 1', word: '' } },
        { type: 'WORD', data: { chapter: 'Unit 1', word: 'curb ' } },
        { type: 'WORD', data: { chapter: 'Unit 1', word: 'curb' } },
        { type: 'WORD', data: { chapter: 'Unit 1', word: 'mitigate' } },
      ],
    };
    const { c, calls } = client((call) => (call.url.includes('/notepads/') ? ok({ notepad }) : ok({ notepads: [notepad] })));
    expect((await c.listNotepads(20, 0))[0].id).toBe('n1');
    expect(calls[0].url).toBe('https://mm.test/open/api/v1/notepads?limit=20&offset=0');
    const full = await c.getNotepad('n 1');
    expect(calls[1].url).toBe('https://mm.test/open/api/v1/notepads/n%201');
    expect(notepadWords(full)).toEqual(['curb', 'mitigate']);
  });

  it('turns HTTP and envelope errors into readable messages', async () => {
    const cases: Array<[ReturnType<Parameters<typeof fakeFetch>[0]>, RegExp, number]> = [
      [{ status: 401, json: { errors: [{ code: 'unauthorized', message: 'bad token' }] } }, /Token 无效/, 401],
      [{ status: 429 }, /太频繁/, 429],
      [{ status: 400, json: { errors: [{ code: 'invalid', message: 'phrase too long' }] } }, /phrase too long/, 400],
      [{ status: 500, text: 'oops' }, /HTTP 500/, 502],
      [{ json: { success: false, data: {} } }, /返回失败/, 400],
      [{ json: { errors: [{ message: 'quota' }] } }, /quota/, 400],
      [{ text: 'not json' }, /无法解析/, 502],
    ];
    for (const [response, message, status] of cases) {
      const { c } = client(() => response);
      const err = await c.getStudyProgress().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MaiMemoError);
      expect((err as MaiMemoError).message).toMatch(message);
      expect((err as MaiMemoError).status).toBe(status);
    }
  });

  it('reports network failures', async () => {
    const c = new MaiMemoClient({
      token: 't',
      fetch: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
      limiter: new RateLimiter(1000, 1000),
    });
    await expect(c.getStudyProgress()).rejects.toThrow(/网络连接失败/);
  });
});

describe('RateLimiter', () => {
  it('delays calls beyond the window budget', async () => {
    const limiter = new RateLimiter(2, 80);
    const start = Date.now();
    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(70);
  });
});

describe('pickWords', () => {
  const w = (spelling: string, extra: Partial<PracticeWord> = {}): PracticeWord => ({ spelling, usedCount: 0, ...extra });

  it('prefers unpractised, then forgotten, sticky and new words', () => {
    const words = [
      w('easy', { firstResponse: 'WELL_FAMILIAR' }),
      w('plain'),
      w('fresh', { isNew: true }),
      w('vague', { firstResponse: 'VAGUE' }),
      w('forgot', { firstResponse: 'FORGET' }),
      w('forgot-again', { firstResponse: 'FORGET', usedCount: 1 }),
    ];
    expect(pickWords(words, 3).map((x) => x.spelling)).toEqual(['forgot', 'vague', 'fresh']);
    expect(pickWords(words, 6).map((x) => x.spelling).slice(-2)).toEqual(['easy', 'forgot-again']);
  });
});
