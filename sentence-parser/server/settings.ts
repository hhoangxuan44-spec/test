import { join } from 'node:path';
import type { Effort, PublicSettings, Settings } from '../shared/api';
import { isExamLevel } from '../shared/types';
import { JsonFile, readJson } from './files';
import { HttpError } from './http';

export type { Settings };

const SECRET_KEYS = ['maimemoToken', 'anthropicApiKey', 'openaiApiKey'] as const;
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const MASK = '••••';

function envDefaults(env: NodeJS.ProcessEnv): Settings {
  const effort = env.ANTHROPIC_EFFORT as Effort | undefined;
  const level = env.EXAM_LEVEL;
  return {
    maimemoToken: env.MAIMEMO_TOKEN ?? '',
    llmProvider: env.LLM_PROVIDER === 'openai' ? 'openai' : 'anthropic',
    anthropicApiKey: '',
    anthropicModel: env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
    anthropicEffort: effort && EFFORTS.includes(effort) ? effort : 'medium',
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',
    openaiApiKey: env.OPENAI_API_KEY ?? '',
    openaiModel: env.OPENAI_MODEL ?? 'deepseek-chat',
    level: isExamLevel(level) ? level : 'kaoyan1',
    wordsPerSentence: 2,
  };
}

function mask(secret: string): string {
  return secret ? MASK + secret.slice(-4) : '';
}

export class SettingsStore {
  private current: Settings;
  private readonly file: JsonFile<Partial<Settings>>;
  private saved: Partial<Settings>;
  private readonly env: NodeJS.ProcessEnv;

  private constructor(dataDir: string, saved: Partial<Settings>, env: NodeJS.ProcessEnv) {
    this.file = new JsonFile(join(dataDir, 'settings.json'));
    this.saved = saved;
    this.env = env;
    this.current = { ...envDefaults(env), ...saved };
  }

  static async open(dataDir: string, env: NodeJS.ProcessEnv = process.env): Promise<SettingsStore> {
    const saved = (await readJson<Partial<Settings>>(join(dataDir, 'settings.json'))) ?? {};
    return new SettingsStore(dataDir, saved, env);
  }

  get(): Settings {
    return this.current;
  }

  /** The SDK also finds keys in ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN, so those count as configured. */
  llmConfigured(): boolean {
    const s = this.current;
    if (s.llmProvider === 'openai') return Boolean(s.openaiApiKey && s.openaiBaseUrl && s.openaiModel);
    return Boolean(s.anthropicApiKey || this.env.ANTHROPIC_API_KEY || this.env.ANTHROPIC_AUTH_TOKEN);
  }

  toPublic(): PublicSettings {
    const s = this.current;
    return {
      ...s,
      maimemoToken: mask(s.maimemoToken),
      anthropicApiKey: mask(s.anthropicApiKey),
      openaiApiKey: mask(s.openaiApiKey),
      maimemoConfigured: Boolean(s.maimemoToken),
      llmConfigured: this.llmConfigured(),
    };
  }

  async update(patch: Record<string, unknown>): Promise<void> {
    const next: Partial<Settings> = {};
    const text = (key: string, max = 500): string | undefined => {
      const value = patch[key];
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || value.length > max) throw new HttpError(400, `设置项 ${key} 格式不对`);
      return value.trim();
    };

    for (const key of SECRET_KEYS) {
      const value = text(key, 4000);
      // A masked value coming back from the form means "unchanged".
      if (value !== undefined && !value.startsWith(MASK)) next[key] = value;
    }
    const provider = text('llmProvider');
    if (provider !== undefined) {
      if (provider !== 'anthropic' && provider !== 'openai') throw new HttpError(400, '未知的模型服务');
      next.llmProvider = provider;
    }
    const effort = text('anthropicEffort');
    if (effort !== undefined) {
      if (!EFFORTS.includes(effort as Effort)) throw new HttpError(400, '未知的推理强度');
      next.anthropicEffort = effort as Effort;
    }
    const level = text('level');
    if (level !== undefined) {
      if (!isExamLevel(level)) throw new HttpError(400, '未知的难度');
      next.level = level;
    }
    for (const key of ['anthropicModel', 'openaiModel'] as const) {
      const value = text(key, 100);
      if (value !== undefined) {
        if (!value) throw new HttpError(400, '模型名称不能为空');
        next[key] = value;
      }
    }
    const baseUrl = text('openaiBaseUrl');
    if (baseUrl !== undefined) {
      if (baseUrl && !/^https?:\/\/\S+$/.test(baseUrl)) throw new HttpError(400, '接口地址需要以 http:// 或 https:// 开头');
      next.openaiBaseUrl = baseUrl;
    }
    if (patch.wordsPerSentence !== undefined) {
      const n = patch.wordsPerSentence;
      if (n !== 1 && n !== 2 && n !== 3) throw new HttpError(400, '每句目标词数量只能是 1-3');
      next.wordsPerSentence = n;
    }

    this.saved = { ...this.saved, ...next };
    this.current = { ...envDefaults(this.env), ...this.saved };
    await this.file.write(this.saved, 0o600);
  }
}
