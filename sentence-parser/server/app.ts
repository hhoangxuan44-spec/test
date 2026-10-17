import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { isLabelId } from '../shared/labels';
import { overallScore } from '../shared/scoring';
import {
  EXAM_LEVELS,
  isExamLevel,
  type Analysis,
  type Attempt,
  type AttemptScores,
  type PracticeWord,
  type SentenceRecord,
  type TagResult,
  type WordRating,
} from '../shared/types';
import { BUILTIN_RECORDS } from './builtinSentences';
import type { Db } from './db';
import { HttpError } from './http';
import type { LlmProvider } from './llm/providers';
import { analyzeSentence, generateSentence, gradeTranslation } from './llm/tasks';
import { notepadWords, type MaiMemoClient, type StudyRecord } from './maimemo';
import type { Settings, SettingsStore } from './settings';

export interface AppDeps {
  settings: SettingsStore;
  db: Db;
  maimemo: (token: string) => MaiMemoClient;
  llm: (settings: Settings) => LlmProvider;
  /** Reject non-loopback Host headers (DNS rebinding) when the server only listens locally. */
  localOnly: boolean;
}

type Body = Record<string, unknown>;

const WORD_RE = /^[A-Za-z][A-Za-z' .-]{0,40}$/;
const RATINGS: WordRating[] = ['known', 'vague', 'unknown'];
const TAG_RESULTS: TagResult[] = ['exact', 'partial', 'wrong', 'empty'];

function body(req: Request): Body {
  const b: unknown = req.body;
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Body) : {};
}

function str(value: unknown, name: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `缺少${name}`);
  if (value.length > max) throw new HttpError(400, `${name}太长了`);
  return value.trim();
}

function wordList(value: unknown, max: number): Array<{ spelling: string; vocId?: string }> {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, '请至少选择一个单词');
  if (value.length > max) throw new HttpError(400, `一次最多 ${max} 个单词`);
  return value.map((item) => {
    const raw = typeof item === 'string' ? { spelling: item } : (item as { spelling?: unknown; vocId?: unknown });
    if (typeof raw.spelling !== 'string' || !WORD_RE.test(raw.spelling.trim())) throw new HttpError(400, `单词「${String(raw.spelling)}」格式不对`);
    return { spelling: raw.spelling.trim(), vocId: typeof raw.vocId === 'string' && raw.vocId ? raw.vocId : undefined };
  });
}

function score(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new HttpError(400, `${name}分数不对`);
  return Math.round(value);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostGuard(localOnly: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
    if (!localOnly || LOCAL_HOSTS.has(host)) return next();
    res.status(403).json({ error: '只允许通过 localhost 访问' });
  };
}

/** Browsers can't send cross-site JSON without a CORS preflight, which this server never grants. */
function jsonOnly(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if ((req.headers['content-type'] ?? '').startsWith('application/json')) return next();
  res.status(415).json({ error: '请求需要使用 application/json' });
}

function summary(record: SentenceRecord, attempts: Attempt[]) {
  const mine = attempts.filter((a) => a.sentenceId === record.id);
  return {
    id: record.id,
    source: record.source,
    origin: record.origin,
    level: record.level,
    createdAt: record.createdAt,
    sentence: record.analysis.sentence,
    targets: record.analysis.targets.map((t) => t.word),
    chunkCount: record.analysis.chunks.length,
    attempts: mine.length,
    best: mine.length ? Math.max(...mine.map((a) => a.overall)) : null,
  };
}

function phraseOrigin(record: SentenceRecord): string {
  if (record.source === 'builtin') return record.origin;
  return record.source === 'generated' ? '长难句练习（AI 生成）' : '长难句练习';
}

