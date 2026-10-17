import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { AnthropicProvider, LlmError, OpenAICompatibleProvider, parseStructured, type LlmProvider, type StructuredRequest } from '../server/llm/providers';
import { GradeSchema, RawAnalysisSchema } from '../server/llm/schema';
import { analyzeSentence, generateSentence, gradeTranslation } from '../server/llm/tasks';
import { normalizeAnalysis } from '../shared/analysis';
import { GENERATED, GENERATED_BROKEN, anthropicMessage } from './fixtures';

function scripted(outputs: Array<unknown | Error>) {
  const prompts: string[] = [];
  const provider: LlmProvider = {
    label: 'fake',
    async generate<T>(request: StructuredRequest<T>): Promise<T> {
      prompts.push(request.prompt);
      const next = outputs.shift();
      if (next instanceof Error) throw next;
      return request.schema.parse(next);
    },
  };
  return { provider, prompts };
}

describe('generateSentence', () => {
  it('returns an aligned analysis on the first valid answer', async () => {
    const { provider, prompts } = scripted([GENERATED]);
    const analysis = await generateSentence(provider, { words: ['curb', 'mitigate'], level: 'kaoyan1', focus: ['appositive_clause'] });
    expect(analysis.targets.map((t) => t.word)).toEqual(['curb', 'mitigate']);
    expect(analysis.chunks).toHaveLength(6);
    expect(prompts[0]).toContain('- curb\n- mitigate');
    expect(prompts[0]).toContain('同位语从句');
    expect(prompts[0]).toContain('考研英语一');
  });

  it('retries with the validation errors and then succeeds', async () => {
    const { provider, prompts } = scripted([GENERATED_BROKEN, GENERATED]);
    const analysis = await generateSentence(provider, { words: ['curb', 'mitigate'], level: 'kaoyan1' });
    expect(analysis.sentence).toBe(GENERATED.sentence);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('上一次的输出没有通过系统校验');
    expect(prompts[1]).toContain('who studied earlier reforms');
  });

  it('retries malformed model output but not other failures', async () => {
    const malformed = scripted([new LlmError('模型返回的不是合法 JSON', 502, true), GENERATED]);
    await expect(generateSentence(malformed.provider, { words: ['curb'], level: 'kaoyan1' })).resolves.toBeTruthy();
    expect(malformed.prompts[1]).toContain('不是合法 JSON');

    const auth = scripted([new LlmError('Key 无效', 401)]);
    await expect(generateSentence(auth.provider, { words: ['curb'], level: 'kaoyan1' })).rejects.toThrow('Key 无效');
    expect(auth.prompts).toHaveLength(1);
  });

  it('gives up after two invalid answers and requires every target word', async () => {
    const { provider } = scripted([GENERATED, GENERATED]);
    await expect(generateSentence(provider, { words: ['curb', 'alleviate'], level: 'kaoyan1' })).rejects.toThrow(/alleviate/);
  });
});

describe('analyzeSentence', () => {
  it('keeps the pasted sentence even if the model rewrites its echo', async () => {
    const { provider, prompts } = scripted([{ ...GENERATED, sentence: 'A rewritten sentence.' }]);
    const analysis = await analyzeSentence(provider, { sentence: `  ${GENERATED.sentence}  `, level: 'cet6' });
    expect(analysis.sentence).toBe(GENERATED.sentence);
    expect(prompts[0]).toContain(`<sentence>\n${GENERATED.sentence}\n</sentence>`);
  });

  it('rejects empty or huge input before calling the model', async () => {
    const { provider, prompts } = scripted([]);
    await expect(analyzeSentence(provider, { sentence: 'Too short', level: 'cet6' })).rejects.toThrow(/太短/);
    await expect(analyzeSentence(provider, { sentence: 'word '.repeat(200), level: 'cet6' })).rejects.toThrow(/太长/);
    expect(prompts).toHaveLength(0);
  });
});

describe('gradeTranslation', () => {
  it('clamps the score and sends structure notes', async () => {
    const result = normalizeAnalysis(GENERATED);
    if (!result.ok) throw new Error(result.errors.join());
    const { provider, prompts } = scripted([{ score: 120, verdict: '很好', issues: [], improved: '改进' }]);
    const grade = await gradeTranslation(provider, result.analysis, ' 我的译文 ');
    expect(grade.score).toBe(100);
    expect(prompts[0]).toContain('<answer>\n我的译文\n</answer>');
    expect(prompts[0]).toContain('定语从句');
  });
});

describe('parseStructured', () => {
  it('accepts fenced JSON and explains schema problems', () => {
    expect(parseStructured('```json\n{"score":1,"verdict":"v","issues":[],"improved":"i"}\n```', GradeSchema).score).toBe(1);
    expect(() => parseStructured('not json', GradeSchema)).toThrow(/不是合法 JSON/);
    try {
      parseStructured('{"score":"high","verdict":"v","issues":[],"improved":"i"}', GradeSchema);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LlmError);
      expect((err as LlmError).retryable).toBe(true);
      expect((err as LlmError).message).toContain('score');
    }
  });
});

