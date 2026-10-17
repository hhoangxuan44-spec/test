import { useEffect, useState } from 'react';
import type { PhraseWriteResult, PublicSettings } from '../../../shared/api';
import type { AttemptScores, SentenceRecord, WordRating } from '../../../shared/types';
import { api } from '../../api';
import { ColoredSentence, RoleLegend, StructureView } from '../sentence';
import { Button, Card, ErrorBox, Notice, ScoreBadge } from '../ui';
import { RATING_OPTIONS } from './ratings';

interface Props {
  record: SentenceRecord;
  scores: AttemptScores;
  overall: number;
  saveState: 'saving' | 'saved' | Error;
  ratings: Record<string, WordRating>;
  phraseWrites: string[];
  onPhraseWrites: (written: string[]) => void;
  settings: PublicSettings;
  onRestart: () => void;
  onExit: () => void;
  onNext: (() => void) | null;
}

export function ReviewStep({ record, scores, overall, saveState, ratings, phraseWrites, onPhraseWrites, settings, onRestart, onExit, onNext }: Props) {
  const analysis = record.analysis;
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-2 flex flex-col">
            <span className="text-4xl font-bold tabular-nums text-indigo-700">{overall}</span>
            <span className="text-xs text-slate-500">本句总分</span>
          </div>
          <ScoreBadge score={scores.chunking} label="断句" />
          <ScoreBadge score={scores.skeleton} label="主干" />
          <ScoreBadge score={scores.tagging} label="成分" />
          <ScoreBadge score={scores.translation} label="翻译" />
          <span className="ml-auto text-xs text-slate-500">
            {saveState === 'saving' ? '正在保存记录…' : saveState === 'saved' ? '已存入练习记录' : `记录保存失败：${saveState.message}`}
          </span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">全句结构</h2>
        <ColoredSentence analysis={analysis} />
        <RoleLegend />
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">主干：{analysis.skeleton.summary}</p>
        <StructureView analysis={analysis} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">难点</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {analysis.difficulties.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
        <h2 className="pt-2 text-base font-semibold text-slate-900">译文</h2>
        <p className="text-sm leading-relaxed text-slate-700">
          <span className="font-medium">直译：</span>
          {analysis.translation.literal}
        </p>
        <p className="text-sm leading-relaxed text-slate-700">
          <span className="font-medium">意译：</span>
          {analysis.translation.fluent}
        </p>
      </Card>

      <WordsCard record={record} ratings={ratings} phraseWrites={phraseWrites} onPhraseWrites={onPhraseWrites} settings={settings} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onRestart}>
          重做本句
        </Button>
        <Button variant="secondary" onClick={onExit}>
          返回出题
        </Button>
        {onNext && <Button onClick={onNext}>下一句 →</Button>}
      </div>
    </div>
  );
}

