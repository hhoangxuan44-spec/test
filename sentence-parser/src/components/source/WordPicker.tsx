import { useEffect, useState } from 'react';
import type { BriefNotepad, PublicSettings } from '../../../shared/api';
import { pickWords, wordPriority } from '../../../shared/pick';
import { EXAM_LEVELS, isExamLevel, type ExamLevel, type PracticeWord } from '../../../shared/types';
import { api } from '../../api';
import { Button, ErrorBox, Notice, Segmented, Spinner } from '../ui';
import type { PickerState } from './pickerState';

type Filter = 'all' | 'weak' | 'new' | 'fresh';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'weak', label: '待加强' },
  { value: 'new', label: '今日新学' },
  { value: 'fresh', label: '还没练过' },
];

function matches(w: PracticeWord, filter: Filter): boolean {
  if (filter === 'weak') return wordPriority(w) >= 3;
  if (filter === 'new') return !!w.isNew;
  if (filter === 'fresh') return w.usedCount === 0;
  return true;
}

function WordChip({ word, selected, onClick }: { word: PracticeWord; selected: boolean; onClick: () => void }) {
  const tags: Array<[string, string]> = [];
  if (word.firstResponse === 'FORGET') tags.push(['忘', 'bg-rose-100 text-rose-700']);
  if (word.firstResponse === 'VAGUE') tags.push(['模糊', 'bg-amber-100 text-amber-700']);
  if (word.sticking) tags.push(['顽固', 'bg-violet-100 text-violet-700']);
  if (word.isNew) tags.push(['新', 'bg-sky-100 text-sky-700']);
  if (word.firstResponse === 'WELL_FAMILIAR') tags.push(['熟', 'bg-slate-100 text-slate-500']);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
        selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300'
      }`}
    >
      <span className="font-serif">{word.spelling}</span>
      {tags.map(([text, cls]) => (
        <span key={text} className={`rounded px-1 text-[10px] leading-4 ${selected ? 'bg-white/20 text-white' : cls}`}>
          {text}
        </span>
      ))}
      {word.usedCount > 0 && <span className={`text-[10px] ${selected ? 'text-white/70' : 'text-slate-400'}`}>练过{word.usedCount}</span>}
    </button>
  );
}

interface Props {
  settings: PublicSettings;
  state: PickerState;
  onState: (update: (s: PickerState) => PickerState) => void;
  onGenerate: (words: PracticeWord[], level: ExamLevel, topic: string) => void;
  error: unknown;
}

export function WordPicker({ settings, state, onState, onGenerate, error }: Props) {
  const [loadError, setLoadError] = useState<unknown>(null);
  const [notepads, setNotepads] = useState<BriefNotepad[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [manual, setManual] = useState('');
  const [attempt, setAttempt] = useState(0);
  const max = settings.wordsPerSentence;
  const key = `${state.source}:${state.notepadId}`;
  const wanted = settings.maimemoConfigured && state.loadedKey !== key && (state.source !== 'notepad' || !!state.notepadId);
  const loading = wanted && !loadError;

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    api
      .words(state.source, state.notepadId || undefined)
      .then((r) => live && onState((s) => ({ ...s, words: r.words, progress: r.progress ?? s.progress, title: r.title, loadedKey: key, selected: [] })))
      .catch((e: unknown) => live && setLoadError(e));
    return () => {
      live = false;
    };
  }, [wanted, attempt, state.source, state.notepadId, key, onState]);

  useEffect(() => {
    if (state.source !== 'notepad' || notepads || !settings.maimemoConfigured) return;
    api
      .notepads()
      .then((r) => setNotepads(r.notepads))
      .catch(setLoadError);
  }, [state.source, notepads, settings.maimemoConfigured]);

  const reload = () => {
    setLoadError(null);
    setAttempt((a) => a + 1);
    onState((s) => ({ ...s, loadedKey: null }));
  };

  const toggle = (spelling: string) =>
    onState((s) => {
      if (s.selected.includes(spelling)) return { ...s, selected: s.selected.filter((w) => w !== spelling) };
      const selected = [...s.selected, spelling];
      return { ...s, selected: selected.length > max ? selected.slice(-max) : selected };
    });

  const addManual = () => {
    const words = manual
      .split(/[,，、\s]+/)
      .map((w) => w.trim())
      .filter((w) => /^[A-Za-z][A-Za-z'-]{0,40}$/.test(w));
    if (words.length === 0) return;
    onState((s) => {
      const existing = new Set(s.words.map((w) => w.spelling.toLowerCase()));
      const added = words.filter((w) => !existing.has(w.toLowerCase())).map((spelling) => ({ spelling, usedCount: 0 }));
      return { ...s, words: [...added, ...s.words], selected: [...new Set([...s.selected, ...words])].slice(-max) };
    });
    setManual('');
  };

  const visible = state.words.filter((w) => matches(w, filter));
  const chosen = state.selected.map((sp) => state.words.find((w) => w.spelling === sp)).filter((w): w is PracticeWord => !!w);

  return (
    <div className="space-y-4">
      {!settings.maimemoConfigured ? (
        <Notice tone="warn">
          还没连接墨墨背单词。打开墨墨 App →「我的」→「更多设置」→「实验功能」→「开放 API」复制 Token，
          <a href="#/settings" className="font-medium underline">
            到设置里填上
          </a>
          ，就能直接用你今天背的单词出题。也可以先在下面手动输入单词。
        </Notice>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={state.source}
            onChange={(source) => {
              setLoadError(null);
              onState((s) => ({ ...s, source }));
            }}
            options={[
              { value: 'today', label: '今日单词' },
              { value: 'sticking', label: '顽固 / 遗忘词' },
              { value: 'notepad', label: '云词本' },
            ]}
          />
          {state.source === 'notepad' && (
            <select
              aria-label="选择云词本"
              value={state.notepadId}
              onChange={(e) => {
                setLoadError(null);
                onState((s) => ({ ...s, notepadId: e.target.value }));
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{notepads ? (notepads.length ? '选择云词本…' : '你还没有云词本') : '加载中…'}</option>
              {notepads?.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" onClick={reload} busy={loading}>
            刷新
          </Button>
          {state.source === 'today' && state.progress && (
            <span className="text-sm text-slate-500">
              墨墨今日进度 {state.progress.finished} / {state.progress.total}
            </span>
          )}
        </div>
      )}

      <ErrorBox error={loadError} onRetry={reload} />

      {(settings.maimemoConfigured || state.words.length > 0) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented value={filter} onChange={setFilter} options={FILTERS} />
            <span className="text-xs text-slate-500">
              共 {state.words.length} 个词；每句最多选 {max} 个（可在设置里改）
            </span>
          </div>
          {loading && state.words.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> 正在从墨墨读取单词…
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-slate-500">
              {state.words.length === 0 ? (state.source === 'today' ? '今天还没有学习任务，先去墨墨背一会儿，或者换个词源。' : '这里没有单词。') : '这个筛选下没有单词。'}
            </p>
          ) : (
            <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto pr-1">
              {visible.map((w) => (
                <WordChip key={w.spelling} word={w} selected={state.selected.includes(w.spelling)} onClick={() => toggle(w.spelling)} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManual()}
          placeholder="手动添加单词，如 mitigate, curb"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <Button variant="secondary" onClick={addManual} disabled={!manual.trim()}>
          添加
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">本句目标词：</span>
          {chosen.length ? (
            chosen.map((w) => (
              <span key={w.spelling} className="rounded-full bg-indigo-600 px-3 py-0.5 font-serif text-sm text-white">
                {w.spelling}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">还没选</span>
          )}
          <Button
            variant="ghost"
            className="ml-auto"
            disabled={state.words.length === 0}
            onClick={() => onState((s) => ({ ...s, selected: pickWords(s.words, max).map((w) => w.spelling) }))}
          >
            智能选词
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="难度"
            value={state.level}
            onChange={(e) => isExamLevel(e.target.value) && onState((s) => ({ ...s, level: e.target.value as ExamLevel }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(EXAM_LEVELS).map(([id, l]) => (
              <option key={id} value={id}>
                {l.name}（{l.words} 词）
              </option>
            ))}
          </select>
          <input
            value={state.topic}
            onChange={(e) => onState((s) => ({ ...s, topic: e.target.value }))}
            placeholder="话题（可选）：如 人工智能、气候变化"
            maxLength={60}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <Button onClick={() => onGenerate(chosen, state.level, state.topic)} disabled={chosen.length === 0 || !settings.llmConfigured}>
            用这些词生成长难句
          </Button>
        </div>
        {!settings.llmConfigured && (
          <p className="text-xs text-amber-700">
            生成句子需要 AI 模型，
            <a href="#/settings" className="underline">
              先到设置里配置
            </a>
            。没有 AI 也可以先练「真题句库」。
          </p>
        )}
        <p className="text-xs text-slate-500">「智能选词」优先挑还没练过的词，其中今天在墨墨里忘记、模糊和顽固的词排在最前。</p>
      </div>
      <ErrorBox error={error} />
    </div>
  );
}
