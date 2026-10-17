import type { Analysis, TranslationGrade, WordRating } from '../../../shared/types';
import { ColoredSentence, RoleLegend } from '../sentence';
import { Button, ErrorBox, Notice } from '../ui';
import { RATING_OPTIONS } from './ratings';

interface Props {
  analysis: Analysis;
  translation: string;
  onTranslation: (text: string) => void;
  ratings: Record<string, WordRating>;
  onRating: (word: string, rating: WordRating) => void;
  llmConfigured: boolean;
  submitted: boolean;
  grade: TranslationGrade | null;
  grading: boolean;
  gradeError: unknown;
  onSubmit: () => void;
  onSkip: () => void;
  onNext: () => void;
}

export function TranslateStep(p: Props) {
  const { analysis } = p;
  return (
    <div className="space-y-5">
      <Notice>
        结构已经理清了，现在把整句译成中文：先按意群顺序直译，再调整成通顺的中文。下面的颜色就是刚才的结构：<span className="font-medium">底色是主干</span>，下划线颜色代表成分大类。
      </Notice>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
        <ColoredSentence analysis={analysis} />
        <RoleLegend />
      </div>

      {analysis.targets.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <h3 className="mb-1 text-sm font-medium text-indigo-900">目标词自评</h3>
          <p className="mb-3 text-xs text-indigo-800/80">先别看答案：这些词在句中的意思，你翻译时想起来了吗？没想起来的词，最后可以一键让墨墨提前复习。</p>
          <ul className="space-y-2">
            {analysis.targets.map((t) => (
              <li key={t.word} className="flex flex-wrap items-center gap-2">
                <span className="w-32 font-serif text-lg font-semibold text-indigo-700">{t.form}</span>
                {RATING_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={p.submitted}
                    aria-pressed={p.ratings[t.word] === o.value}
                    onClick={() => p.onRating(t.word, o.value)}
                    className={`rounded-lg border px-3 py-1 text-sm transition-colors disabled:cursor-default ${
                      p.ratings[t.word] === o.value ? o.cls : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">你的译文</span>
        <textarea
          value={p.translation}
          onChange={(e) => p.onTranslation(e.target.value)}
          disabled={p.submitted}
          rows={4}
          placeholder="在这里写下你的翻译……"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base leading-relaxed disabled:bg-slate-50"
        />
      </label>

      {!p.submitted ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!p.llmConfigured && <span className="text-xs text-slate-500">未配置 AI，提交后对照参考译文自查</span>}
          <Button variant="ghost" onClick={p.onSkip}>
            跳过翻译
          </Button>
          <Button onClick={p.onSubmit} busy={p.grading} disabled={!p.translation.trim()}>
            {p.llmConfigured ? (p.grading ? 'AI 批改中…' : '提交并让 AI 批改') : '提交'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ErrorBox error={p.gradeError} onRetry={p.onSubmit} />
          {p.grade && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-baseline gap-3">
                <span className="text-lg font-semibold">翻译得分 {p.grade.score}</span>
                <span className="text-slate-700">{p.grade.verdict}</span>
              </p>
              {p.grade.issues.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {p.grade.issues.map((issue, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 rounded bg-rose-50 px-1.5 text-xs leading-5 text-rose-700">{issue.type}</span>
                      <span className="text-slate-700">{issue.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">修改建议：</span>
                {p.grade.improved}
              </p>
            </div>
          )}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed">
            <p>
              <span className="font-medium text-slate-800">直译：</span>
              {analysis.translation.literal}
            </p>
            <p>
              <span className="font-medium text-slate-800">意译：</span>
              {analysis.translation.fluent}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={p.onNext} disabled={p.grading}>
              下一步：查看完整解析 →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
