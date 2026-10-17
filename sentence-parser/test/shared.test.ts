import { describe, expect, it } from 'vitest';
import { normalizeAnalysis } from '../shared/analysis';
import { judgeLabel, judgeRole, overallScore, referenceSplits, scoreChunking, scoreSkeleton, scoreTagging } from '../shared/scoring';
import { alignChunks, alignPhrase, cleanSentence, findWordForm, normalizeWord, tokenize } from '../shared/tokenize';
import type { RawAnalysis } from '../shared/types';

const SENTENCE =
  'Of all the changes that have taken place in English-language newspapers during the past quarter-century, perhaps the most far-reaching has been the inexorable decline in the scope and seriousness of their arts coverage.';

function raw(overrides: Partial<RawAnalysis> = {}): RawAnalysis {
  return {
    sentence: SENTENCE,
    chunks: [
      { text: 'Of all the changes', label: 'prep_phrase', depth: 1, modifies: 'the most far-reaching', explanation: '', translation: '在所有变化中' },
      { text: 'that have taken place in English-language newspapers', label: 'relative_clause', depth: 2, modifies: 'changes', explanation: '', translation: '英文报纸发生的' },
      { text: 'during the past quarter-century,', label: 'prep_phrase', depth: 2, modifies: 'have taken place', explanation: '', translation: '过去25年里' },
      { text: 'perhaps the most far-reaching has been the inexorable decline', label: 'main', depth: 0, modifies: '', explanation: '', translation: '影响最深远的也许是不可阻挡的衰落' },
      { text: 'in the scope and seriousness of their arts coverage.', label: 'prep_phrase', depth: 1, modifies: 'decline', explanation: '', translation: '艺术报道范围和严肃性上的' },
    ],
    skeleton: { subject: 'the most far-reaching', predicate: 'has been', complement: 'the inexorable decline', summary: '影响最深远的是衰落' },
    targets: [{ word: 'inexorable', form: 'inexorable', pos: 'adj.', meaning: '不可阻挡的', note: '' }],
    vocabulary: [
      { form: 'coverage', lemma: 'coverage', pos: 'n.', meaning: '新闻报道' },
      { form: 'nonexistent', lemma: 'nonexistent', pos: 'adj.', meaning: '不存在' },
    ],
    translation: { literal: '直译', fluent: '意译' },
    difficulties: ['主谓倒装', '  '],
    ...overrides,
  };
}

