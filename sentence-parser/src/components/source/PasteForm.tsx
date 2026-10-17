import { useState } from 'react';
import type { PublicSettings } from '../../../shared/api';
import { EXAM_LEVELS, isExamLevel, type ExamLevel } from '../../../shared/types';
import { Button, ErrorBox, Notice } from '../ui';

interface Props {
  settings: PublicSettings;
  onAnalyze: (text: string, level: ExamLevel, targets: string[]) => void;
  error: unknown;
}

export function PasteForm({ settings, onAnalyze, error }: Props) {
  const [text, setText] = useState('');
  const [targets, setTargets] = useState('');
  const [level, setLevel] = useState<ExamLevel>(settings.level);

  const targetList = targets
    .split(/[,，、\s]+/)
    .map((w) => w.trim())
    .filter((w) => /^[A-Za-z][A-Za-z'-]{0,40}$/.test(w))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <Notice>在阅读真题、外刊时卡住的句子，粘贴进来让 AI 拆解，然后按同样的步骤练一遍。一次粘贴一个句子。</Notice>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Paste an English sentence here…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-serif text-lg leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          placeholder="要重点记的单词（可选，最多 3 个）"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          aria-label="难度参照"
          value={level}
          onChange={(e) => isExamLevel(e.target.value) && setLevel(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {Object.entries(EXAM_LEVELS).map(([id, l]) => (
            <option key={id} value={id}>
              {l.name}
            </option>
          ))}
        </select>
        <Button onClick={() => onAnalyze(text, level, targetList)} disabled={!text.trim() || !settings.llmConfigured}>
          AI 拆解并开始练习
        </Button>
      </div>
      {!settings.llmConfigured && (
        <p className="text-xs text-amber-700">
          拆解句子需要 AI 模型，
          <a href="#/settings" className="underline">
            先到设置里配置
          </a>
          。
        </p>
      )}
      <ErrorBox error={error} />
    </div>
  );
}
