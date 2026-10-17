export function cleanSentence(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*([—–])\s*/g, ' $1 ')
    .replace(/\s+--\s+|(?<=\w)--(?=\w)/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(sentence: string): string[] {
  return sentence.split(/\s+/).filter(Boolean);
}

/** Lower-cased word without surrounding punctuation; empty for punctuation-only tokens. */
export function normalizeWord(token: string): string {
  return token
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export type AlignResult = { ok: true; ranges: Array<[number, number]> } | { ok: false; error: string };

/**
 * Maps chunk texts onto sentence tokens. Chunks must cover every word of the
 * sentence in order; punctuation-only tokens between chunks join the earlier chunk.
 */
export function alignChunks(tokens: string[], chunkTexts: string[]): AlignResult {
  const words = tokens
    .map((t, i) => ({ i, w: normalizeWord(t) }))
    .filter((x) => x.w !== '');
  if (chunkTexts.length === 0) return { ok: false, error: '没有任何意群' };

  let p = 0;
  const starts: number[] = [];
  for (let c = 0; c < chunkTexts.length; c++) {
    const label = `第 ${c + 1} 个意群「${chunkTexts[c]}」`;
    const chunkWords = tokenize(chunkTexts[c]).map(normalizeWord).filter(Boolean);
    if (chunkWords.length === 0) return { ok: false, error: `${label}是空的` };
    for (let k = 0; k < chunkWords.length; k++) {
      if (p >= words.length) return { ok: false, error: `${label}超出了原句末尾` };
      if (words[p].w !== chunkWords[k]) {
        return {
          ok: false,
          error: `${label}与原句不一致：原句此处是「${tokens[words[p].i]}」，意群里却是「${chunkWords[k]}」`,
        };
      }
      if (k === 0) starts.push(c === 0 ? 0 : words[p].i);
      p++;
    }
  }
  if (p < words.length) {
    return { ok: false, error: `意群没有覆盖整句，缺少从「${tokens[words[p].i]}」开始的部分` };
  }
  const ranges = starts.map((s, c): [number, number] => [s, c + 1 < starts.length ? starts[c + 1] - 1 : tokens.length - 1]);
  return { ok: true, ranges };
}

/**
 * Finds the words of `phrase` in order (allowing a few tokens in between, e.g.
 * "has been" in "has perhaps been"). Starts inside `prefer` are tried first.
 */
export function alignPhrase(tokens: string[], phrase: string, prefer?: Set<number>, maxGap = 3): number[] | null {
  const want = tokenize(phrase).map(normalizeWord).filter(Boolean);
  if (want.length === 0) return [];
  const norm = tokens.map(normalizeWord);
  const all = norm.map((_, i) => i);
  const order = prefer ? [...all.filter((i) => prefer.has(i)), ...all.filter((i) => !prefer.has(i))] : all;

  for (const s of order) {
    if (norm[s] !== want[0]) continue;
    const found = [s];
    let last = s;
    for (let k = 1; k < want.length; k++) {
      let next = -1;
      for (let j = last + 1; j < norm.length && j <= last + 1 + maxGap; j++) {
        if (norm[j] === want[k]) {
          next = j;
          break;
        }
      }
      if (next < 0) break;
      found.push(next);
      last = next;
    }
    if (found.length === want.length) return found;
  }
  return null;
}

/** Locates a vocabulary word that may appear inflected ("mitigate" → "mitigated"). */
export function findWordForm(tokens: string[], form: string, lemma: string): number[] | null {
  const exact = alignPhrase(tokens, form, undefined, 2) ?? alignPhrase(tokens, lemma, undefined, 2);
  if (exact && exact.length > 0) return exact;
  const base = normalizeWord(lemma);
  if (base.includes(' ') || base.length < 4) return null;
  const stem = base.slice(0, Math.max(4, base.length - 2));
  const idx = tokens.findIndex((t) => normalizeWord(t).startsWith(stem));
  return idx >= 0 ? [idx] : null;
}
