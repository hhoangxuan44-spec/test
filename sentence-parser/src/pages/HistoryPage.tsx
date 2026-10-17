import { useEffect, useState } from 'react';
import type { Stats } from '../../shared/api';
import { LABELS } from '../../shared/labels';
import type { Attempt } from '../../shared/types';
import { api } from '../api';
import { LabelBadge } from '../components/sentence';
import { Card, ErrorBox, ScoreBadge, Segmented, Spinner } from '../components/ui';

type Row = Attempt & { sentence: string };

export function HistoryPage({ navigate }: { navigate: (hash: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [attempts, setAttempts] = useState<Row[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<'all' | 'low'>('all');

  const load = () => {
    Promise.all([api.stats(), api.attempts()])
      .then(([s, a]) => {
        setError(null);
        setStats(s);
        setAttempts(a.attempts);
      })
      .catch(setError);
  };
  useEffect(load, []);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!stats || !attempts) return <Spinner className="text-slate-400" />;

  if (stats.attempts === 0) {
    return (
      <Card className="py-12 text-center text-slate-500">
        还没有练习记录。
        <a href="#/practice" className="ml-1 text-indigo-600 underline">
          去练第一句
        </a>
      </Card>
    );
  }

  const shown = filter === 'low' ? attempts.filter((a) => a.overall < 70) : attempts;

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">练习概况</h1>
        <div className="flex flex-wrap gap-3">
          <ScoreBadge score={stats.attempts} label="练习次数" />
          <ScoreBadge score={stats.sentences} label="练过的句子" />
          <ScoreBadge score={stats.average} label="平均总分" />
          <ScoreBadge score={stats.sections.chunking} label="断句" />
          <ScoreBadge score={stats.sections.skeleton} label="主干" />
          <ScoreBadge score={stats.sections.tagging} label="成分" />
          <ScoreBadge score={stats.sections.translation} label="翻译" />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">各类成分的正确率</h2>
        {stats.weakLabels.length > 0 && (
          <p className="rounded-lg bg-violet-50 px-4 py-2 text-sm text-violet-800">
            你最近容易错：{stats.weakLabels.map((l) => LABELS[l].name).join('、')}。用墨墨单词出题时，AI 会特意在句子里加入这些结构。
          </p>
        )}
        <ul className="space-y-2">
          {stats.labels.map((l) => (
            <li key={l.label} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0">
                <LabelBadge label={l.label} />
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${l.accuracy >= 0.8 ? 'bg-emerald-500' : l.accuracy >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.round(l.accuracy * 100)}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right tabular-nums text-slate-600">
                {Math.round(l.accuracy * 100)}% · {l.total} 次
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">练习记录</h2>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'low', label: '错题（低于 70 分）' },
            ]}
          />
        </div>
        <ul className="divide-y divide-slate-100">
          {shown.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-serif text-slate-900">{a.sentence}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(a.at).toLocaleString('zh-CN', { hour12: false })} · 断句 {a.scores.chunking} · 主干 {a.scores.skeleton} · 成分 {a.scores.tagging}
                  {a.scores.translation !== null && ` · 翻译 ${a.scores.translation}`}
                </p>
              </div>
              <span className={`text-lg font-semibold tabular-nums ${a.overall >= 85 ? 'text-emerald-600' : a.overall >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{a.overall}</span>
              <button type="button" onClick={() => navigate(`#/practice/${a.sentenceId}`)} className="text-sm text-indigo-600 hover:underline">
                再练一次
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
