import { useState } from 'react';
import { FAMILY_NAMES, LABEL_IDS, LABELS, type LabelFamily, type LabelId } from '../../../shared/labels';
import type { Analysis, TagResult } from '../../../shared/types';
import { LabelBadge } from '../sentence';
import { Button, Notice } from '../ui';

const FAMILIES: LabelFamily[] = ['main', 'nominal', 'attributive', 'adverbial', 'prep', 'insert', 'coordinate'];

const RESULT_TEXT: Record<TagResult, { icon: string; cls: string; text: string }> = {
  exact: { icon: '✓', cls: 'text-emerald-600', text: '正确' },
  partial: { icon: '½', cls: 'text-amber-600', text: '接近（同一大类）' },
  wrong: { icon: '✗', cls: 'text-rose-600', text: '不对' },
  empty: { icon: '✗', cls: 'text-rose-600', text: '未选' },
};

interface Props {
  analysis: Analysis;
  tags: Array<LabelId | null>;
  onChange: (tags: Array<LabelId | null>) => void;
  result: { results: TagResult[]; score: number } | null;
  onCheck: () => void;
  onNext: () => void;
}

export function TagStep({ analysis, tags, onChange, result, onCheck, onNext }: Props) {
  const [legend, setLegend] = useState(false);
  const missing = tags.filter((t) => !t).length;

  return (
    <div className="space-y-5">
      <Notice>
        给每个意群选一个成分：它是主干的一部分，还是从句、非谓语、介词短语、插入语……同一大类里选错（比如定语从句选成非谓语作定语）得一半分。
        <button type="button" onClick={() => setLegend((v) => !v)} className="ml-2 font-medium text-indigo-700 underline">
          {legend ? '收起标签说明' : '查看标签说明'}
        </button>
      </Notice>

      {legend && (
        <dl className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
          {LABEL_IDS.map((id) => (
            <div key={id} className="flex gap-2">
              <dt>
                <LabelBadge label={id} />
              </dt>
              <dd className="text-slate-600">{LABELS[id].hint}</dd>
            </div>
          ))}
        </dl>
      )}

      <ol className="space-y-3">
        {analysis.chunks.map((chunk, i) => {
          const r = result?.results[i];
          return (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="font-serif text-lg text-slate-900">
                  <span className="mr-2 font-sans text-xs text-slate-400">{i + 1}</span>
                  {chunk.text}
                </p>
                <select
                  aria-label={`第 ${i + 1} 个意群的成分`}
                  value={tags[i] ?? ''}
                  disabled={!!result}
                  onChange={(e) => onChange(tags.map((t, k) => (k === i ? (e.target.value as LabelId) : t)))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:w-56"
                >
                  <option value="" disabled>
                    选择成分…
                  </option>
                  {FAMILIES.map((f) => (
                    <optgroup key={f} label={FAMILY_NAMES[f]}>
                      {LABEL_IDS.filter((id) => LABELS[id].family === f).map((id) => (
                        <option key={id} value={id}>
                          {LABELS[id].name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {tags[i] && !result && <p className="mt-2 text-xs text-slate-500">{LABELS[tags[i]!].hint}</p>}
              {r && (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${RESULT_TEXT[r].cls}`}>
                      {RESULT_TEXT[r].icon} {RESULT_TEXT[r].text}
                    </span>
                    <span className="text-slate-500">参考答案</span>
                    <LabelBadge label={chunk.label} />
                    {chunk.modifies && <span className="text-slate-500">→ {chunk.modifies}</span>}
                  </p>
                  <p className="text-slate-600">{chunk.explanation}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!result ? (
        <div className="flex items-center justify-end gap-3">
          {missing > 0 && <span className="text-sm text-slate-500">还有 {missing} 块没选</span>}
          <Button onClick={onCheck} disabled={missing > 0}>
            检查成分
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">成分得分 {result.score}</p>
          <Button onClick={onNext}>下一步：翻译 →</Button>
        </div>
      )}
    </div>
  );
}
