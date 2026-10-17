import { alignChunks, alignPhrase, cleanSentence, findWordForm, normalizeWord, tokenize } from './tokenize';
import type { Analysis, Chunk, RawAnalysis, TargetWord } from './types';

export type NormalizeResult = { ok: true; analysis: Analysis } | { ok: false; errors: string[] };

export interface NormalizeOptions {
  /** Use this sentence instead of `raw.sentence` (pasted text must not be rewritten by the model). */
  sentence?: string;
  /** Words that must appear in the sentence and in `targets`. */
  requiredTargets?: string[];
  minWords?: number;
  maxWords?: number;
}

export function normalizeAnalysis(raw: RawAnalysis, options: NormalizeOptions = {}): NormalizeResult {
  const errors: string[] = [];
  const sentence = cleanSentence(options.sentence ?? raw.sentence);
  const tokens = tokenize(sentence);
  const wordCount = tokens.filter((t) => normalizeWord(t) !== '').length;
  if (options.minWords && wordCount < options.minWords) errors.push(`句子只有 ${wordCount} 个词，少于要求的 ${options.minWords} 个`);
  if (options.maxWords && wordCount > options.maxWords) errors.push(`句子有 ${wordCount} 个词，超过上限 ${options.maxWords} 个`);

  const aligned = alignChunks(tokens, raw.chunks.map((c) => cleanSentence(c.text)));
  if (!aligned.ok) return { ok: false, errors: [...errors, aligned.error] };

  const chunks: Chunk[] = raw.chunks.map((c, i) => {
    const [start, end] = aligned.ranges[i];
    return {
      start,
      end,
      text: tokens.slice(start, end + 1).join(' '),
      label: c.label,
      depth: Math.min(4, Math.max(0, Math.round(c.depth))),
      modifies: c.label === 'main' ? '' : c.modifies.trim(),
      explanation: c.explanation.trim(),
      translation: c.translation.trim(),
    };
  });
  if (!chunks.some((c) => c.depth === 0)) errors.push('没有任何 depth 为 0 的意群（主句层）');

  const mainTokens = new Set<number>();
  for (const c of chunks) {
    if (c.depth === 0) for (let i = c.start; i <= c.end; i++) mainTokens.add(i);
  }
  const findRole = (name: string, phrase: string, required: boolean): number[] => {
    if (!phrase.trim()) {
      if (required) errors.push(`主干缺少${name}`);
      return [];
    }
    const idx = alignPhrase(tokens, phrase, mainTokens);
    if (!idx) {
      errors.push(`主干的${name}「${phrase}」在句子里找不到（需逐词照抄原句）`);
      return [];
    }
    return idx;
  };
  const skeleton = {
    subject: findRole('主语', raw.skeleton.subject, true),
    predicate: findRole('谓语', raw.skeleton.predicate, true),
    complement: findRole('宾语/表语', raw.skeleton.complement, false),
    summary: raw.skeleton.summary.trim(),
  };

  const targets: TargetWord[] = [];
  for (const t of raw.targets) {
    const idx = findWordForm(tokens, t.form, t.word);
    if (!idx) {
      errors.push(`目标词「${t.word}」（形式「${t.form}」）没有出现在句子里`);
      continue;
    }
    targets.push({
      word: t.word.trim(),
      form: tokens.slice(idx[0], idx[idx.length - 1] + 1).join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''),
      tokens: idx,
      pos: t.pos.trim(),
      meaning: t.meaning.trim(),
      note: t.note.trim(),
    });
  }
  for (const required of options.requiredTargets ?? []) {
    const key = required.trim().toLowerCase();
    if (!targets.some((t) => t.word.toLowerCase() === key)) {
      if (!raw.targets.some((t) => t.word.trim().toLowerCase() === key)) {
        errors.push(`缺少目标词「${required}」的解释（targets 里必须逐个列出）`);
      }
    }
  }

  const targetWords = new Set(targets.map((t) => t.word.toLowerCase()));
  const vocabulary = raw.vocabulary.filter(
    (v) => !targetWords.has(v.lemma.toLowerCase()) && findWordForm(tokens, v.form, v.lemma) !== null,
  );

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    analysis: {
      sentence,
      tokens,
      chunks,
      skeleton,
      targets,
      vocabulary,
      translation: { literal: raw.translation.literal.trim(), fluent: raw.translation.fluent.trim() },
      difficulties: raw.difficulties.map((d) => d.trim()).filter(Boolean),
    },
  };
}