export function createApp(deps: AppDeps): express.Express {
  const { settings, db } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', hostGuard(deps.localOnly), jsonOnly, express.json({ limit: '256kb' }));

  const maimemo = (): MaiMemoClient => {
    const token = settings.get().maimemoToken;
    if (!token) throw new HttpError(400, '还没有连接墨墨，请先到「设置」里填写墨墨开放 API Token');
    return deps.maimemo(token);
  };
  const llm = (): LlmProvider => {
    if (!settings.llmConfigured()) throw new HttpError(400, '还没有配置 AI 模型，请先到「设置」里填写 API Key');
    return deps.llm(settings.get());
  };
  const findSentence = (id: string): SentenceRecord => {
    const record = BUILTIN_RECORDS.find((s) => s.id === id) ?? db.sentence(id);
    if (!record) throw new HttpError(404, '找不到这个句子');
    return record;
  };
  const resolveVocIds = async (client: MaiMemoClient, words: Array<{ spelling: string; vocId?: string }>) => {
    const unresolved = words.filter((w) => !w.vocId).map((w) => w.spelling);
    const found = new Map((await client.queryVocabulary(unresolved)).map((v) => [v.spelling.toLowerCase(), v.id]));
    return words.map((w) => ({ spelling: w.spelling, vocId: w.vocId ?? found.get(w.spelling.toLowerCase()) }));
  };
  const toPracticeWord = (spelling: string, extra: Partial<PracticeWord> = {}): PracticeWord => ({
    spelling,
    usedCount: db.usage(spelling),
    ...extra,
  });

  app.get('/api/settings', (_req, res) => {
    res.json(settings.toPublic());
  });

  app.put('/api/settings', async (req, res) => {
    await settings.update(body(req));
    res.json(settings.toPublic());
  });

  app.post('/api/maimemo/test', async (_req, res) => {
    res.json({ progress: await maimemo().getStudyProgress() });
  });

  app.get('/api/maimemo/notepads', async (_req, res) => {
    res.json({ notepads: await maimemo().listNotepads(100, 0) });
  });

  app.get('/api/maimemo/words', async (req, res) => {
    const client = maimemo();
    const source = req.query.source;
    if (source === 'notepad') {
      const id = str(req.query.id, '云词本 ID', 200);
      const notepad = await client.getNotepad(id);
      res.json({ title: notepad.title, words: notepadWords(notepad).map((w) => toPracticeWord(w)) });
      return;
    }
    const recordWord = (r: StudyRecord) =>
      toPracticeWord(r.voc_spelling, { vocId: r.voc_id, firstResponse: r.last_response, sticking: r.tags?.includes('STICKING') });
    if (source === 'sticking') {
      const records = await client.queryStudyRecords({ limit: 1000 });
      const words = records.filter((r) => r.tags?.includes('STICKING') || r.last_response === 'FORGET').map(recordWord);
      res.json({ words });
      return;
    }
    const progress = await client.getStudyProgress();
    const items = (await client.getTodayItems()).sort((a, b) => a.order - b.order);
    const records = items.length ? await client.queryStudyRecords({ vocIds: items.map((i) => i.voc_id) }) : [];
    const sticky = new Set(records.filter((r) => r.tags?.includes('STICKING')).map((r) => r.voc_id));
    const words = items.map((i) =>
      toPracticeWord(i.voc_spelling, {
        vocId: i.voc_id,
        isNew: i.is_new,
        isFinished: i.is_finished,
        firstResponse: i.first_response,
        sticking: sticky.has(i.voc_id),
      }),
    );
    res.json({ progress, words });
  });

  app.post('/api/maimemo/lookup', async (req, res) => {
    const words = wordList(body(req).words, 200).map((w) => w.spelling);
    const records = await maimemo().queryStudyRecords({ spellings: words });
    res.json({ inPlan: [...new Set(records.map((r) => r.voc_spelling.toLowerCase()))] });
  });

  app.post('/api/maimemo/add', async (req, res) => {
    const client = maimemo();
    const words = await resolveVocIds(client, wordList(body(req).words, 50));
    const ids = words.filter((w) => w.vocId).map((w) => w.vocId!);
    const added = ids.length ? await client.addWords(ids) : 0;
    res.json({ added, missing: words.filter((w) => !w.vocId).map((w) => w.spelling) });
  });

  app.post('/api/maimemo/advance', async (req, res) => {
    const client = maimemo();
    const words = await resolveVocIds(client, wordList(body(req).words, 50));
    const ids = words.filter((w) => w.vocId).map((w) => w.vocId!);
    const advanced = ids.length ? await client.advanceStudy(ids) : 0;
    res.json({ advanced, missing: words.filter((w) => !w.vocId).map((w) => w.spelling) });
  });

  app.post('/api/maimemo/phrases', async (req, res) => {
    const b = body(req);
    const record = findSentence(str(b.sentenceId, '句子 ID', 100));
    const known = new Map<string, string | undefined>();
    for (const t of record.analysis.targets) known.set(t.word.toLowerCase(), t.vocId);
    for (const v of record.analysis.vocabulary) if (!known.has(v.lemma.toLowerCase())) known.set(v.lemma.toLowerCase(), undefined);
    const requested = wordList(b.words, 10).map((w) => {
      if (!known.has(w.spelling.toLowerCase())) throw new HttpError(400, `「${w.spelling}」不是这个句子的目标词或生词`);
      return { spelling: w.spelling, vocId: known.get(w.spelling.toLowerCase()) };
    });

    const client = maimemo();
    const resolved = await resolveVocIds(client, requested);
    const results: Array<{ word: string; ok: boolean; error?: string }> = [];
    for (const w of resolved) {
      if (!w.vocId) {
        results.push({ word: w.spelling, ok: false, error: '墨墨词库里没有这个词' });
        continue;
      }
      try {
        await client.createPhrase({
          vocId: w.vocId,
          phrase: record.analysis.sentence,
          interpretation: record.analysis.translation.fluent,
          origin: phraseOrigin(record),
        });
        results.push({ word: w.spelling, ok: true });
      } catch (err) {
        results.push({ word: w.spelling, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    await db.markPhraseWritten(record.id, results.filter((r) => r.ok).map((r) => r.word));
    res.json({ results, written: db.phraseWrites(record.id) });
  });

  app.get('/api/sentences', (_req, res) => {
    const attempts = db.attempts();
    const mine = [...db.sentences()].reverse().map((s) => summary(s, attempts));
    res.json({ sentences: [...mine, ...BUILTIN_RECORDS.map((s) => summary(s, attempts))] });
  });

  app.get('/api/sentences/:id', (req, res) => {
    const record = findSentence(req.params.id);
    res.json({ sentence: record, phraseWrites: db.phraseWrites(record.id) });
  });

  app.delete('/api/sentences/:id', async (req, res) => {
    if (BUILTIN_RECORDS.some((s) => s.id === req.params.id)) throw new HttpError(400, '内置句子不能删除');
    if (!(await db.deleteSentence(req.params.id))) throw new HttpError(404, '找不到这个句子');
    res.json({ ok: true });
  });

  const levelOf = (value: unknown) => (isExamLevel(value) ? value : settings.get().level);
  const attachVocIds = (analysis: Analysis, words: Array<{ spelling: string; vocId?: string }>) => {
    for (const t of analysis.targets) t.vocId = words.find((w) => w.spelling.toLowerCase() === t.word.toLowerCase())?.vocId;
    return analysis;
  };
  const save = async (record: Omit<SentenceRecord, 'id' | 'createdAt'>, usedWords: string[] = []) => {
    const full: SentenceRecord = { id: randomUUID(), createdAt: new Date().toISOString(), ...record };
    await db.addSentence(full, usedWords);
    return full;
  };

  app.post('/api/sentences/generate', async (req, res) => {
    const b = body(req);
    const words = wordList(b.words, 3);
    const level = levelOf(b.level);
    const topic = typeof b.topic === 'string' ? b.topic.slice(0, 60) : undefined;
    const focus = db.stats().weakLabels;
    const analysis = await generateSentence(llm(), { words: words.map((w) => w.spelling), level, topic, focus });
    const record = await save(
      { source: 'generated', origin: `AI 生成 · ${EXAM_LEVELS[level].name}`, level, analysis: attachVocIds(analysis, words) },
      words.map((w) => w.spelling),
    );
    res.json({ sentence: record, focus });
  });

  app.post('/api/sentences/analyze', async (req, res) => {
    const b = body(req);
    const text = str(b.text, '句子', 2000);
    const targets = Array.isArray(b.targets) && b.targets.length ? wordList(b.targets, 3) : [];
    const level = levelOf(b.level);
    const analysis = await analyzeSentence(llm(), { sentence: text, level, targets: targets.map((t) => t.spelling) });
    const record = await save({ source: 'pasted', origin: '粘贴的句子', level, analysis: attachVocIds(analysis, targets) });
    res.json({ sentence: record });
  });

  app.post('/api/grade', async (req, res) => {
    const b = body(req);
    const record = findSentence(str(b.sentenceId, '句子 ID', 100));
    const translation = str(b.translation, '译文', 3000);
    res.json({ grade: await gradeTranslation(llm(), record.analysis, translation) });
  });

  app.post('/api/attempts', async (req, res) => {
    const b = body(req);
    const record = findSentence(str(b.sentenceId, '句子 ID', 100));
    const s = (b.scores ?? {}) as Record<string, unknown>;
    const scores: AttemptScores = {
      chunking: score(s.chunking, '断句'),
      skeleton: score(s.skeleton, '主干'),
      tagging: score(s.tagging, '成分'),
      translation: s.translation === null || s.translation === undefined ? null : score(s.translation, '翻译'),
    };
    const labelResults = (Array.isArray(b.labelResults) ? b.labelResults : []).map((r: { label?: unknown; result?: unknown }) => {
      if (!isLabelId(r?.label) || !TAG_RESULTS.includes(r.result as TagResult)) throw new HttpError(400, '成分结果格式不对');
      return { label: r.label, result: r.result as TagResult };
    });
    const wordRatings = (Array.isArray(b.wordRatings) ? b.wordRatings : []).map((r: { word?: unknown; rating?: unknown }) => {
      if (typeof r?.word !== 'string' || !RATINGS.includes(r.rating as WordRating)) throw new HttpError(400, '单词自评格式不对');
      return { word: r.word, rating: r.rating as WordRating };
    });
    const attempt: Attempt = {
      id: randomUUID(),
      sentenceId: record.id,
      at: new Date().toISOString(),
      scores,
      overall: overallScore(scores),
      labelResults,
      wordRatings,
      translation: typeof b.translation === 'string' && b.translation.trim() ? b.translation.trim().slice(0, 3000) : undefined,
    };
    await db.addAttempt(attempt);
    res.json({ attempt });
  });

  app.get('/api/attempts', (_req, res) => {
    const attempts = [...db.attempts()].reverse().slice(0, 300);
    const sentences = new Map([...BUILTIN_RECORDS, ...db.sentences()].map((s) => [s.id, s]));
    res.json({
      attempts: attempts.map((a) => ({ ...a, sentence: sentences.get(a.sentenceId)?.analysis.sentence ?? '（句子已删除）' })),
    });
  });

  app.get('/api/stats', (_req, res) => {
    res.json(db.stats());
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: unknown; type?: unknown; message?: unknown };
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
    let message = typeof e?.message === 'string' ? e.message : '服务器内部错误';
    if (e?.type === 'entity.parse.failed') message = '请求体不是合法的 JSON';
    if (e?.type === 'entity.too.large') message = '请求内容太大了';
    if (status === 500) {
      console.error(err);
      message = '服务器内部错误';
    }
    if (!res.headersSent) res.status(status).json({ error: message });
  });

  return app;
}
