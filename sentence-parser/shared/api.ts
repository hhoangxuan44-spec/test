import type { LabelId } from './labels';
import type { ExamLevel, SentenceSource } from './types';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface Settings {
  maimemoToken: string;
  llmProvider: 'anthropic' | 'openai';
  anthropicApiKey: string;
  anthropicModel: string;
  anthropicEffort: Effort;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  level: ExamLevel;
  wordsPerSentence: number;
}

/** What the browser sees: secrets are masked, plus whether each service is usable. */
export type PublicSettings = Settings & { maimemoConfigured: boolean; llmConfigured: boolean };

export interface StudyProgress {
  finished: number;
  total: number;
  study_time: number;
}

export interface BriefNotepad {
  id: string;
  title: string;
  brief: string;
  tags: string[];
}

export interface SentenceSummary {
  id: string;
  source: SentenceSource;
  origin: string;
  level: ExamLevel;
  createdAt: string;
  sentence: string;
  targets: string[];
  chunkCount: number;
  attempts: number;
  best: number | null;
}

export interface Stats {
  attempts: number;
  sentences: number;
  average: number | null;
  sections: { chunking: number | null; skeleton: number | null; tagging: number | null; translation: number | null };
  labels: Array<{ label: LabelId; total: number; exact: number; partial: number; accuracy: number }>;
  weakLabels: LabelId[];
}

export interface PhraseWriteResult {
  word: string;
  ok: boolean;
  error?: string;
}
