import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getErrorCode } from '../lib/round-save';
import { isBadgeId, type BadgeId } from '../lib/badges';

type EarnedBadges = Partial<Record<BadgeId, string>>;

type AwardOptions = {
  celebrate?: boolean;
  earnedAt?: Partial<Record<BadgeId, string>>;
};

type BadgesState = {
  userId: string | null;
  earned: EarnedBadges;
  loaded: boolean;
  loading: boolean;
  backfilled: boolean;
  queue: BadgeId[];
  load: (userId: string) => Promise<boolean>;
  award: (ids: readonly BadgeId[], options?: AwardOptions) => Promise<BadgeId[]>;
  markBackfilled: (userId: string) => void;
  dismissCelebration: () => void;
  reset: () => void;
};

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;
let pendingLoad: { userId: string; promise: Promise<boolean> } | null = null;

const INITIAL = {
  userId: null,
  earned: {},
  loaded: false,
  loading: false,
  backfilled: false,
  queue: [],
} satisfies Partial<BadgesState>;

export const useBadgesStore = create<BadgesState>((set, get) => ({
  ...INITIAL,

  load: (userId) => {
    const state = get();

    if (state.loaded && state.userId === userId) {
      return Promise.resolve(true);
    }

    if (pendingLoad?.userId === userId) {
      return pendingLoad.promise;
    }

    const requestGeneration = generation;
    set({ loading: true });

    const promise = (async () => {
      try {
        const { data, error } = await supabase.from('user_badges').select('badge_id, earned_at');

        if (requestGeneration !== generation) {
          return false;
        }

        if (error) {
          console.warn('[badges] load failed', getErrorCode(error));
          return false;
        }

        const earned: EarnedBadges = {};
        for (const row of data ?? []) {
          if (isBadgeId(row.badge_id)) earned[row.badge_id] = row.earned_at;
        }

        set({ userId, earned, loaded: true });
        return true;
      } catch (error) {
        console.warn('[badges] load failed', getErrorCode(error));
        return false;
      } finally {
        if (requestGeneration === generation) {
          pendingLoad = null;
          set({ loading: false });
        }
      }
    })();

    pendingLoad = { userId, promise };
    return promise;
  },

  award: async (ids, options = {}) => {
    const { userId, loaded, earned, queue } = get();

    if (!userId || !loaded) {
      return [];
    }

    const fresh = Array.from(new Set(ids)).filter((id) => isBadgeId(id) && !earned[id]);

    if (fresh.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const rows = fresh.map((id) => ({ user_id: userId, badge_id: id, earned_at: options.earnedAt?.[id] ?? now }));

    set({
      earned: { ...earned, ...Object.fromEntries(rows.map((row) => [row.badge_id, row.earned_at])) },
      queue: options.celebrate === false ? queue : [...queue, ...fresh],
    });

    try {
      const { error } = await supabase
        .from('user_badges')
        .upsert(rows, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });

      if (error) {
        console.warn('[badges] award failed', getErrorCode(error));
      }
    } catch (error) {
      console.warn('[badges] award failed', getErrorCode(error));
    }

    return fresh;
  },

  markBackfilled: (userId) => {
    if (get().userId === userId && get().loaded) {
      set({ backfilled: true });
    }
  },

  dismissCelebration: () => set({ queue: get().queue.slice(1) }),

  reset: () => {
    generation++;
    pendingLoad = null;
    set({ ...INITIAL });
  },
}));
