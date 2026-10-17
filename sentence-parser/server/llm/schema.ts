import { z } from 'zod';
import { LABEL_IDS } from '../../shared/labels';

export const RawAnalysisSchema = z.object({
  sentence: z.string(),
  chunks: z.array(
    z.object({
      text: z.string(),
      label: z.enum(LABEL_IDS),
      depth: z.number().int(),
      modifies: z.string(),
      explanation: z.string(),
      translation: z.string(),
    }),
  ),
  skeleton: z.object({
    subject: z.string(),
    predicate: z.string(),
    complement: z.string(),
    summary: z.string(),
  }),
  targets: z.array(
    z.object({
      word: z.string(),
      form: z.string(),
      pos: z.string(),
      meaning: z.string(),
      note: z.string(),
    }),
  ),
  vocabulary: z.array(
    z.object({
      form: z.string(),
      lemma: z.string(),
      pos: z.string(),
      meaning: z.string(),
    }),
  ),
  translation: z.object({ literal: z.string(), fluent: z.string() }),
  difficulties: z.array(z.string()),
});

export const GradeSchema = z.object({
  score: z.number().int(),
  verdict: z.string(),
  issues: z.array(z.object({ type: z.string(), detail: z.string() })),
  improved: z.string(),
});
