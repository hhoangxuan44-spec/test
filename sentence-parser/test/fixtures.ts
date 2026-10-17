import type { RawAnalysis } from '../shared/types';

export const GENERATED: RawAnalysis = {
  sentence:
    'Although regulators insist that the new rules will curb reckless lending, critics who have studied earlier reforms argue that such measures merely mitigate the symptoms of a deeper problem.',
  chunks: [
    { text: 'Although regulators insist', label: 'adverbial_clause', depth: 1, modifies: 'argue', explanation: '让步状语从句', translation: '尽管监管者坚称' },
    { text: 'that the new rules will curb reckless lending,', label: 'object_clause', depth: 2, modifies: 'insist', explanation: '宾语从句', translation: '新规将遏制鲁莽放贷' },
    { text: 'critics', label: 'main', depth: 0, modifies: '', explanation: '主句主语', translation: '批评者' },
    { text: 'who have studied earlier reforms', label: 'relative_clause', depth: 1, modifies: 'critics', explanation: '定语从句', translation: '研究过早期改革的' },
    { text: 'argue', label: 'main', depth: 0, modifies: '', explanation: '主句谓语', translation: '认为' },
    {
      text: 'that such measures merely mitigate the symptoms of a deeper problem.',
      label: 'object_clause',
      depth: 0,
      modifies: 'argue',
      explanation: '宾语从句',
      translation: '这些措施只是缓解了更深层问题的症状',
    },
  ],
  skeleton: { subject: 'critics', predicate: 'argue', complement: 'that such measures merely mitigate the symptoms', summary: '批评者认为……' },
  targets: [
    { word: 'curb', form: 'curb', pos: 'v.', meaning: '遏制', note: 'curb inflation' },
    { word: 'mitigate', form: 'mitigate', pos: 'v.', meaning: '缓解', note: 'mitigate the impact' },
  ],
  vocabulary: [{ form: 'reckless', lemma: 'reckless', pos: 'adj.', meaning: '鲁莽的' }],
  translation: { literal: '直译', fluent: '意译' },
  difficulties: ['主语 critics 被定语从句隔开'],
};

/** Same content with a chunk that drifts from the sentence, as a model sometimes produces. */
export const GENERATED_BROKEN: RawAnalysis = {
  ...GENERATED,
  chunks: GENERATED.chunks.map((c, i) => (i === 3 ? { ...c, text: 'who studied earlier reforms' } : c)),
};

export function anthropicMessage(json: unknown, stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: JSON.stringify(json) }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}
