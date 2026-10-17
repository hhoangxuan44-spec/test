import type { BriefNotepad, PhraseWriteResult, PublicSettings, SentenceSummary, Settings, Stats, StudyProgress } from '../shared/api';
import type { LabelId } from '../shared/labels';
import type { Attempt, AttemptScores, ExamLevel, PracticeWord, SentenceRecord, TagResult, TranslationGrade, WordRating } from '../shared/types';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError('连不上本地服务，请确认 npm run dev 还在运行', 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `请求失败（HTTP ${res.status}）`, res.status);
  return data as T;
}

export type WordRef = { spelling: string; vocId?: string };
export type WordSource = 'today' | 'sticking' | 'notepad';

export interface AttemptPayload {
  sentenceId: string;
  scores: AttemptScores;
  labelResults: Array<{ label: LabelId; result: TagResult }>;
  wordRatings: Array<{ word: string; rating: WordRating }>;
  translation?: string;
}

export const api = {
  settings: () => call<PublicSettings>('GET', '/api/settings'),
  saveSettings: (patch: Partial<Settings>) => call<PublicSettings>('PUT', '/api/settings', patch),

  testMaimemo: () => call<{ progress: StudyProgress }>('POST', '/api/maimemo/test'),
  notepads: () => call<{ notepads: BriefNotepad[] }>('GET', '/api/maimemo/notepads'),
  words: (source: WordSource, notepadId?: string) =>
    call<{ words: PracticeWord[]; progress?: StudyProgress; title?: string }>(
      'GET',
      `/api/maimemo/words?source=${source}${notepadId ? `&id=${encodeURIComponent(notepadId)}` : ''}`,
    ),
  lookup: (words: string[]) => call<{ inPlan: string[] }>('POST', '/api/maimemo/lookup', { words }),
  addWords: (words: string[]) => call<{ added: number; missing: string[] }>('POST', '/api/maimemo/add', { words }),
  advance: (words: WordRef[]) => call<{ advanced: number; missing: string[] }>('POST', '/api/maimemo/advance', { words }),
  writePhrases: (sentenceId: string, words: string[]) =>
    call<{ results: PhraseWriteResult[]; written: string[] }>('POST', '/api/maimemo/phrases', { sentenceId, words }),

  sentences: () => call<{ sentences: SentenceSummary[] }>('GET', '/api/sentences'),
  sentence: (id: string) => call<{ sentence: SentenceRecord; phraseWrites: string[] }>('GET', `/api/sentences/${encodeURIComponent(id)}`),
  deleteSentence: (id: string) => call<{ ok: true }>('DELETE', `/api/sentences/${encodeURIComponent(id)}`),
  generate: (words: WordRef[], level: ExamLevel, topic?: string) =>
    call<{ sentence: SentenceRecord; focus: LabelId[] }>('POST', '/api/sentences/generate', { words, level, topic }),
  analyze: (text: string, level: ExamLevel, targets: string[]) =>
    call<{ sentence: SentenceRecord }>('POST', '/api/sentences/analyze', { text, level, targets }),

  grade: (sentenceId: string, translation: string) => call<{ grade: TranslationGrade }>('POST', '/api/grade', { sentenceId, translation }),
  saveAttempt: (payload: AttemptPayload) => call<{ attempt: Attempt }>('POST', '/api/attempts', payload),
  attempts: () => call<{ attempts: Array<Attempt & { sentence: string }> }>('GET', '/api/attempts'),
  stats: () => call<Stats>('GET', '/api/stats'),
};
