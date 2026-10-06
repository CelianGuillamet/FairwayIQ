import { create } from 'zustand';
import {
  loadCourseMemory,
  rememberCourseChoice,
  saveCourseMemory,
  type CourseChoice,
  type CourseMemory,
} from '../lib/course-memory';

type CourseMemoryState = {
  userId: string | null;
  entries: CourseMemory;
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  remember: (key: string, choice: CourseChoice) => void;
  reset: () => void;
};

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;

export const useCourseMemoryStore = create<CourseMemoryState>((set, get) => ({
  userId: null,
  entries: {},
  loaded: false,

  load: async (userId) => {
    if (get().userId === userId) return;

    const requestGeneration = ++generation;
    set({ userId, entries: {}, loaded: false });

    const entries = await loadCourseMemory(userId);
    if (requestGeneration !== generation) return;

    set({ entries, loaded: true });
  },

  remember: (key, choice) => {
    const { userId, loaded, entries } = get();
    if (!userId || !loaded) return;

    const next = rememberCourseChoice(entries, key, choice, Date.now());
    set({ entries: next });
    void saveCourseMemory(userId, next);
  },

  reset: () => {
    generation++;
    set({ userId: null, entries: {}, loaded: false });
  },
}));
