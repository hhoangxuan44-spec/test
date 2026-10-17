import type { WordRating } from '../../../shared/types';

export const RATING_OPTIONS: Array<{ value: WordRating; label: string; cls: string }> = [
  { value: 'known', label: '想起来了', cls: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { value: 'vague', label: '有点模糊', cls: 'border-amber-500 bg-amber-50 text-amber-800' },
  { value: 'unknown', label: '没想起来', cls: 'border-rose-500 bg-rose-50 text-rose-800' },
];