describe('tokenize helpers', () => {
  it('normalizes punctuation and dashes', () => {
    expect(cleanSentence('First two hours—now  three hours  --  this')).toBe('First two hours — now three hours — this');
    expect(cleanSentence('it’s “quoted”')).toBe('it\'s "quoted"');
    expect(normalizeWord('"Hello,')).toBe('hello');
    expect(normalizeWord('—')).toBe('');
    expect(normalizeWord('U.S.')).toBe('u.s');
    expect(normalizeWord("2006's")).toBe("2006's");
  });

  it('aligns chunks and attaches stray punctuation to the earlier chunk', () => {
    const tokens = tokenize('First two hours , now three hours — this is how far');
    const result = alignChunks(tokens, ['First two hours, now three hours', 'this is how far']);
    expect(result).toEqual({ ok: true, ranges: [[0, 7], [8, 11]] });
  });

  it('reports where chunk text diverges from the sentence', () => {
    const tokens = tokenize('The idea that some groups may be smarter is old.');
    const bad = alignChunks(tokens, ['The idea', 'that some group may be smarter', 'is old.']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('groups');
    const short = alignChunks(tokens, ['The idea', 'that some groups may be smarter']);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toContain('is');
    const long = alignChunks(tokens, ['The idea that some groups may be smarter is old. Really']);
    expect(long.ok).toBe(false);
  });

  it('finds phrases with gaps and prefers the main clause', () => {
    const gap = tokenize('The man who has a car has perhaps been here.');
    expect(alignPhrase(gap, 'has been')).toEqual([6, 8]);
    const tokens = tokenize('The man who has been here has perhaps been away.');
    expect(alignPhrase(tokens, 'has been')).toEqual([3, 4]);
    expect(alignPhrase(tokens, 'has been', new Set([0, 1, 6, 7, 8, 9]))).toEqual([6, 8]);
    expect(alignPhrase(tokens, 'nothing here')).toBeNull();
    expect(alignPhrase(tokens, '')).toEqual([]);
  });

  it('finds inflected forms of a vocabulary word', () => {
    const tokens = tokenize('Officials mitigated the damage and applied new rules.');
    expect(findWordForm(tokens, 'mitigates', 'mitigate')).toEqual([1]);
    expect(findWordForm(tokens, 'apply', 'apply')).toEqual([5]);
    expect(findWordForm(tokens, 'rule', 'rule')).toEqual([7]);
    expect(findWordForm(tokens, 'policy', 'policy')).toBeNull();
  });
});

describe('normalizeAnalysis', () => {
  it('aligns chunks, skeleton, targets and filters vocabulary', () => {
    const result = normalizeAnalysis(raw(), { requiredTargets: ['inexorable'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.analysis;
    expect(a.chunks.map((c) => [c.start, c.end])).toEqual([[0, 3], [4, 10], [11, 14], [15, 23], [24, 32]]);
    expect(a.chunks[0].modifies).toBe('the most far-reaching');
    expect(a.chunks[3].modifies).toBe('');
    expect(a.skeleton.subject.map((i) => a.tokens[i])).toEqual(['the', 'most', 'far-reaching']);
    expect(a.skeleton.predicate.map((i) => a.tokens[i])).toEqual(['has', 'been']);
    expect(a.skeleton.complement.map((i) => a.tokens[i])).toEqual(['the', 'inexorable', 'decline']);
    expect(a.targets[0]).toMatchObject({ word: 'inexorable', form: 'inexorable', tokens: [22] });
    expect(a.vocabulary.map((v) => v.lemma)).toEqual(['coverage']);
    expect(a.difficulties).toEqual(['主谓倒装']);
  });

  it('uses the pasted sentence rather than the model echo', () => {
    const result = normalizeAnalysis(raw({ sentence: 'something else entirely' }), { sentence: SENTENCE });
    expect(result.ok).toBe(true);
  });

  it('collects every problem for the retry prompt', () => {
    const result = normalizeAnalysis(
      raw({
        skeleton: { subject: 'the newspapers ate', predicate: '', complement: '', summary: '' },
        targets: [{ word: 'mitigate', form: 'mitigated', pos: 'v.', meaning: '', note: '' }],
      }),
      { requiredTargets: ['mitigate', 'curb'], minWords: 40 },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join('\n')).toMatch(/少于要求的 40/);
    expect(result.errors.join('\n')).toMatch(/主语「the newspapers ate」/);
    expect(result.errors.join('\n')).toMatch(/主干缺少谓语/);
    expect(result.errors.join('\n')).toMatch(/mitigate/);
    expect(result.errors.join('\n')).toMatch(/缺少目标词「curb」/);
  });

  it('fails fast when chunks do not cover the sentence', () => {
    const r = raw();
    r.chunks = r.chunks.slice(0, 3);
    const result = normalizeAnalysis(r);
    expect(result.ok).toBe(false);
  });
});

describe('scoring', () => {
  const result = normalizeAnalysis(raw());
  if (!result.ok) throw new Error('fixture must normalize');
  const a = result.analysis;

  it('scores chunking with half penalty for extra cuts', () => {
    const ref = referenceSplits(a.chunks);
    expect(ref).toEqual([3, 10, 14, 23]);
    expect(scoreChunking(ref, ref).score).toBe(100);
    const s = scoreChunking([3, 10, 20], ref);
    expect(s.hits).toEqual([3, 10]);
    expect(s.misses).toEqual([14, 23]);
    expect(s.extras).toEqual([20]);
    expect(s.score).toBe(Math.round((100 * 2) / 4.5));
    expect(scoreChunking([], []).score).toBe(100);
  });

  it('gives partial credit within a label family', () => {
    expect(judgeLabel('relative_clause', 'relative_clause')).toBe('exact');
    expect(judgeLabel('nonfinite_attributive', 'relative_clause')).toBe('partial');
    expect(judgeLabel('appositive_clause', 'relative_clause')).toBe('wrong');
    expect(judgeLabel('prep_phrase', 'main')).toBe('wrong');
    expect(judgeLabel(null, 'main')).toBe('empty');
    expect(scoreTagging(['main', 'object_clause', null], ['main', 'subject_clause', 'prep_phrase']).score).toBe(50);
  });

  it('accepts a subset of the reference role but not modifiers', () => {
    const t = a.tokens;
    expect(judgeRole([17], a.skeleton.subject, t)).toBe(true);
    expect(judgeRole([16, 17, 18], a.skeleton.subject, t)).toBe(true);
    expect(judgeRole([17, 18, 19], a.skeleton.subject, t)).toBe(false);
    expect(judgeRole([21, 22, 23, 24, 25], a.skeleton.complement, t)).toBe(false);
    expect(judgeRole([], [], t)).toBe(true);
    expect(judgeRole([3], [], t)).toBe(false);
    const s = scoreSkeleton({ subject: [18], predicate: [20], complement: [] }, a.skeleton, t);
    expect(s.results).toEqual({ subject: true, predicate: true, complement: false });
    expect(s.score).toBe(67);
  });

  it('averages the available section scores', () => {
    expect(overallScore({ chunking: 80, skeleton: 100, tagging: 60, translation: null })).toBe(80);
    expect(overallScore({ chunking: 80, skeleton: 100, tagging: 60, translation: 40 })).toBe(70);
  });
});
