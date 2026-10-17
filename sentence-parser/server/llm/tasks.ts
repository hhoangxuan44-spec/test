import { normalizeAnalysis, type NormalizeOptions } from '../../shared/analysis';
import { LABELS, type LabelId } from '../../shared/labels';
import { cleanSentence, normalizeWord, tokenize } from '../../shared/tokenize';
import type { Analysis, ExamLevel, TranslationGrade } from '../../shared/types';
import { ANALYSIS_SYSTEM, GRADE_SYSTEM, analyzePrompt, generatePrompt, gradePrompt, lengthLimits } from './prompts';
import { LlmError, type LlmProvider } from './providers';
import { GradeSchema, RawAnalysisSchema } from './schema';

const ATTEMPTS = 2;

async function analysisWithRetry(
  provider: LlmProvider,
  buildPrompt: (errors: string[]) => string,
  options: NormalizeOptions,
): Promise<Analysis> {
  let errors: string[] = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let raw;
    try {
      raw = await provider.generate({ system: ANALYSIS_SYSTEM, prompt: buildPrompt(errors), schema: RawAnalysisSchema });
    } catch (err) {
      if (err instanceof LlmError && err.retryable) {
        errors = [err.message];
        continue;
      }
      throw err;
    }
    const result = normalizeAnalysis(raw, options);
    if (result.ok) return result.analysis;
    errors = result.errors;
  }
  throw new LlmError(`AI 连续 ${ATTEMPTS} 次给出的结果都没通过校验，请重试或换几个词。（${errors.slice(0, 3).join('；')}）`, 502);
}

export interface GenerateInput {
  words: string[];
  level: ExamLevel;
  topic?: string;
  focus?: LabelId[];
}

export function generateSentence(provider: LlmProvider, input: GenerateInput): Promise<Analysis> {
  return analysisWithRetry(provider, (errors) => generatePrompt(input, errors), {
    requiredTargets: input.words,
    ...lengthLimits(input.level),
  });
}

export const MAX_PASTE_WORDS = 150;

export async function analyzeSentence(provider: LlmProvider, input: { sentence: string; level: ExamLevel; targets?: string[] }): Promise<Analysis> {
  const sentence = cleanSentence(input.sentence);
  const words = tokenize(sentence).filter((t) => normalizeWord(t) !== '').length;
  if (words < 3) throw new LlmError('句子太短了，至少需要 3 个词', 400);
  if (words > MAX_PASTE_WORDS) throw new LlmError(`句子太长了（${words} 个词），请一次粘贴一个句子，不超过 ${MAX_PASTE_WORDS} 个词`, 400);
  return analysisWithRetry(provider, (errors) => analyzePrompt({ ...input, sentence }, errors), {
    sentence,
    requiredTargets: input.targets,
  });
}

export async function gradeTranslation(provider: LlmProvider, analysis: Analysis, answer: string): Promise<TranslationGrade> {
  const grade = await provider.generate({
    system: GRADE_SYSTEM,
    effort: 'low',
    schema: GradeSchema,
    prompt: gradePrompt({
      sentence: analysis.sentence,
      skeletonSummary: analysis.skeleton.summary,
      chunkNotes: analysis.chunks.map((c) => `${c.text} —— ${LABELS[c.label].name}：${c.explanation}`),
      reference: analysis.translation.fluent,
      answer: answer.trim(),
    }),
  });
  return { ...grade, score: Math.min(100, Math.max(0, Math.round(grade.score))) };
}
