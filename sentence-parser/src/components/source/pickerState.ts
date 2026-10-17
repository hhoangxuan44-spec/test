import type { PublicSettings, StudyProgress } from '../../../shared/api';
import type { ExamLevel, PracticeWord } from '../../../shared/types';
import type { WordSource } from '../../api';

export interface PickerState {
  source: WordSource;
  notepadId: string;
  words: PracticeWord[];
  progress?: StudyProgress;
  title?: string;
  /** `${source}:${notepadId}` of the list in `words`; null forces a reload. */
  loadedKey: string | null;
  selected: string[];
  level: ExamLevel;
  topic: string;
}

export function initialPicker(settings: PublicSettings): PickerState {
  return { source: 'today', notepadId: '', words: [], loadedKey: null, selected: [], level: settings.level, topic: '' };
}
