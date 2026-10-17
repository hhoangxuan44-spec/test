export const LABEL_IDS = [
  'main',
  'subject_clause',
  'object_clause',
  'predicative_clause',
  'appositive_clause',
  'relative_clause',
  'nonfinite_attributive',
  'adverbial_clause',
  'nonfinite_adverbial',
  'absolute',
  'prep_phrase',
  'parenthesis',
  'appositive',
  'coordinate',
] as const;

export type LabelId = (typeof LABEL_IDS)[number];

export type LabelFamily = 'main' | 'nominal' | 'attributive' | 'adverbial' | 'prep' | 'insert' | 'coordinate';

export interface LabelInfo {
  id: LabelId;
  name: string;
  family: LabelFamily;
  hint: string;
}

export const LABELS: Record<LabelId, LabelInfo> = {
  main: {
    id: 'main',
    name: '主干',
    family: 'main',
    hint: '句子的骨架：主语 + 谓语（+ 宾语 / 表语），去掉所有修饰之后剩下的部分',
  },
  subject_clause: {
    id: 'subject_clause',
    name: '主语从句',
    family: 'nominal',
    hint: '整个从句充当句子的主语，常由 what / that / whether / how 引导',
  },
  object_clause: {
    id: 'object_clause',
    name: '宾语从句',
    family: 'nominal',
    hint: '从句充当动词或介词的宾语，引导词 that 常被省略',
  },
  predicative_clause: {
    id: 'predicative_clause',
    name: '表语从句',
    family: 'nominal',
    hint: '从句跟在 be / seem / remain 等系动词后面作表语',
  },
  appositive_clause: {
    id: 'appositive_clause',
    name: '同位语从句',
    family: 'nominal',
    hint: '说明前面抽象名词（idea / fact / belief / evidence…）的具体内容，that 在从句里不作成分',
  },
  relative_clause: {
    id: 'relative_clause',
    name: '定语从句',
    family: 'attributive',
    hint: '修饰前面的名词，关系词（which / that / who / where…）在从句里作成分',
  },
  nonfinite_attributive: {
    id: 'nonfinite_attributive',
    name: '非谓语作定语',
    family: 'attributive',
    hint: 'doing / done / to do 紧跟在名词后面修饰它，相当于一个简化的定语从句',
  },
  adverbial_clause: {
    id: 'adverbial_clause',
    name: '状语从句',
    family: 'adverbial',
    hint: '交代时间、原因、条件、让步、目的、结果、比较、方式等背景（when / because / if / although / than…）',
  },
  nonfinite_adverbial: {
    id: 'nonfinite_adverbial',
    name: '非谓语作状语',
    family: 'adverbial',
    hint: 'doing / done / to do 修饰整个动作，说明目的、伴随、原因、结果、方式等',
  },
  absolute: {
    id: 'absolute',
    name: '独立主格',
    family: 'adverbial',
    hint: '名词 + doing / done / 形容词 / 介词短语，自带逻辑主语，整体作状语',
  },
  prep_phrase: {
    id: 'prep_phrase',
    name: '介词短语',
    family: 'prep',
    hint: 'in / of / with / during 等引导，补充时间、地点、范围、方式，或后置修饰名词',
  },
  parenthesis: {
    id: 'parenthesis',
    name: '插入语',
    family: 'insert',
    hint: '用逗号或破折号隔开的补充说明，拿掉之后句子结构仍然完整',
  },
  appositive: {
    id: 'appositive',
    name: '同位语',
    family: 'insert',
    hint: '紧跟在名词后面、对它进行解释说明的名词短语',
  },
  coordinate: {
    id: 'coordinate',
    name: '并列成分',
    family: 'coordinate',
    hint: 'and / but / or / not only…but also 连接的、与前文地位平等的部分（并列谓语、并列分句等）',
  },
};

export const FAMILY_NAMES: Record<LabelFamily, string> = {
  main: '主干',
  nominal: '名词性从句',
  attributive: '定语类',
  adverbial: '状语类',
  prep: '介词短语',
  insert: '插入 / 同位',
  coordinate: '并列',
};

export const FAMILY_STYLES: Record<LabelFamily, { badge: string; text: string; underline: string }> = {
  main: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    text: 'text-amber-900',
    underline: 'decoration-amber-500',
  },
  nominal: {
    badge: 'bg-violet-100 text-violet-900 border-violet-300',
    text: 'text-violet-800',
    underline: 'decoration-violet-500',
  },
  attributive: {
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    text: 'text-sky-800',
    underline: 'decoration-sky-500',
  },
  adverbial: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    text: 'text-emerald-800',
    underline: 'decoration-emerald-500',
  },
  prep: {
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    text: 'text-slate-700',
    underline: 'decoration-slate-400',
  },
  insert: {
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    text: 'text-rose-800',
    underline: 'decoration-rose-400',
  },
  coordinate: {
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    text: 'text-orange-800',
    underline: 'decoration-orange-500',
  },
};

export function isLabelId(value: unknown): value is LabelId {
  return typeof value === 'string' && (LABEL_IDS as readonly string[]).includes(value);
}
