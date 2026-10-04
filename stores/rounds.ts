import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Round, RoundInsert } from '../types';

const PAGE_SIZE = 50;

export function compareRounds(left: Round, right: Round) {
  const byDate = new Date(right.played_at).getTime() - new Date(left.played_at).getTime();
  if (byDate !== 0 && !Number.isNaN(byDate)) {
    return byDate;
  }
  return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
}

export function mergeRounds(current: Round[], incoming: Round[]) {
  const byId = new Map<string, Round>();
  for (const round of current) {
    byId.set(round.id, round);
  }
  for (const round of incoming) {
    byId.set(round.id, round);
  }
  return Array.from(byId.values()).sort(compareRounds);
}

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
  reset: () => void;
};

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;
// Bumped by every fetchRounds(): only the latest first-page response may overwrite the list,
// and an in-flight fetchMore started against an older list is discarded.
let fetchSequence = 0;

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
    const requestGeneration = generation;
    const requestSequence = ++fetchSequence;
    const isStale = () => requestGeneration !== generation || requestSequence !== fetchSequence;
    const knownIds = new Set(get().rounds.map((round) => round.id));

    set({ loading: true, loadingMore: false, error: null });
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('played_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (isStale()) {
      return;
    }

    if (error) {
      set({ loading: false, initialized: true, error: error.message });
      return;
    }

    const fetched = await hydrateRoundsWithTeeRatings(data ?? []);

    if (isStale()) {
      return;
    }

    const fetchedIds = new Set(fetched.map((round) => round.id));
    const addedMeanwhile = get().rounds.filter(
      (round) => !knownIds.has(round.id) && !fetchedIds.has(round.id)
    );

    set({
      rounds: mergeRounds(fetched, addedMeanwhile),
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

    const requestGeneration = generation;
    const requestSequence = fetchSequence;
    const isStale = () => requestGeneration !== generation || requestSequence !== fetchSequence;

    set({ loadingMore: true, error: null });
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('played_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rounds.length, rounds.length + PAGE_SIZE - 1);

    if (isStale()) {
      return;
    }

    if (error) {
      set({ loadingMore: false, error: error.message });
      return;
    }

    const newRounds = await hydrateRoundsWithTeeRatings(data ?? []);

    if (isStale()) {
      return;
    }

    set({
      rounds: mergeRounds(get().rounds, newRounds),
      loadingMore: false,
      hasMore: (data?.length ?? 0) === PAGE_SIZE,
    });
  },

  addRound: async (round) => {
    const requestGeneration = generation;
    set({ error: null });
    const { data, error } = await supabase
      .from('rounds')
      .insert(round)
      .select()
      .single();

    if (error) {
      if (requestGeneration === generation) {
        set({ error: error.message });
      }
      throw error;
    }

    // The row is already saved: a failed rating lookup must not make the caller retry and duplicate it.
    const [hydrated] = await hydrateRoundsWithTeeRatings([data]).catch(() => [data as Round]);

    if (requestGeneration === generation) {
      set({ rounds: mergeRounds(get().rounds, [hydrated]), initialized: true, error: null });
    }
    return hydrated;
  },

  upsertRound: (round) => {
    set({ rounds: mergeRounds(get().rounds, [round]) });
  },

  removeRound: (roundId) => {
    set({ rounds: get().rounds.filter((round) => round.id !== roundId) });
  },

  reset: () => {
    generation++;
    set({ rounds: [], loading: true, loadingMore: false, initialized: false, error: null, hasMore: true });
  },
}));
