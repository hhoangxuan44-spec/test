import type { LabelId } from './labels';

export const EXAM_LEVELS = {
  kaoyan1: { name: '考研英语一', words: '30-50', style: '多层嵌套，倒装、省略、插入常见；话题偏经济、科技、文化、法律、教育' },
  kaoyan2: { name: '考研英语二', words: '25-40', style: '结构相对清晰，以经济、管理、社会话题为主' },
  cet4: { name: '大学英语四级', words: '20-30', style: '一到两层从句，常见话题为校园、社会、科技' },
  cet6: { name: '大学英语六级', words: '25-40', style: '两层左右嵌套，学术与社会话题' },
  ielts: { name: '雅思', words: '25-40', style: '学术期刊与科普文章风格，信息密度高' },
  toefl: { name: '托福', words: '25-40', style: '大学教材式学术说明文，术语与定义多' },
  gre: { name: 'GRE', words: '35-60', style: '学术论述，逻辑转折与让步密集，抽象名词多' },
} as const;

export type ExamLevel = keyof typeof EXAM_LEVELS;

export function isExamLevel(value: unknown): value is ExamLevel {
  return typeof value === 'string' && Object.hasOwn(EXAM_LEVELS, value);
}

export interface VocabItem {
  form: string;
  lemma: string;
  pos: string;
  meaning: string;
}

export interface RawChunk {
  text: string;
  label: LabelId;
  depth: number;
  modifies: string;
  explanation: string;
  translation: string;
}

export interface RawTarget {
  word: string;
  form: string;
  pos: string;
  meaning: string;
  note: string;
}

/** Analysis as written by a person or a model: chunks and skeleton are quoted text. */
export interface RawAnalysis {
  sentence: string;
  chunks: RawChunk[];
  skeleton: { subject: string; predicate: string; complement: string; summary: string };
  targets: RawTarget[];
  vocabulary: VocabItem[];
  translation: { literal: string; fluent: string };
  difficulties: string[];
}

export interface Chunk {
  start: number;
  end: number;
  text: string;
  label: LabelId;
  depth: number;
  modifies: string;
  explanation: string;
  translation: string;
}

export type Role = 'subject' | 'predicate' | 'complement';

export const ROLE_NAMES: Record<Role, string> = {
  subject: '主语',
  predicate: '谓语',
  complement: '宾语 / 表语',
};

export interface TargetWord {
  word: string;
  form: string;
  tokens: number[];
  pos: string;
  meaning: string;
  note: string;
  vocId?: string;
}

/** Analysis aligned to the sentence's tokens; what the practice UI consumes. */
export interface Analysis {
  sentence: string;
  tokens: string[];
  chunks: Chunk[];
  skeleton: Record<Role, number[]> & { summary: string };
  targets: TargetWord[];
  vocabulary: VocabItem[];
  translation: { literal: string; fluent: string };
  difficulties: string[];
}

export type SentenceSource = 'builtin' | 'generated' | 'pasted';

export interface SentenceRecord {
  id: string;
  source: SentenceSource;
  origin: string;
  level: ExamLevel;
  createdAt: string;
  analysis: Analysis;
}

export type WordRating = 'known' | 'vague' | 'unknown';

export type TagResult = 'exact' | 'partial' | 'wrong' | 'empty';

export interface AttemptScores {
  chunking: number;
  skeleton: number;
  tagging: number;
  translation: number | null;
}

export interface Attempt {
  id: string;
  sentenceId: string;
  at: string;
  scores: AttemptScores;
  overall: number;
  labelResults: { label: LabelId; result: TagResult }[];
  wordRatings: { word: string; rating: WordRating }[];
  translation?: string;
}

export interface TranslationIssue {
  type: string;
  detail: string;
}

export interface TranslationGrade {
  score: number;
  verdict: string;
  issues: TranslationIssue[];
  improved: string;
}

export type StudyResponse = 'FAMILIAR' | 'VAGUE' | 'FORGET' | 'WELL_FAMILIAR' | 'CANCEL_WELL_FAMILIAR' | 'STUDY_RESPONSE_UNSPECIFIED';

/** A word offered for practice, merged from MaiMemo today items / records / notepads. */
export interface PracticeWord {
  spelling: string;
  vocId?: string;
  isNew?: boolean;
  isFinished?: boolean;
  firstResponse?: StudyResponse;
  sticking?: boolean;
  usedCount: number;
}
