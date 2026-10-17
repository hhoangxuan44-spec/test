import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Effort } from '../../shared/api';

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Overrides the provider's configured effort, e.g. 'low' for quick grading. */
  effort?: Effort;
}

export interface LlmProvider {
  readonly label: string;
  generate<T>(request: StructuredRequest<T>): Promise<T>;
}

export class LlmError extends Error {
  readonly status: number;
  /** True when the model answered but the answer was malformed, so asking again may help. */
  readonly retryable: boolean;
  constructor(message: string, status = 502, retryable = false) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
    this.retryable = retryable;
  }
}

export class AnthropicProvider implements LlmProvider {
  readonly label: string;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: Effort;

  constructor(options: { apiKey?: string; model: string; effort: Effort; client?: Anthropic }) {
    this.client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
    this.model = options.model;
    this.effort = options.effort;
    this.label = `Claude · ${options.model}`;
  }

  async generate<T>(request: StructuredRequest<T>): Promise<T> {
    let response;
    try {
      // create() rather than parse(): parse() validates eagerly, before stop_reason can be checked.
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        cache_control: { type: 'ephemeral' },
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        output_config: { effort: request.effort ?? this.effort, format: betaZodOutputFormat(request.schema) },
      });
    } catch (err) {
      throw describeAnthropicError(err);
    }
    if (response.stop_reason === 'refusal') throw new LlmError('模型拒绝回答这个请求，请换一个句子或词再试');
    if (response.stop_reason === 'max_tokens') throw new LlmError('模型输出过长被截断了，请重试', 502, true);
    const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    if (!text.trim()) throw new LlmError('模型没有返回内容', 502, true);
    return parseStructured(text, request.schema);
  }
}

function describeAnthropicError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) return new LlmError('Anthropic API Key 无效，请在设置里检查', 401);
  if (err instanceof Anthropic.PermissionDeniedError) return new LlmError('当前 API Key 没有权限使用这个模型', 403);
  if (err instanceof Anthropic.NotFoundError) return new LlmError('找不到这个模型，请在设置里检查模型名称', 400);
  if (err instanceof Anthropic.RateLimitError) return new LlmError('Anthropic 接口限流或额度不足，请稍后再试', 429);
  if (err instanceof Anthropic.BadRequestError) return new LlmError(`Anthropic 请求被拒绝：${err.message}`, 400);
  if (err instanceof Anthropic.APIConnectionError) {
    return new LlmError('无法连接 Anthropic API（如需代理，请设置 HTTPS_PROXY 并用 NODE_USE_ENV_PROXY=1 启动）', 502);
  }
  if (err instanceof Anthropic.APIError) return new LlmError(`Anthropic 接口出错（${err.status ?? '网络'}）：${err.message}`, 502);
  if (err instanceof Anthropic.AnthropicError) return new LlmError(`Anthropic 客户端出错：${err.message}`, 502);
  return err instanceof Error ? err : new Error(String(err));
}

/** Any service speaking the OpenAI chat-completions protocol: DeepSeek, Qwen, Kimi, GLM, … */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly label: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl: string; apiKey: string; model: string; fetch?: typeof fetch }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchImpl = options.fetch ?? fetch;
    this.label = `${options.model}`;
  }

  async generate<T>(request: StructuredRequest<T>): Promise<T> {
    const schema = JSON.stringify(z.toJSONSchema(request.schema));
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${request.system}\n\n## 输出格式\n只输出一个 JSON 对象，不要输出任何其他文字。JSON 必须符合这个 JSON Schema：\n${schema}`,
            },
            { role: 'user', content: request.prompt },
          ],
        }),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === 'TimeoutError' ? '请求超时' : '网络连接失败';
      throw new LlmError(`无法连接 ${this.baseUrl}（${reason}）`, 502);
    }

    const body = await res.text();
    if (!res.ok) {
      let detail = body.slice(0, 300);
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        detail = parsed.error?.message ?? detail;
      } catch {
        // keep the raw text
      }
      if (res.status === 401) throw new LlmError('模型服务的 API Key 无效，请在设置里检查', 401);
      if (res.status === 429) throw new LlmError('模型服务限流或额度不足，请稍后再试', 429);
      throw new LlmError(`模型服务出错（HTTP ${res.status}）：${detail}`, 502);
    }

    let content: string | undefined;
    let finish: string | undefined;
    try {
      const data = JSON.parse(body) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
      content = data.choices?.[0]?.message?.content;
      finish = data.choices?.[0]?.finish_reason;
    } catch {
      throw new LlmError('模型服务返回了无法解析的内容', 502);
    }
    if (finish === 'length') throw new LlmError('模型输出过长被截断了，请重试', 502, true);
    if (!content) throw new LlmError('模型没有返回内容', 502, true);
    return parseStructured(content, request.schema);
  }
}

export function parseStructured<T>(content: string, schema: z.ZodType<T>): T {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new LlmError('模型返回的不是合法 JSON', 502, true);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(根)'}：${i.message}`);
    throw new LlmError(`模型返回的 JSON 字段不符合要求：${issues.join('；')}`, 502, true);
  }
  return result.data;
}
