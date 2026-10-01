import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Round, RoundInsert } from '../types';

const PAGE_SIZE = 50;

type RoundsState = {
  rounds: Round[];
  loading: boolean;
  loadingMore: boolean;
  initialized: boolean;
  error: string | null;
  hasMore: boolean;
  fetchRounds: () => Promise<void>;
  fetchMoreRounds: () => Promise<void>;
  addRound: (round: RoundInsert) => Promise<Round>;
  upsertRound: (round: Round) => void;
  removeRound: (roundId: string) => void;
};

export const useRoundsStore = create<RoundsState>((set, get) => ({
  rounds: [],
  loading: true,
  loadingMore: false,
  initialized: false,
  error: null,
  hasMore: true,

  fetchRounds: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('played_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (error) {
      set({ loading: false, initialized: true, error: error.message });
      return;
    }

    set({
      rounds: data ?? [],
      loading: false,
      initialized: true,
      error: null,
      hasMore: (data?.length ?? 0) === PAGE_SIZE,
    });
  },

  fetchMoreRounds: async () => {
    const { loading, loadingMore, hasMore, rounds } = get();
    if (loading || loadingMore || !hasMore) {
      return;
    }

    set({ loadingMore: true, error: null });
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('played_at', { ascending: false })
      .range(rounds.length, rounds.length + PAGE_SIZE - 1);

    if (error) {
      set({ loadingMore: false, error: error.message });
      return;
    }

    set({
      rounds: [...rounds, ...(data ?? [])],
      loadingMore: false,
      hasMore: (data?.length ?? 0) === PAGE_SIZE,
    });
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
