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

    const rounds: Round[] = data ?? [];
    const teeSetIds = Array.from(
      new Set(rounds.map((round) => round.tee_set_id).filter((id): id is string => !!id))
    );

    // rounds.tee_set_id has no FK to course_tee_sets, so it can't be embedded in the
    // select above; fetch ratings separately and merge them in for the WHS handicap calc.
    let ratingByTeeSetId = new Map<string, { course_rating: number | null; slope_rating: number | null }>();
    if (teeSetIds.length > 0) {
      const { data: teeSets } = await supabase
        .from('course_tee_sets')
        .select('id, course_rating, slope_rating')
        .in('id', teeSetIds);

      ratingByTeeSetId = new Map(
        (teeSets ?? []).map((teeSet) => [
          teeSet.id as string,
          { course_rating: teeSet.course_rating, slope_rating: teeSet.slope_rating },
        ])
      );
    }

    const hydratedRounds = rounds.map((round) => ({
      ...round,
      ...(round.tee_set_id ? ratingByTeeSetId.get(round.tee_set_id) : undefined),
    }));

    set({ rounds: hydratedRounds, loading: false, initialized: true, error: null });
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