function WordsCard({
  record,
  ratings,
  phraseWrites,
  onPhraseWrites,
  settings,
}: Pick<Props, 'record' | 'ratings' | 'phraseWrites' | 'onPhraseWrites' | 'settings'>) {
  const { targets, vocabulary } = record.analysis;
  const connected = settings.maimemoConfigured;
  const written = new Set(phraseWrites.map((w) => w.toLowerCase()));
  const pendingPhrases = targets.filter((t) => !written.has(t.word.toLowerCase()));
  const shaky = targets.filter((t) => ratings[t.word] === 'vague' || ratings[t.word] === 'unknown');

  const [phraseBusy, setPhraseBusy] = useState(false);
  const [phraseResults, setPhraseResults] = useState<PhraseWriteResult[]>([]);
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanced, setAdvanced] = useState<string | null>(null);
  const [inPlan, setInPlan] = useState<Set<string> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addBusy, setAddBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!connected || vocabulary.length === 0) return;
    let live = true;
    api
      .lookup(vocabulary.map((v) => v.lemma))
      .then((r) => {
        if (!live) return;
        const plan = new Set(r.inPlan);
        setInPlan(plan);
        setSelected(new Set(vocabulary.map((v) => v.lemma).filter((l) => !plan.has(l.toLowerCase()))));
      })
      .catch((e: unknown) => live && setError(e));
    return () => {
      live = false;
    };
  }, [connected, vocabulary]);

  const run = async (busy: (v: boolean) => void, task: () => Promise<void>) => {
    busy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e);
    } finally {
      busy(false);
    }
  };

  const writePhrases = () =>
    run(setPhraseBusy, async () => {
      const r = await api.writePhrases(record.id, pendingPhrases.map((t) => t.word));
      setPhraseResults(r.results);
      onPhraseWrites(r.written);
    });
  const advance = () =>
    run(setAdvanceBusy, async () => {
      const r = await api.advance(shaky.map((t) => ({ spelling: t.word, vocId: t.vocId })));
      setAdvanced(`已让墨墨提前复习 ${r.advanced} 个词${r.missing.length ? `（墨墨词库里没有：${r.missing.join('、')}）` : ''}`);
    });
  const addWords = () =>
    run(setAddBusy, async () => {
      const words = [...selected];
      const r = await api.addWords(words);
      setAdded(`已加入墨墨学习计划 ${r.added} 个词${r.missing.length ? `（墨墨词库里没有：${r.missing.join('、')}）` : ''}`);
      setInPlan((plan) => new Set([...(plan ?? []), ...words.filter((w) => !r.missing.includes(w)).map((w) => w.toLowerCase())]));
      setSelected(new Set());
    });

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">目标词</h2>
        <ul className="mt-3 space-y-3">
          {targets.map((t) => {
            const rating = RATING_OPTIONS.find((o) => o.value === ratings[t.word]);
            return (
              <li key={t.word} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-serif text-lg font-semibold text-indigo-700">{t.word}</span>
                  {t.form.toLowerCase() !== t.word.toLowerCase() && <span className="text-sm text-slate-500">句中形式 {t.form}</span>}
                  <span className="text-sm text-slate-500">{t.pos}</span>
                  <span className="text-slate-900">{t.meaning}</span>
                  {rating && <span className={`ml-auto rounded border px-2 py-0.5 text-xs ${rating.cls}`}>{rating.label}</span>}
                  {written.has(t.word.toLowerCase()) && <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">已存为墨墨例句</span>}
                </div>
                {t.note && <p className="mt-1 text-sm text-slate-600">{t.note}</p>}
              </li>
            );
          })}
        </ul>
      </div>

      {vocabulary.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-900">句中其他生词</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {vocabulary.map((v) => {
              const planned = inPlan?.has(v.lemma.toLowerCase());
              return (
                <li key={v.lemma} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
                  {connected && inPlan && !planned && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`把 ${v.lemma} 加入墨墨`}
                      checked={selected.has(v.lemma)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(v.lemma);
                          else next.delete(v.lemma);
                          return next;
                        })
                      }
                    />
                  )}
                  <div className="min-w-0">
                    <span className="font-serif font-semibold">{v.lemma}</span>
                    <span className="ml-1.5 text-slate-500">{v.pos}</span>
                    <span className="ml-1.5 text-slate-800">{v.meaning}</span>
                    {planned && <span className="ml-2 text-xs text-emerald-600">墨墨计划中</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {connected ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-base font-semibold text-slate-900">同步到墨墨</h2>
          <ErrorBox error={error} />
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={writePhrases} busy={phraseBusy} disabled={pendingPhrases.length === 0}>
              {pendingPhrases.length === 0 ? '本句已存为目标词的墨墨例句' : `把本句存为墨墨例句（${pendingPhrases.map((t) => t.word).join('、')}）`}
            </Button>
            <Button variant="secondary" onClick={advance} busy={advanceBusy} disabled={shaky.length === 0 || advanced !== null}>
              {shaky.length === 0 ? '目标词都想起来了，无需提前复习' : `让墨墨提前复习没记牢的词（${shaky.map((t) => t.word).join('、')}）`}
            </Button>
            {vocabulary.length > 0 && (
              <Button variant="secondary" onClick={addWords} busy={addBusy} disabled={selected.size === 0}>
                把勾选的生词加入墨墨学习计划（{selected.size}）
              </Button>
            )}
          </div>
          {phraseResults.some((r) => !r.ok) && (
            <ul className="text-sm text-rose-700">
              {phraseResults.filter((r) => !r.ok).map((r) => (
                <li key={r.word}>
                  {r.word}：{r.error}
                </li>
              ))}
            </ul>
          )}
          {advanced && <Notice tone="ok">{advanced}</Notice>}
          {added && <Notice tone="ok">{added}</Notice>}
          <p className="text-xs text-slate-500">存为例句后，下次在墨墨里复习这个词时，就能看到你分析过的这句长难句。</p>
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
          连接墨墨后，可以把这句写入目标词的墨墨例句、让没记牢的词提前复习、把生词一键加入学习计划。
          <a href="#/settings" className="ml-1 text-indigo-600 underline">
            去连接
          </a>
        </p>
      )}
    </Card>
  );
}