describe('OpenAICompatibleProvider', () => {
  function provider(respond: (body: Record<string, unknown>) => Response) {
    const seen: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      seen.push({ url: String(input), auth: new Headers(init?.headers).get('Authorization'), body });
      return respond(body);
    }) as typeof fetch;
    return { p: new OpenAICompatibleProvider({ baseUrl: 'https://llm.test/v1/', apiKey: 'sk-x', model: 'deepseek-chat', fetch: fetchImpl }), seen };
  }
  const completion = (content: string, finish = 'stop') =>
    new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finish }] }), { status: 200 });

  it('asks for JSON mode with the schema in the system prompt', async () => {
    const { p, seen } = provider(() => completion(JSON.stringify(GENERATED)));
    const out = await p.generate({ system: 'SYS', prompt: 'USER', schema: RawAnalysisSchema });
    expect(out.sentence).toBe(GENERATED.sentence);
    expect(seen[0].url).toBe('https://llm.test/v1/chat/completions');
    expect(seen[0].auth).toBe('Bearer sk-x');
    expect(seen[0].body.model).toBe('deepseek-chat');
    expect(seen[0].body.response_format).toEqual({ type: 'json_object' });
    const messages = seen[0].body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain('SYS');
    expect(messages[0].content).toContain('"relative_clause"');
    expect(messages[1]).toEqual({ role: 'user', content: 'USER' });
  });

  it('maps failures to readable errors', async () => {
    const cases: Array<[Response, RegExp, boolean]> = [
      [new Response('{"error":{"message":"bad key"}}', { status: 401 }), /API Key 无效/, false],
      [new Response('', { status: 429 }), /限流/, false],
      [new Response('{"error":{"message":"model not found"}}', { status: 404 }), /model not found/, false],
      [completion('{"sentence":', 'length'), /截断/, true],
      [completion(''), /没有返回内容/, true],
    ];
    for (const [response, message, retryable] of cases) {
      const { p } = provider(() => response);
      const err = (await p.generate({ system: 's', prompt: 'u', schema: GradeSchema }).catch((e: unknown) => e)) as LlmError;
      expect(err.message).toMatch(message);
      expect(err.retryable).toBe(retryable);
    }
  });
});

describe('AnthropicProvider', () => {
  function provider(respond: () => Response) {
    const seen: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return respond();
    }) as typeof fetch;
    const client = new Anthropic({ apiKey: 'sk-ant-test', fetch: fetchImpl, maxRetries: 0 });
    return { p: new AnthropicProvider({ model: 'claude-opus-5-5', effort: 'medium', client }), seen };
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends structured output, fallbacks and caching, and parses the result', async () => {
    const { p, seen } = provider(() => json(anthropicMessage(GENERATED)));
    const out = await p.generate({ system: 'SYS', prompt: 'USER', schema: RawAnalysisSchema });
    expect(out.targets[0].word).toBe('curb');

    const { url, headers, body } = seen[0];
    expect(url).toContain('/v1/messages');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.fallbacks).toBe('default');
    expect(body.cache_control).toEqual({ type: 'ephemeral' });
    expect(body.system).toBe('SYS');
    expect(body).not.toHaveProperty('thinking');
    const config = body.output_config as { effort: string; format: { type: string; schema: { properties: Record<string, unknown> } } };
    expect(config.effort).toBe('medium');
    expect(config.format.type).toBe('json_schema');
    expect(Object.keys(config.format.schema.properties)).toContain('chunks');
  });

  it('lets a request lower the effort', async () => {
    const { p, seen } = provider(() => json(anthropicMessage({ score: 80, verdict: 'v', issues: [], improved: 'i' })));
    await p.generate({ system: 's', prompt: 'u', schema: GradeSchema, effort: 'low' });
    expect((seen[0].body.output_config as { effort: string }).effort).toBe('low');
  });

  it('handles refusals, truncation and API errors', async () => {
    const refusal = provider(() => json({ ...anthropicMessage({}), content: [], stop_reason: 'refusal' }));
    await expect(refusal.p.generate({ system: 's', prompt: 'u', schema: GradeSchema })).rejects.toThrow(/拒绝/);

    const truncated = provider(() => json(anthropicMessage({ score: 1 }, 'max_tokens')));
    const err = (await truncated.p.generate({ system: 's', prompt: 'u', schema: GradeSchema }).catch((e: unknown) => e)) as LlmError;
    expect(err.message).toMatch(/截断/);
    expect(err.retryable).toBe(true);

    const unauthorized = provider(() => json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401));
    await expect(unauthorized.p.generate({ system: 's', prompt: 'u', schema: GradeSchema })).rejects.toThrow(/API Key 无效/);
  });
});
