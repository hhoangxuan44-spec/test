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

  // State for hints
  const [showHints, setShowHints] = useState(false);

  // Reset state when sentence changes
  // We handle reset implicitly through the key prop or by lifting it out of useEffect,
  // but for simplicity in this interaction we'll clear it via navigation functions instead.
  // Replacing useEffect with direct handler updates.

  const navigateSentence = (direction: 'prev' | 'next') => {
    setCurrentSentenceIdx(prev => direction === 'next' ? prev + 1 : prev - 1);
    setSplitIndices(new Set());
    setUserTags({});
    setPhase('chunking');
    setShowHints(false);
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
    const hintWords = new Set(['that', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'if', 'because', 'although', 'though', 'even', 'and', 'but', 'or', 'to', 'in', 'on', 'at', 'with', 'by', 'of', 'for', 'from']);

    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowHints(!showHints)}
            className={`px-3 py-1 rounded text-sm ${showHints ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}`}
          >
            💡 {showHints ? '隐藏标志词' : '找断句标志词'}
          </button>
        </div>
        <div className="p-6 bg-gray-50 border rounded-lg min-h-[200px] flex flex-wrap items-center gap-y-4 text-xl leading-relaxed">
          {words.map((word, idx) => {
            const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
            const isHint = showHints && hintWords.has(cleanWord);
            return (
              <React.Fragment key={idx}>
                <span className={`px-1 rounded ${isHint ? 'bg-yellow-200 font-bold' : ''}`}>{word}</span>
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
            );
          })}
        </div>
        {showHints && (
          <p className="text-sm text-yellow-700 mt-2">
            * 标黄的词（如连词、介词、关系代词）通常是意群的起点，考虑在它们**前面**切一刀哦！
          </p>
        )}
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
        {sentence.coreVocabulary && sentence.coreVocabulary.length > 0 && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded">
            <h3 className="font-bold text-orange-800 mb-2 border-b border-orange-200 pb-2">🚀 冲刺大纲：本句核心考研词汇</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sentence.coreVocabulary.map((vocab, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="font-semibold text-orange-900">{vocab.word}</span>
                  <span className="text-gray-600">- {vocab.translation}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-2">* 2个月短期冲刺建议：遇到不认识的词，优先背“决定句子结构的动词”和“影响感情色彩的形容词/副词”。</p>
          </div>
        )}

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
      <div className="mb-4 flex items-center gap-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg border border-blue-200">
        <span className="text-xl">🏃</span>
        <span className="font-medium text-sm">考前 2 个月冲刺模式已开启：强化核心真题，聚焦重难点结构！</span>
      </div>
      <header className="mb-6 flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">考研英语长难句拆分练习</h1>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border">{sentence.source} ({sentence.year})</span>
            <span className={`px-2 py-1 text-xs rounded border ${sentence.difficulty === 'Hard' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>难度: {sentence.difficulty}</span>
          </div>
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
            setShowHints(false);
          }} className="px-6 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700">
            重新练习此句
          </button>
        )}
      </div>
    </div>
  );
};
