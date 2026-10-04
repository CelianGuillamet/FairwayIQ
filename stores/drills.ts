import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { format, isToday, isYesterday, subDays } from 'date-fns';

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

type Completion = {
  id: string;
  drill_id: string;
  completed_at: string;
};

type DrillsState = {
  completions: Completion[];
  recommendedCategories: string[];
  fetchCompletions: () => Promise<void>;
  markDone: (drillId: string, userId: string) => Promise<void>;
  isDoneToday: (drillId: string) => boolean;
  getStreak: () => number;
  getTotalDone: () => number;
  setRecommendedCategories: (cats: string[]) => void;
  reset: () => void;
};

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;
const pendingMarks = new Map<string, Promise<void>>();

export const useDrillsStore = create<DrillsState>((set, get) => ({
  completions: [],
  recommendedCategories: [],

  fetchCompletions: async () => {
    // getStreak()/getTotalDone() need the full completion history to stay accurate, but
    // there's no UI list to paginate against, so we page through everything here instead
    // of capping at a single batch. MAX_PAGES bounds the worst case (10,000 completions)
    // rather than fetching truly unbounded data for a runaway account.
    const requestGeneration = generation;
    let allCompletions: Completion[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('drill_completions')
        .select('*')
        .order('completed_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (requestGeneration !== generation) {
        return;
      }

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        break;
      }

      allCompletions = allCompletions.concat(data);

      if (data.length < PAGE_SIZE) {
        break;
      }
    }

    set({ completions: allCompletions });
  },

  markDone: (drillId, userId) => {
    const pendingKey = `${userId}:${drillId}`;
    const pending = pendingMarks.get(pendingKey);
    if (pending) {
      return pending;
    }

    const requestGeneration = generation;
    const request = (async () => {
      const { data, error } = await supabase
        .from('drill_completions')
        .insert({ drill_id: drillId, user_id: userId })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data && requestGeneration === generation) {
        set({ completions: [data, ...get().completions] });
      }
    })().finally(() => pendingMarks.delete(pendingKey));

    pendingMarks.set(pendingKey, request);
    return request;
  },

  isDoneToday: (drillId) => {
    return get().completions.some(
      c => c.drill_id === drillId && isToday(new Date(c.completed_at))
    );
  },

  getStreak: () => {
    const completions = get().completions;
    if (completions.length === 0) return 0;

    const days = new Set(completions.map(c => format(new Date(c.completed_at), 'yyyy-MM-dd')));
    let streak = 0;
    let current = new Date();

    // If nothing today, check if yesterday to count ongoing streak
    if (!days.has(format(current, 'yyyy-MM-dd'))) {
      current = subDays(current, 1);
    }

    while (days.has(format(current, 'yyyy-MM-dd'))) {
      streak++;
      current = subDays(current, 1);
    }
    return streak;
  },

  getTotalDone: () => {
    return new Set(get().completions.map(c => c.drill_id)).size;
  },

  setRecommendedCategories: (cats) => set({ recommendedCategories: cats }),

  reset: () => {
    generation++;
    set({ completions: [], recommendedCategories: [] });
  },
}));
