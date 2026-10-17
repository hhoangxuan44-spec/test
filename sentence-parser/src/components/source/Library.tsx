import { useEffect, useState } from 'react';
import type { SentenceSummary } from '../../../shared/api';
import { EXAM_LEVELS, type SentenceSource } from '../../../shared/types';
import { api } from '../../api';
import { Button, ErrorBox, Segmented, Spinner } from '../ui';

type Filter = 'all' | SentenceSource;

const SOURCE_BADGE: Record<SentenceSource, string> = {
  builtin: 'bg-amber-50 text-amber-800',
  generated: 'bg-indigo-50 text-indigo-700',
  pasted: 'bg-slate-100 text-slate-700',
};

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<SentenceSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = () => {
    api
      .sentences()
      .then((r) => {
        setError(null);
        setItems(r.sentences);
      })
      .catch(setError);
  };
  useEffect(load, []);

  const remove = async (s: SentenceSummary) => {
    if (!window.confirm(`删除这个句子和它的分析？\n\n${s.sentence}`)) return;
    try {
      await api.deleteSentence(s.id);
      setItems((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (e) {
      setError(e);
    }
  };

  if (!items) return error ? <ErrorBox error={error} onRetry={load} /> : <Spinner className="text-slate-400" />;
  const shown = items.filter((s) => filter === 'all' || s.source === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `全部 ${items.length}` },
            { value: 'builtin', label: '考研真题' },
            { value: 'generated', label: 'AI 出题' },
            { value: 'pasted', label: '粘贴的' },
          ]}
        />
        <span className="text-xs text-slate-500">真题句子不需要 AI，打开就能练</span>
      </div>
      <ErrorBox error={error} />
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">这里还没有句子。</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <li key={s.id} className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300">
              <button type="button" onClick={() => onOpen(s.id)} className="min-w-0 flex-1 text-left">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${SOURCE_BADGE[s.source]}`}>{s.origin}</span>
                  <span className="text-slate-500">{EXAM_LEVELS[s.level].name}</span>
                  {s.targets.length > 0 && <span className="text-indigo-600">{s.targets.join('、')}</span>}
                  <span className="text-slate-400">
                    {s.attempts > 0 ? `练过 ${s.attempts} 次 · 最高 ${s.best} 分` : '未练习'}
                  </span>
                </div>
                <p className="line-clamp-2 font-serif text-base text-slate-900">{s.sentence}</p>
              </button>
              {s.source !== 'builtin' && (
                <Button variant="danger" className="opacity-60 group-hover:opacity-100" onClick={() => void remove(s)} aria-label="删除">
                  删除
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
