import { useMemo, useState } from 'react';
import type { PublicSettings } from '../../../shared/api';
import { LABELS, type LabelId } from '../../../shared/labels';
import { overallScore, referenceSplits, scoreChunking, scoreSkeleton, scoreTagging, type ChunkingScore } from '../../../shared/scoring';
import { normalizeWord } from '../../../shared/tokenize';
import { EXAM_LEVELS, type AttemptScores, type SentenceRecord, type TranslationGrade, type WordRating } from '../../../shared/types';
import { api } from '../../api';
import { Card } from '../ui';
import { ChunkStep } from './ChunkStep';
import { ReviewStep } from './ReviewStep';
import { SkeletonStep, type RoleMap } from './SkeletonStep';
import { TagStep } from './TagStep';
import { TranslateStep } from './TranslateStep';

type Step = 'chunk' | 'skeleton' | 'tag' | 'translate' | 'review';

const STEPS: Array<{ id: Step; title: string }> = [
  { id: 'chunk', title: '断句' },
  { id: 'skeleton', title: '抓主干' },
  { id: 'tag', title: '标成分' },
  { id: 'translate', title: '翻译' },
  { id: 'review', title: '解析' },
];

const SOURCE_TEXT = { builtin: '真题', generated: 'AI 出题', pasted: '粘贴' } as const;

interface Props {
  record: SentenceRecord;
  phraseWrites: string[];
  onPhraseWrites: (written: string[]) => void;
  focus: LabelId[];
  settings: PublicSettings;
  onRestart: () => void;
  onExit: () => void;
  onNext: (() => void) | null;
}

export function Practice({ record, phraseWrites, onPhraseWrites, focus, settings, onRestart, onExit, onNext }: Props) {
  const analysis = record.analysis;
  const [step, setStep] = useState<Step>('chunk');
  const [reached, setReached] = useState(0);

  const [splits, setSplits] = useState<number[]>([]);
  const [chunkResult, setChunkResult] = useState<ChunkingScore | null>(null);
  const [roles, setRoles] = useState<RoleMap>({ subject: [], predicate: [], complement: [] });
  const [skeletonResult, setSkeletonResult] = useState<ReturnType<typeof scoreSkeleton> | null>(null);
  const [tags, setTags] = useState<Array<LabelId | null>>(() => analysis.chunks.map(() => null));
  const [tagResult, setTagResult] = useState<ReturnType<typeof scoreTagging> | null>(null);

  const [translation, setTranslation] = useState('');
  const [ratings, setRatings] = useState<Record<string, WordRating>>({});
  const [submitted, setSubmitted] = useState(false);
  const [grade, setGrade] = useState<TranslationGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<unknown>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | Error>('idle');

  const go = (next: Step) => {
    const index = STEPS.findIndex((s) => s.id === next);
    setReached((r) => Math.max(r, index));
    setStep(next);
  };

  const scores: AttemptScores = useMemo(
    () => ({
      chunking: chunkResult?.score ?? 0,
      skeleton: skeletonResult?.score ?? 0,
      tagging: tagResult?.score ?? 0,
      translation: grade?.score ?? null,
    }),
    [chunkResult, skeletonResult, tagResult, grade],
  );

  const submitTranslation = async () => {
    setSubmitted(true);
    if (!settings.llmConfigured) return;
    setGrading(true);
    setGradeError(null);
    try {
      setGrade((await api.grade(record.id, translation)).grade);
    } catch (e) {
      setGradeError(e);
    } finally {
      setGrading(false);
    }
  };

  const finish = async () => {
    go('review');
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      await api.saveAttempt({
        sentenceId: record.id,
        scores,
        labelResults: analysis.chunks.map((c, i) => ({ label: c.label, result: tagResult?.results[i] ?? 'empty' })),
        wordRatings: Object.entries(ratings).map(([word, rating]) => ({ word, rating })),
        translation: translation.trim() || undefined,
      });
      setSaveState('saved');
    } catch (e) {
      setSaveState(e instanceof Error ? e : new Error(String(e)));
    }
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{SOURCE_TEXT[record.source]}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{record.origin}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{EXAM_LEVELS[record.level].name}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{analysis.tokens.filter((t) => normalizeWord(t) !== '').length} 词</span>
          {analysis.targets.length > 0 && (
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700">目标词：{analysis.targets.map((t) => t.word).join('、')}</span>
          )}
          {focus.length > 0 && (
            <span className="rounded bg-violet-50 px-2 py-0.5 text-violet-700">特意加入了你近期易错的：{focus.map((f) => LABELS[f].name).join('、')}</span>
          )}
          <button type="button" onClick={onExit} className="ml-auto text-sm text-slate-500 hover:text-slate-800">
            ← 返回出题
          </button>
        </div>
        <nav aria-label="练习步骤">
          <ol className="flex flex-wrap gap-1">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const open = i <= reached;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => setStep(s.id)}
                    aria-current={active ? 'step' : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active ? 'bg-indigo-600 text-white' : open ? 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${active ? 'bg-white/20' : 'bg-white'}`}>{i + 1}</span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </Card>

      {step === 'review' ? (
        <ReviewStep
          record={record}
          scores={scores}
          overall={overallScore(scores)}
          saveState={saveState === 'idle' ? 'saving' : saveState}
          ratings={ratings}
          phraseWrites={phraseWrites}
          onPhraseWrites={onPhraseWrites}
          settings={settings}
          onRestart={onRestart}
          onExit={onExit}
          onNext={onNext}
        />
      ) : (
      <Card>
        {step === 'chunk' && (
          <ChunkStep
            analysis={analysis}
            splits={splits}
            onChange={setSplits}
            result={chunkResult}
            onCheck={() => setChunkResult(scoreChunking(splits, referenceSplits(analysis.chunks)))}
            onNext={() => go('skeleton')}
          />
        )}
        {step === 'skeleton' && (
          <SkeletonStep
            analysis={analysis}
            roles={roles}
            onChange={setRoles}
            result={skeletonResult}
            onCheck={() => setSkeletonResult(scoreSkeleton(roles, analysis.skeleton, analysis.tokens))}
            onNext={() => go('tag')}
          />
        )}
        {step === 'tag' && (
          <TagStep
            analysis={analysis}
            tags={tags}
            onChange={setTags}
            result={tagResult}
            onCheck={() => setTagResult(scoreTagging(tags, analysis.chunks.map((c) => c.label)))}
            onNext={() => go('translate')}
          />
        )}
        {step === 'translate' && (
          <TranslateStep
            analysis={analysis}
            translation={translation}
            onTranslation={setTranslation}
            ratings={ratings}
            onRating={(word, rating) => setRatings((r) => ({ ...r, [word]: rating }))}
            llmConfigured={settings.llmConfigured}
            submitted={submitted}
            grade={grade}
            grading={grading}
            gradeError={gradeError}
            onSubmit={submitTranslation}
            onSkip={() => {
              setSubmitted(true);
              setTranslation('');
            }}
            onNext={() => void finish()}
          />
        )}
      </Card>
      )}
    </div>
  );
}
