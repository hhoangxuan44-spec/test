import type { PracticeWord } from './types';

export function wordPriority(w: PracticeWord): number {
  if (w.firstResponse === 'FORGET') return 4;
  if (w.sticking || w.firstResponse === 'VAGUE') return 3;
  if (w.isNew) return 2;
  if (w.firstResponse === 'WELL_FAMILIAR') return 0;
  return 1;
}

/** Least-practised words first, so every word gets a sentence; among those, the shakiest first. */
export function pickWords(words: PracticeWord[], count: number): PracticeWord[] {
  return words
    .map((w, i) => ({ w, i }))
    .sort((a, b) => a.w.usedCount - b.w.usedCount || wordPriority(b.w) - wordPriority(a.w) || a.i - b.i)
    .slice(0, count)
    .map((x) => x.w);
}
