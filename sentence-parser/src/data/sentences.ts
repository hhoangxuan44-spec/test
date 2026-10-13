export interface SentenceChunk {
  id: string;
  text: string;
  tag: string;
  translation: string;
}

export interface SentenceData {
  id: string;
  source: 'English I' | 'English II';
  year: number;
  fullText: string;
  chunks: SentenceChunk[];
  fullTranslation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export const SENTENCE_TAGS = [
  '⭐ 核心主干 (句子的基本骨架，谁干了什么)',
  '👤 主语 (动作的发出者)',
  '🎯 宾语 (动作的承受者)',
  '🏷️ 定语从句 (用来修饰、限定前面的名词)',
  '⏱️ 状语从句 (交代时间、原因、条件、让步等背景)',
  '📦 名词性从句 (一句话当成一个名词来用)',
  '📍 介词短语 (in/on/at/of 等引导，补充时间/地点/状态)',
  '🏃 非谓语作状语 (doing/done/to do 补充说明动作发生的背景)',
  '👔 非谓语作定语 (doing/done/to do 紧跟在名词后修饰它)',
  '💬 插入语 (逗号或破折号中间，补充说明，可跳过不看)',
  '🔗 并列结构 (A and B，两者地位平等)',
];

export const sampleSentences: SentenceData[] = [
  {
    id: 'eng2-2022-t1',
    source: 'English II',
    year: 2022,
    difficulty: 'Medium',
    fullText: 'Many people find it difficult to stop looking at their phones, even when they are trying to focus on something else.',
    fullTranslation: '许多人发现很难停止看手机，即使当他们正努力专注于其他事情时也是如此。',
    chunks: [
      {
        id: 'c1',
        text: 'Many people find it difficult',
        tag: '⭐ 核心主干 (句子的基本骨架，谁干了什么)',
        translation: '许多人发现很难'
      },
      {
        id: 'c2',
        text: 'to stop looking at their phones,',
        tag: '🎯 宾语 (动作的承受者)',
        translation: '停止看手机，'
      },
      {
        id: 'c3',
        text: 'even when they are trying to focus on something else.',
        tag: '⏱️ 状语从句 (交代时间、原因、条件、让步等背景)',
        translation: '即使当他们正努力专注于其他事情时。'
      }
    ]
  },
  {
    id: 'eng2-2020-t1',
    source: 'English II',
    year: 2020,
    difficulty: 'Medium',
    fullText: 'The idea that some groups of people may be more intelligent than others is one of those hypotheses that dare not speak its name.',
    fullTranslation: '某些人群可能比其他人群更聪明的观点，是那些不敢说出其名字（即不被公开承认）的假设之一。',
    chunks: [
      {
        id: 'c1',
        text: 'The idea',
        tag: '👤 主语 (动作的发出者)',
        translation: '观点'
      },
      {
        id: 'c2',
        text: 'that some groups of people may be more intelligent than others',
        tag: '📦 名词性从句 (一句话当成一个名词来用)',
        translation: '某些人群可能比其他人群更聪明'
      },
      {
        id: 'c3',
        text: 'is one of those hypotheses',
        tag: '⭐ 核心主干 (句子的基本骨架，谁干了什么)',
        translation: '是那些假设之一'
      },
      {
        id: 'c4',
        text: 'that dare not speak its name.',
        tag: '🏷️ 定语从句 (用来修饰、限定前面的名词)',
        translation: '不敢说出其名字的。'
      }
    ]
  },
  {
    id: 'eng1-2010-t1',
    source: 'English I',
    year: 2010,
    difficulty: 'Hard',
    fullText: 'Of all the changes that have taken place in English-language newspapers during the past quarter-century, perhaps the most far-reaching has been the inexorable decline in the scope and seriousness of their arts coverage.',
    fullTranslation: '在过去25年英文报纸发生的所有变化中，影响最深远的也许是其艺术报道在范围和严肃性方面不可阻挡的衰落。',
    chunks: [
      {
        id: 'c1',
        text: 'Of all the changes',
        tag: '📍 介词短语 (in/on/at/of 等引导，补充时间/地点/状态)',
        translation: '在所有的变化中'
      },
      {
        id: 'c2',
        text: 'that have taken place in English-language newspapers',
        tag: '🏷️ 定语从句 (用来修饰、限定前面的名词)',
        translation: '发生在英文报纸上的'
      },
      {
        id: 'c3',
        text: 'during the past quarter-century,',
        tag: '📍 介词短语 (in/on/at/of 等引导，补充时间/地点/状态)',
        translation: '在过去的25年里，'
      },
      {
        id: 'c4',
        text: 'perhaps the most far-reaching has been the inexorable decline',
        tag: '⭐ 核心主干 (句子的基本骨架，谁干了什么)',
        translation: '也许影响最深远的是不可阻挡的衰落'
      },
      {
        id: 'c5',
        text: 'in the scope and seriousness of their arts coverage.',
        tag: '📍 介词短语 (in/on/at/of 等引导，补充时间/地点/状态)',
        translation: '在其艺术报道的范围和严肃性方面。'
      }
    ]
  }
];
