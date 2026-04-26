import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { format, isToday, isYesterday, subDays } from 'date-fns';

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
};

export const useDrillsStore = create<DrillsState>((set, get) => ({
  completions: [],
  recommendedCategories: [],

  fetchCompletions: async () => {
    const { data, error } = await supabase
      .from('drill_completions')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    if (data) set({ completions: data });
  },

  markDone: async (drillId, userId) => {
    const { data, error } = await supabase
      .from('drill_completions')
      .insert({ drill_id: drillId, user_id: userId })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (data) set({ completions: [data, ...get().completions] });
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
}));
