import { join } from 'node:path';
import type { Stats } from '../shared/api';
import { LABEL_IDS } from '../shared/labels';
import type { Attempt, SentenceRecord } from '../shared/types';
import { JsonFile, readJson } from './files';

interface DbShape {
  version: 1;
  sentences: SentenceRecord[];
  attempts: Attempt[];
  /** lower-cased spelling → number of generated sentences that used it */
  wordUsage: Record<string, number>;
  /** sentence id → spellings whose MaiMemo phrase list already holds this sentence */
  phraseWrites: Record<string, string[]>;
}

const empty = (): DbShape => ({ version: 1, sentences: [], attempts: [], wordUsage: {}, phraseWrites: {} });

function average(values: number[]): number | null {
  return values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export class Db {
  private data: DbShape;
  private readonly file: JsonFile<DbShape>;

  private constructor(dataDir: string, data: DbShape) {
    this.file = new JsonFile(join(dataDir, 'db.json'));
    this.data = data;
  }

  static async open(dataDir: string): Promise<Db> {
    const loaded = await readJson<Partial<DbShape>>(join(dataDir, 'db.json'));
    return new Db(dataDir, { ...empty(), ...loaded });
  }

  private save(): Promise<void> {
    return this.file.write(this.data);
  }

  sentences(): SentenceRecord[] {
    return this.data.sentences;
  }

  sentence(id: string): SentenceRecord | undefined {
    return this.data.sentences.find((s) => s.id === id);
  }

  async addSentence(record: SentenceRecord, usedWords: string[] = []): Promise<void> {
    this.data.sentences.push(record);
    for (const w of usedWords) {
      const key = w.toLowerCase();
      this.data.wordUsage[key] = (this.data.wordUsage[key] ?? 0) + 1;
    }
    await this.save();
  }

  async deleteSentence(id: string): Promise<boolean> {
    const before = this.data.sentences.length;
    this.data.sentences = this.data.sentences.filter((s) => s.id !== id);
    if (this.data.sentences.length === before) return false;
    delete this.data.phraseWrites[id];
    await this.save();
    return true;
  }

  usage(spelling: string): number {
    return this.data.wordUsage[spelling.toLowerCase()] ?? 0;
  }

  phraseWrites(sentenceId: string): string[] {
    return this.data.phraseWrites[sentenceId] ?? [];
  }

  async markPhraseWritten(sentenceId: string, spellings: string[]): Promise<void> {
    const set = new Set([...this.phraseWrites(sentenceId), ...spellings.map((s) => s.toLowerCase())]);
    this.data.phraseWrites[sentenceId] = [...set];
    await this.save();
  }

  attempts(): Attempt[] {
    return this.data.attempts;
  }

  async addAttempt(attempt: Attempt): Promise<void> {
    this.data.attempts.push(attempt);
    await this.save();
  }

  stats(): Stats {
    const attempts = this.data.attempts;
    const pick = (key: keyof Attempt['scores']) =>
      average(attempts.map((a) => a.scores[key]).filter((v): v is number => typeof v === 'number'));

    const labels = LABEL_IDS.map((label) => {
      const results = attempts.flatMap((a) => a.labelResults.filter((r) => r.label === label));
      const exact = results.filter((r) => r.result === 'exact').length;
      const partial = results.filter((r) => r.result === 'partial').length;
      const total = results.length;
      return { label, total, exact, partial, accuracy: total === 0 ? 1 : (exact + partial * 0.5) / total };
    }).filter((l) => l.total > 0);

    const weakLabels = labels
      .filter((l) => l.total >= 3 && l.accuracy < 0.6)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 2)
      .map((l) => l.label);

    return {
      attempts: attempts.length,
      sentences: new Set(attempts.map((a) => a.sentenceId)).size,
      average: average(attempts.map((a) => a.overall)),
      sections: { chunking: pick('chunking'), skeleton: pick('skeleton'), tagging: pick('tagging'), translation: pick('translation') },
      labels: labels.sort((a, b) => a.accuracy - b.accuracy),
      weakLabels,
    };
  }
}
