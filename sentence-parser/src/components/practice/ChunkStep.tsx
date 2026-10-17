import { useMemo, useState } from 'react';
import { referenceSplits, type ChunkingScore } from '../../../shared/scoring';
import { normalizeWord } from '../../../shared/tokenize';
import type { Analysis } from '../../../shared/types';
import { SentenceTokens } from '../sentence';
import { Button, Notice } from '../ui';

const SIGNAL_WORDS = new Set([
  'that', 'which', 'who', 'whom', 'whose', 'what', 'whatever', 'when', 'where', 'why', 'how', 'whether', 'if',
  'because', 'although', 'though', 'while', 'since', 'as', 'unless', 'until', 'once', 'after', 'before', 'than',
  'and', 'but', 'or', 'so', 'to', 'in', 'on', 'at', 'of', 'for', 'with', 'by', 'from', 'during', 'among', 'over',
  'into', 'through', 'without', 'within', 'despite', 'like',
]);

interface Props {
  analysis: Analysis;
  splits: number[];
  onChange: (splits: number[]) => void;
  result: ChunkingScore | null;
  onCheck: () => void;
  onNext: () => void;
}

export function ChunkStep({ analysis, splits, onChange, result, onCheck, onNext }: Props) {
  const [hints, setHints] = useState(false);
  const { tokens } = analysis;
  const targets = useMemo(() => new Set(analysis.targets.flatMap((t) => t.tokens)), [analysis]);
  const reference = useMemo(() => new Set(referenceSplits(analysis.chunks)), [analysis]);
  const chosen = new Set(splits);

  const toggle = (i: number) => onChange(chosen.has(i) ? splits.filter((s) => s !== i) : [...splits, i].sort((a, b) => a - b));

  const gap = (i: number) => {
    if (!result) {
      return (
        <button
          type="button"
          onClick={() => toggle(i)}
          aria-label={`在「${tokens[i]}」后面切分`}
          aria-pressed={chosen.has(i)}
          className="group flex h-9 w-4 items-center justify-center"
        >
          <span className={`text-2xl font-bold leading-none ${chosen.has(i) ? 'text-red-500' : 'text-transparent group-hover:text-red-300'}`}>/</span>
        </button>
      );
    }
    const mark = (cls: string, title: string, glyph = '/') => (
      <span title={title} className={`flex h-9 w-4 items-center justify-center text-2xl font-bold leading-none ${cls}`}>
        {glyph}
      </span>
    );
    if (chosen.has(i) && reference.has(i)) return mark('text-emerald-500', '切对了');
    if (chosen.has(i)) return mark('text-red-400 line-through', '这里不必切');
    if (reference.has(i)) return mark('text-amber-500', '这里漏切了', '¦');
    return <span className="w-1.5" />;
  };

  return (
    <div className="space-y-5">
      <Notice>
        点击两个单词之间的空隙，把句子切成<strong>意群</strong>：从句、非谓语短语、介词短语、插入语的开头和结尾都是切分点。先别管中文意思，只看结构。
      </Notice>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
        <SentenceTokens
          tokens={tokens}
          targets={targets}
          gap={gap}
          tokenClass={(i) => (hints && !result && SIGNAL_WORDS.has(normalizeWord(tokens[i])) ? 'bg-yellow-200' : '')}
        />
      </div>

      {!result ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setHints((v) => !v)}>
              {hints ? '隐藏标志词' : '提示：标出连接词和介词'}
            </Button>
            {splits.length > 0 && (
              <Button variant="ghost" onClick={() => onChange([])}>
                清空
              </Button>
            )}
          </div>
          <Button onClick={onCheck}>检查断句（已切 {splits.length} 刀）</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-lg font-semibold">断句得分 {result.score}</span>
            <span className="text-emerald-600">切对 {result.hits.length} 处</span>
            <span className="text-amber-600">漏切 {result.misses.length} 处（¦）</span>
            <span className="text-red-500">多切 {result.extras.length} 处</span>
          </div>
          {result.extras.length > 0 && <p className="text-sm text-slate-500">多切的地方不一定算错，切得更细也能接受，但要说得出每一块是什么成分。</p>}
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">参考切分</h3>
            <ol className="flex flex-wrap gap-2">
              {analysis.chunks.map((c, i) => (
                <li key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-serif text-base">
                  <span className="mr-1.5 font-sans text-xs text-slate-400">{i + 1}</span>
                  {c.text}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex justify-end">
            <Button onClick={onNext}>下一步：抓主干 →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
