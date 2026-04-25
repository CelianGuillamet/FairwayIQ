import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Round, RoundInsert } from '../types';

type RoundsState = {
  rounds: Round[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  fetchRounds: () => Promise<void>;
  addRound: (round: RoundInsert) => Promise<Round>;
  upsertRound: (round: Round) => void;
  removeRound: (roundId: string) => void;
};

export const useRoundsStore = create<RoundsState>((set, get) => ({
  rounds: [],
  loading: true,
  initialized: false,
  error: null,

  fetchRounds: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('played_at', { ascending: false })
      .limit(50);

    if (error) {
      set({ loading: false, initialized: true, error: error.message });
      return;
    }

    set({ rounds: data ?? [], loading: false, initialized: true, error: null });
  },

  addRound: async (round) => {
    set({ error: null });
    const { data, error } = await supabase
      .from('rounds')
      .insert(round)
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      throw error;
    }

    set({ rounds: [data, ...get().rounds], initialized: true, error: null });
    return data;
  },

  upsertRound: (round) => {
    const nextRounds = get().rounds.filter((currentRound) => currentRound.id !== round.id);
    set({
      rounds: [round, ...nextRounds].sort(
        (left, right) => new Date(right.played_at).getTime() - new Date(left.played_at).getTime()
      ),
    });
  },

  removeRound: (roundId) => {
    set({ rounds: get().rounds.filter((round) => round.id !== roundId) });
  },
}));
