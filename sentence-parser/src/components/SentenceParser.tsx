import React, { useState, useMemo } from 'react';
import { sampleSentences, SENTENCE_TAGS } from '../data/sentences';

export const SentenceParser: React.FC = () => {
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const sentence = sampleSentences[currentSentenceIdx];

  // Phase 1: Chunking, Phase 2: Tagging, Phase 3: Review/Translation
  const [phase, setPhase] = useState<'chunking' | 'tagging' | 'review'>('chunking');

  // State for chunking phase
  const words = useMemo(() => sentence.fullText.split(' '), [sentence]);
  const [splitIndices, setSplitIndices] = useState<Set<number>>(new Set());

  // State for tagging phase
  const [userTags, setUserTags] = useState<Record<number, string>>({});

  // Reset state when sentence changes
  // We handle reset implicitly through the key prop or by lifting it out of useEffect,
  // but for simplicity in this interaction we'll clear it via navigation functions instead.
  // Replacing useEffect with direct handler updates.

  const navigateSentence = (direction: 'prev' | 'next') => {
    setCurrentSentenceIdx(prev => direction === 'next' ? prev + 1 : prev - 1);
    setSplitIndices(new Set());
    setUserTags({});
    setPhase('chunking');
  };

  const toggleSplit = (index: number) => {
    const newSplits = new Set(splitIndices);
    if (newSplits.has(index)) {
      newSplits.delete(index);
    } else {
      newSplits.add(index);
    }
    setSplitIndices(newSplits);
  };

  const renderChunkingPhase = () => {
    return (
      <div className="p-6 bg-gray-50 border rounded-lg min-h-[200px] flex flex-wrap items-center gap-y-4 text-xl leading-relaxed">
        {words.map((word, idx) => (
          <React.Fragment key={idx}>
            <span className="px-1">{word}</span>
            {idx < words.length - 1 && (
              <span
                className={`cursor-pointer px-2 text-2xl font-bold select-none transition-colors duration-200 ${splitIndices.has(idx) ? 'text-red-500' : 'text-transparent hover:text-red-300'}`}
                onClick={() => toggleSplit(idx)}
                title="Click to split"
              >
                /
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const getChunksFromSplits = () => {
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    words.forEach((word, idx) => {
      currentChunk.push(word);
      if (splitIndices.has(idx) || idx === words.length - 1) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
      }
    });
    return chunks;
  };

  const renderTaggingPhase = () => {
    const userChunks = getChunksFromSplits();
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 mb-2">为你在上一步划分的每个意群选择正确的语法成分：</p>
        {userChunks.map((chunk, idx) => (
          <div key={idx} className="p-4 bg-blue-50 border border-blue-100 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="text-lg font-medium">{chunk}</p>
            <select
              className="p-2 border rounded bg-white w-full md:w-64"
              value={userTags[idx] || ''}
              onChange={(e) => setUserTags({...userTags, [idx]: e.target.value})}
            >
              <option value="" disabled>选择成分...</option>
              {SENTENCE_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  };

  const renderReviewPhase = () => {
    return (
      <div className="flex flex-col gap-6">
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold text-green-800 mb-3 border-b border-green-200 pb-2">标准切分与解析</h3>
          <div className="flex flex-col gap-3">
            {sentence.chunks.map(chunk => (
              <div key={chunk.id} className="bg-white p-3 rounded shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
                  <p className="text-lg font-semibold">{chunk.text}</p>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full whitespace-nowrap">
                    {chunk.tag}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">译文：{chunk.translation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border rounded">
          <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">完整翻译参考</h3>
          <p className="text-gray-700 leading-relaxed">{sentence.fullTranslation}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <header className="mb-6 flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">考研英语长难句拆分练习</h1>
          <p className="text-gray-500 text-sm mt-1">
            Current: {sentence.source} ({sentence.year}) - Difficulty: {sentence.difficulty}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={currentSentenceIdx === 0}
            onClick={() => navigateSentence('prev')}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            上一句
          </button>
          <button
            disabled={currentSentenceIdx === sampleSentences.length - 1}
            onClick={() => navigateSentence('next')}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            下一句
          </button>
        </div>
      </header>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">
          {phase === 'chunking' && "阶段一：结构拆分 (点击单词间隙划分子句)"}
          {phase === 'tagging' && "阶段二：成分标记 (为每个切分好的结构选择正确的语法成分)"}
          {phase === 'review' && "阶段三：综合回顾与翻译"}
        </h2>

        {phase === 'chunking' && renderChunkingPhase()}
        {phase === 'tagging' && renderTaggingPhase()}
        {phase === 'review' && renderReviewPhase()}
      </div>

      <div className="flex justify-end mt-4">
        {phase === 'chunking' && (
          <button onClick={() => setPhase('tagging')} className="px-6 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700">
            完成拆分，进入标记
          </button>
        )}
        {phase === 'tagging' && (
          <button onClick={() => setPhase('review')} className="px-6 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700">
            完成标记，查看翻译
          </button>
        )}
        {phase === 'review' && (
          <button onClick={() => {
            setSplitIndices(new Set());
            setUserTags({});
            setPhase('chunking');
          }} className="px-6 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700">
            重新练习此句
          </button>
        )}
      </div>
    </div>
  );
};
