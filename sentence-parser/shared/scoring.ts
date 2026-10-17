import { LABELS, type LabelId } from './labels';
import { normalizeWord } from './tokenize';
import type { AttemptScores, Chunk, Role, TagResult } from './types';

/** Token indices after which the reference chunking splits the sentence. */
export function referenceSplits(chunks: Chunk[]): number[] {
  return chunks.slice(0, -1).map((c) => c.end);
}

export interface ChunkingScore {
  hits: number[];
  misses: number[];
  extras: number[];
  score: number;
}

/** Missing a reference boundary costs a full point; an extra cut costs half, since finer cuts are often defensible. */
export function scoreChunking(user: number[], reference: number[]): ChunkingScore {
  const userSet = new Set(user);
  const refSet = new Set(reference);
  const hits = reference.filter((i) => userSet.has(i));
  const misses = reference.filter((i) => !userSet.has(i));
  const extras = [...userSet].filter((i) => !refSet.has(i)).sort((a, b) => a - b);
  const denominator = refSet.size + 0.5 * extras.length;
  const score = denominator === 0 ? 100 : Math.round((100 * hits.length) / denominator);
  return { hits, misses, extras, score };
}

export function judgeLabel(user: LabelId | null | undefined, reference: LabelId): TagResult {
  if (!user) return 'empty';
  if (user === reference) return 'exact';
  const family = LABELS[reference].family;
  const partialFamilies = new Set(['nominal', 'attributive', 'adverbial', 'insert']);
  return partialFamilies.has(family) && LABELS[user].family === family ? 'partial' : 'wrong';
}

export function scoreTagging(user: Array<LabelId | null | undefined>, reference: LabelId[]): { results: TagResult[]; score: number } {
  const results = reference.map((ref, i) => judgeLabel(user[i], ref));
  const points = results.reduce((sum, r) => sum + (r === 'exact' ? 1 : r === 'partial' ? 0.5 : 0), 0);
  return { results, score: reference.length === 0 ? 100 : Math.round((100 * points) / reference.length) };
}

const ARTICLES = new Set(['a', 'an', 'the']);

/**
 * A role is right when the learner picked some of the reference words and nothing
 * outside them (articles excepted): "idea" for "the idea" passes, "idea that…" does not.
 */
export function judgeRole(user: number[], reference: number[], tokens: string[]): boolean {
  if (reference.length === 0) return user.length === 0;
  const ref = new Set(reference);
  const overlap = user.some((i) => ref.has(i));
  const extrasOk = user.filter((i) => !ref.has(i)).every((i) => ARTICLES.has(normalizeWord(tokens[i] ?? '')));
  return overlap && extrasOk;
}

export const ROLES: Role[] = ['subject', 'predicate', 'complement'];

export function scoreSkeleton(
  user: Record<Role, number[]>,
  reference: Record<Role, number[]>,
  tokens: string[],
): { results: Record<Role, boolean>; score: number } {
  const results = {
    subject: judgeRole(user.subject, reference.subject, tokens),
    predicate: judgeRole(user.predicate, reference.predicate, tokens),
    complement: judgeRole(user.complement, reference.complement, tokens),
  };
  const correct = ROLES.filter((r) => results[r]).length;
  return { results, score: Math.round((100 * correct) / ROLES.length) };
}

export function overallScore(scores: AttemptScores): number {
  const parts = [scores.chunking, scores.skeleton, scores.tagging];
  if (scores.translation !== null) parts.push(scores.translation);
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}
