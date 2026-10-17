import { useCallback, useEffect, useState } from 'react';
import type { PublicSettings } from '../../shared/api';
import type { LabelId } from '../../shared/labels';
import { pickWords } from '../../shared/pick';
import type { ExamLevel, PracticeWord, SentenceRecord } from '../../shared/types';
import { api } from '../api';
import { Practice } from '../components/practice/Practice';
import { Library } from '../components/source/Library';
import { PasteForm } from '../components/source/PasteForm';
import { initialPicker, type PickerState } from '../components/source/pickerState';
import { WordPicker } from '../components/source/WordPicker';
import { Card, ErrorBox, Segmented, Spinner } from '../components/ui';

type Tab = 'words' | 'library' | 'paste';
type Busy = { kind: 'generate'; words: string[] } | { kind: 'analyze' } | { kind: 'open' };

interface Current {
  record: SentenceRecord;
  phraseWrites: string[];
  focus: LabelId[];
}

function Waiting({ busy }: { busy: Busy }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const text =
    busy.kind === 'generate'
      ? `AI 正在用「${busy.words.join('、')}」写一个长难句，并逐块分析结构`
      : busy.kind === 'analyze'
        ? 'AI 正在拆解这个句子的结构'
        : '正在打开句子';
  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <Spinner className="h-8 w-8 text-indigo-500" />
      <p className="text-slate-800">{text}…</p>
      {busy.kind !== 'open' && <p className="text-sm text-slate-500">通常需要 20–60 秒，已等待 {seconds} 秒。生成结果会经过逐词对齐校验，不合格会自动重写一次。</p>}
    </Card>
  );
}

interface Props {
  settings: PublicSettings;
  sentenceId: string | null;
  navigate: (hash: string) => void;
}

export function PracticePage({ settings, sentenceId, navigate }: Props) {
  const [tab, setTab] = useState<Tab>(settings.maimemoConfigured || settings.llmConfigured ? 'words' : 'library');
  const [picker, setPicker] = useState<PickerState>(() => initialPicker(settings));
  const updatePicker = useCallback((update: (s: PickerState) => PickerState) => setPicker(update), []);
  const [current, setCurrent] = useState<Current | null>(null);
  const [session, setSession] = useState(0);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<unknown>(null);

  const start = useCallback(
    (record: SentenceRecord, phraseWrites: string[], focus: LabelId[]) => {
      setCurrent({ record, phraseWrites, focus });
      setSession((s) => s + 1);
      navigate(`#/practice/${record.id}`);
      window.scrollTo({ top: 0 });
    },
    [navigate],
  );

  const opening = !!sentenceId && current?.record.id !== sentenceId;
  useEffect(() => {
    if (!opening) return;
    let live = true;
    api
      .sentence(sentenceId!)
      .then((r) => {
        if (!live) return;
        setError(null);
        start(r.sentence, r.phraseWrites, []);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(e);
        navigate('#/practice');
      });
    return () => {
      live = false;
    };
  }, [opening, sentenceId, navigate, start]);

  const generate = async (words: PracticeWord[], level: ExamLevel, topic: string) => {
    setBusy({ kind: 'generate', words: words.map((w) => w.spelling) });
    setError(null);
    try {
      const r = await api.generate(words.map((w) => ({ spelling: w.spelling, vocId: w.vocId })), level, topic.trim() || undefined);
      const used = new Set(words.map((w) => w.spelling));
      setPicker((s) => ({ ...s, words: s.words.map((w) => (used.has(w.spelling) ? { ...w, usedCount: w.usedCount + 1 } : w)), selected: [] }));
      start(r.sentence, [], r.focus);
    } catch (e) {
      setError(e);
      setTab('words');
      navigate('#/practice');
    } finally {
      setBusy(null);
    }
  };

  const analyze = async (text: string, level: ExamLevel, targets: string[]) => {
    setBusy({ kind: 'analyze' });
    setError(null);
    try {
      start((await api.analyze(text, level, targets)).sentence, [], []);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const exit = () => navigate('#/practice');

  const next = async () => {
    if (!current) return;
    const record = current.record;
    if (record.source === 'generated') {
      const used = new Set(record.analysis.targets.map((t) => t.word.toLowerCase()));
      const chosen = pickWords(picker.words.filter((w) => !used.has(w.spelling.toLowerCase())), settings.wordsPerSentence);
      if (chosen.length > 0) return generate(chosen, picker.level, picker.topic);
    }
    if (record.source === 'builtin') {
      try {
        const builtin = (await api.sentences()).sentences.filter((s) => s.source === 'builtin');
        const index = builtin.findIndex((s) => s.id === record.id);
        navigate(`#/practice/${builtin[(index + 1) % builtin.length].id}`);
      } catch (e) {
        setError(e);
      }
      return;
    }
    exit();
  };

  if (busy) return <Waiting busy={busy} />;
  if (opening) return <Waiting busy={{ kind: 'open' }} />;

  if (current && sentenceId) {
    return (
      <div className="space-y-4">
        <ErrorBox error={error} />
        <Practice
          key={`${current.record.id}:${session}`}
          record={current.record}
          phraseWrites={current.phraseWrites}
          onPhraseWrites={(written) => setCurrent((c) => (c ? { ...c, phraseWrites: written } : c))}
          focus={current.focus}
          settings={settings}
          onRestart={() => setSession((s) => s + 1)}
          onExit={exit}
          onNext={current.record.source === 'pasted' ? null : () => void next()}
        />
      </div>
    );
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">出一道长难句</h1>
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t);
            setError(null);
          }}
          options={[
            { value: 'words', label: '用墨墨单词出题' },
            { value: 'library', label: '句库' },
            { value: 'paste', label: '粘贴句子' },
          ]}
        />
      </div>
      {tab === 'words' && <WordPicker settings={settings} state={picker} onState={updatePicker} onGenerate={(w, l, t) => void generate(w, l, t)} error={error} />}
      {tab === 'library' && (
        <>
          <ErrorBox error={error} />
          <Library onOpen={(id) => navigate(`#/practice/${id}`)} />
        </>
      )}
      {tab === 'paste' && <PasteForm settings={settings} onAnalyze={(t, l, w) => void analyze(t, l, w)} error={error} />}
    </Card>
  );
}
