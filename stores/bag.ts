import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  BagError,
  invalidDistanceError,
  isClubId,
  isValidCarry,
  mapBagError,
  sessionError,
  toClubDistances,
  type ClubDistances,
  type ClubId,
} from '../lib/bag';

type BagState = {
  userId: string | null;
  distances: ClubDistances;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (userId: string) => Promise<void>;
  saveDistance: (club: ClubId, carryM: number) => Promise<void>;
  removeDistance: (club: ClubId) => Promise<void>;
  reset: () => void;
};

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;
// Bumped by every load(): only the latest response may fill the bag.
let loadSequence = 0;
// Writes to one club run one after the other, so the last one typed is the one stored.
const writeQueues = new Map<ClubId, Promise<void>>();

function enqueueWrite(club: ClubId, task: () => Promise<void>) {
  const previous = writeQueues.get(club) ?? Promise.resolve();
  const next = previous.then(task);
  const settled = next.catch(() => undefined);
  writeQueues.set(club, settled);
  void settled.then(() => {
    if (writeQueues.get(club) === settled) {
      writeQueues.delete(club);
    }
  });
  return next;
}

function warn(label: string, failure: unknown) {
  const message = typeof failure === 'object' && failure !== null ? (failure as { message?: unknown }).message : failure;
  console.warn(label, { message: String(message) });
}

export const useBagStore = create<BagState>((set, get) => ({
  userId: null,
  distances: {},
  loaded: false,
  loading: false,
  error: null,

  load: async (userId) => {
    const current = get();
    if (current.userId === userId && (current.loaded || current.loading)) {
      return;
    }

    const requestGeneration = generation;
    const requestSequence = ++loadSequence;
    const sameUser = current.userId === userId;

    set({
      userId,
      distances: sameUser ? current.distances : {},
      loaded: false,
      loading: true,
      error: null,
    });

    let rows: Parameters<typeof toClubDistances>[0] = null;
    let failure: unknown = null;
    try {
      const { data, error } = await supabase
        .from('club_distances')
        .select('club, carry_m')
        .eq('user_id', userId);
      rows = data;
      failure = error;
    } catch (thrown) {
      failure = thrown ?? new Error('Request failed');
    }

    if (requestGeneration !== generation || requestSequence !== loadSequence) {
      return;
    }

    if (failure) {
      warn('[bag] Club distances fetch failed', failure);
      set({ loading: false, error: mapBagError(failure, 'load') });
      return;
    }

    set({ distances: toClubDistances(rows), loaded: true, loading: false, error: null });
  },

  saveDistance: (club, carryM) => {
    if (!isClubId(club) || !isValidCarry(carryM)) {
      return Promise.reject(invalidDistanceError());
    }

    const userId = get().userId;
    if (!userId) {
      return Promise.reject(sessionError());
    }

    const requestGeneration = generation;
    return enqueueWrite(club, async () => {
      if (requestGeneration !== generation) {
        return;
      }

      let failure: unknown = null;
      try {
        const { error } = await supabase
          .from('club_distances')
          .upsert(
            { user_id: userId, club, carry_m: carryM, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,club' },
          );
        failure = error;
      } catch (thrown) {
        failure = thrown ?? new Error('Request failed');
      }

      if (failure) {
        warn('[bag] Club distance save failed', failure);
        throw new BagError(mapBagError(failure, 'save'));
      }

      if (requestGeneration === generation) {
        set({ distances: { ...get().distances, [club]: carryM } });
      }
    });
  },

  removeDistance: (club) => {
    if (!isClubId(club)) {
      return Promise.reject(invalidDistanceError());
    }

    const userId = get().userId;
    if (!userId) {
      return Promise.reject(sessionError());
    }

    const requestGeneration = generation;
    return enqueueWrite(club, async () => {
      if (requestGeneration !== generation) {
        return;
      }

      let failure: unknown = null;
      try {
        const { error } = await supabase
          .from('club_distances')
          .delete()
          .eq('user_id', userId)
          .eq('club', club);
        failure = error;
      } catch (thrown) {
        failure = thrown ?? new Error('Request failed');
      }

      if (failure) {
        warn('[bag] Club distance removal failed', failure);
        throw new BagError(mapBagError(failure, 'remove'));
      }

      if (requestGeneration === generation) {
        const rest = { ...get().distances };
        delete rest[club];
        set({ distances: rest });
      }
    });
  },

  reset: () => {
    generation++;
    writeQueues.clear();
    set({ userId: null, distances: {}, loaded: false, loading: false, error: null });
  },
}));
