import { describe, expect, it } from 'vitest';
import { BUILTIN_RECORDS } from '../server/builtinSentences';
import { referenceSplits, scoreChunking, scoreSkeleton, scoreTagging } from '../shared/scoring';

describe('built-in sentence bank', () => {
  it('has unique ids and complete analyses', () => {
    expect(new Set(BUILTIN_RECORDS.map((r) => r.id)).size).toBe(BUILTIN_RECORDS.length);
    for (const { id, analysis: a } of BUILTIN_RECORDS) {
      expect(a.chunks.length, id).toBeGreaterThanOrEqual(3);
      expect(a.chunks[0].start, id).toBe(0);
      expect(a.chunks.at(-1)!.end, id).toBe(a.tokens.length - 1);
      a.chunks.slice(1).forEach((c, i) => expect(c.start, id).toBe(a.chunks[i].end + 1));
      expect(a.skeleton.subject.length, id).toBeGreaterThan(0);
      expect(a.skeleton.predicate.length, id).toBeGreaterThan(0);
      expect(a.targets.length, id).toBeGreaterThan(0);
      expect(a.difficulties.length, id).toBeGreaterThan(0);
      expect(a.translation.fluent, id).not.toBe('');
      for (const c of a.chunks) {
        expect(c.explanation, `${id}: ${c.text}`).not.toBe('');
        expect(c.translation, `${id}: ${c.text}`).not.toBe('');
        if (c.label !== 'main') expect(c.modifies, `${id}: ${c.text}`).not.toBe('');
      }
    }
  });

  it('scores a perfect answer as 100', () => {
    for (const { analysis: a } of BUILTIN_RECORDS) {
      const splits = referenceSplits(a.chunks);
      expect(scoreChunking(splits, splits).score).toBe(100);
      expect(scoreSkeleton(a.skeleton, a.skeleton, a.tokens).score).toBe(100);
      const labels = a.chunks.map((c) => c.label);
      expect(scoreTagging(labels, labels).score).toBe(100);
    }
  });
});
