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

// rounds.tee_set_id has no FK to course_tee_sets, so it can't be embedded in the
// select; fetch ratings separately and merge them in for the WHS handicap calc.
async function hydrateRoundsWithTeeRatings(rounds: Round[]): Promise<Round[]> {
  const teeSetIds = Array.from(
    new Set(rounds.map((round) => round.tee_set_id).filter((id): id is string => !!id))
  );

  if (teeSetIds.length === 0) {
    return rounds;
  }

  const { data: teeSets } = await supabase
    .from('course_tee_sets')
    .select('id, course_rating, slope_rating')
    .in('id', teeSetIds);

  const ratingByTeeSetId = new Map(
    (teeSets ?? []).map((teeSet) => [
      teeSet.id as string,
      { course_rating: teeSet.course_rating, slope_rating: teeSet.slope_rating },
    ])
  );

  return rounds.map((round) => ({
    ...round,
    ...(round.tee_set_id ? ratingByTeeSetId.get(round.tee_set_id) : undefined),
  }));
}

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

    const rounds = await hydrateRoundsWithTeeRatings(data ?? []);

    set({
      rounds,
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

    const newRounds = await hydrateRoundsWithTeeRatings(data ?? []);

    set({
      rounds: [...rounds, ...newRounds],
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
