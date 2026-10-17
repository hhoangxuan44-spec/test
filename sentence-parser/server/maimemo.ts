import type { BriefNotepad, StudyProgress } from '../shared/api';
import type { StudyResponse } from '../shared/types';

// Shapes follow maimemo/openapi protos as mirrored in the official memo-api CLI.

export interface TodayItem {
  voc_id: string;
  voc_spelling: string;
  order: number;
  first_response?: StudyResponse;
  is_new: boolean;
  is_finished: boolean;
}

export interface StudyRecord {
  voc_id: string;
  voc_spelling: string;
  add_date?: string;
  first_study_date?: string;
  last_study_date?: string;
  next_study_date?: string;
  last_response?: StudyResponse;
  study_count: number;
  tags: Array<'STUDY_RECORD_TAG_UNSPECIFIED' | 'STICKING' | 'WELL_FAMILIAR'>;
}

export interface Vocabulary {
  id: string;
  spelling: string;
}

export interface Phrase {
  id: string;
  phrase: string;
  interpretation: string;
  tags: string[];
  origin: string;
}

export interface Notepad extends BriefNotepad {
  content: string;
  list: Array<{ type: 'PARSED_TYPE_UNSPECIFIED' | 'CHAPTER' | 'WORD'; data?: { chapter: string; word: string } }>;
}

export const MAIMEMO_BASE_URL = 'https://open.maimemo.com/open/api/v1';

export class MaiMemoError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MaiMemoError';
    this.status = status;
  }
}

/** The open API allows about 20 calls per 10 seconds; stay a little under it. */
export class RateLimiter {
  private stamps: number[] = [];
  private queue: Promise<void> = Promise.resolve();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max = 18, windowMs = 10_000) {
    this.max = max;
    this.windowMs = windowMs;
  }

  acquire(): Promise<void> {
    const turn = this.queue.then(async () => {
      for (;;) {
        const now = Date.now();
        this.stamps = this.stamps.filter((s) => now - s < this.windowMs);
        if (this.stamps.length < this.max) {
          this.stamps.push(now);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, this.windowMs - (now - this.stamps[0]) + 10));
      }
    });
    this.queue = turn;
    return turn;
  }
}

const sharedLimiter = new RateLimiter();

export interface MaiMemoClientOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  limiter?: RateLimiter;
  timeoutMs?: number;
}

type Envelope<T> = { success?: boolean; data?: T; errors?: Array<{ code?: string; message?: string }> };

function describeErrors(errors: Envelope<unknown>['errors']): string {
  return (errors ?? []).map((e) => [e.code, e.message].filter(Boolean).join(': ')).join('; ');
}

export class MaiMemoClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly limiter: RateLimiter;
  private readonly timeoutMs: number;

  constructor(options: MaiMemoClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? MAIMEMO_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
    this.limiter = options.limiter ?? sharedLimiter;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, init: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
    await this.limiter.acquire();

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === 'TimeoutError' ? '请求超时' : '网络连接失败';
      throw new MaiMemoError(`无法连接墨墨服务器（${reason}）`, 502);
    }

    const text = await res.text();
    let json: Envelope<T> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Envelope<T>;
      } catch {
        if (res.ok) throw new MaiMemoError('墨墨接口返回了无法解析的内容', 502);
      }
    }

    if (!res.ok) {
      const detail = describeErrors(json.errors);
      if (res.status === 401) throw new MaiMemoError('墨墨 Token 无效或已过期，请在墨墨 App 里重新复制', 401);
      if (res.status === 429) throw new MaiMemoError('墨墨接口请求太频繁，请稍后再试', 429);
      throw new MaiMemoError(`墨墨接口出错（HTTP ${res.status}）${detail ? '：' + detail : ''}`, res.status >= 500 ? 502 : res.status);
    }
    if (json.errors && json.errors.length > 0) throw new MaiMemoError(`墨墨接口出错：${describeErrors(json.errors)}`, 400);
    if (json.success === false) throw new MaiMemoError('墨墨接口返回失败', 400);
    return (json.data ?? json) as T;
  }

  async getStudyProgress(): Promise<StudyProgress> {
    const data = await this.request<{ progress: StudyProgress }>('POST', '/study/get_study_progress', { body: {} });
    return data.progress;
  }

  async getTodayItems(limit = 1000): Promise<TodayItem[]> {
    const data = await this.request<{ today_items?: TodayItem[] }>('POST', '/study/get_today_items', {
      body: { voc_ids: [], spellings: [], limit },
    });
    return data.today_items ?? [];
  }

  async queryStudyRecords(filter: { spellings?: string[]; vocIds?: string[]; limit?: number } = {}): Promise<StudyRecord[]> {
    const data = await this.request<{ records?: StudyRecord[] }>('POST', '/study/query_study_records', {
      body: { voc_ids: filter.vocIds ?? [], spellings: filter.spellings ?? [], as_count: false, limit: filter.limit ?? 1000 },
    });
    return data.records ?? [];
  }

  async addWords(vocIds: string[], advance = false): Promise<number> {
    const data = await this.request<{ added_count?: number }>('POST', '/study/add_words', {
      body: { words: vocIds.map((id) => ({ id })), advance },
    });
    return data.added_count ?? 0;
  }

  async advanceStudy(vocIds: string[]): Promise<number> {
    const data = await this.request<{ advanced_count?: number }>('POST', '/study/advance_study', { body: { voc_ids: vocIds } });
    return data.advanced_count ?? 0;
  }

  async queryVocabulary(spellings: string[]): Promise<Vocabulary[]> {
    if (spellings.length === 0) return [];
    const data = await this.request<{ voc?: Vocabulary[] }>('POST', '/vocabulary/query', { body: { spellings, ids: [] } });
    return data.voc ?? [];
  }

  async createPhrase(input: { vocId: string; phrase: string; interpretation: string; origin: string; tags?: string[] }): Promise<Phrase> {
    const data = await this.request<{ phrase: Phrase }>('POST', '/phrases', {
      body: {
        phrase: { voc_id: input.vocId, phrase: input.phrase, interpretation: input.interpretation, tags: input.tags ?? [], origin: input.origin },
      },
    });
    return data.phrase;
  }

  async listNotepads(limit = 50, offset = 0): Promise<BriefNotepad[]> {
    const data = await this.request<{ notepads?: BriefNotepad[] }>('GET', '/notepads', {
      query: { limit: String(limit), offset: String(offset) },
    });
    return data.notepads ?? [];
  }

  async getNotepad(id: string): Promise<Notepad> {
    const data = await this.request<{ notepad: Notepad }>('GET', `/notepads/${encodeURIComponent(id)}`);
    return data.notepad;
  }
}

export function notepadWords(notepad: Notepad): string[] {
  const words = (notepad.list ?? [])
    .filter((item) => item.type === 'WORD' && item.data?.word)
    .map((item) => item.data!.word.trim());
  return [...new Set(words)];
}
