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
  unsynced: EarnedBadges;
  load: (userId: string) => Promise<boolean>;
  award: (ids: readonly BadgeId[], options?: AwardOptions) => Promise<BadgeId[]>;
  retryUnsynced: () => Promise<void>;
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
  unsynced: {},
} satisfies Partial<BadgesState>;

type BadgeRow = { id: BadgeId; earnedAt: string };

// A failed insert keeps its rows in `unsynced`; the next call sends them again along with its own.
// The celebration is not part of it: it was queued once, when the badge was first earned.
async function insertBadges(userId: string, rows: readonly BadgeRow[]) {
  const retried = (Object.entries(useBadgesStore.getState().unsynced) as [BadgeId, string][]).map(([id, earnedAt]) => ({
    id,
    earnedAt,
  }));
  const batch = [...retried, ...rows];

  if (batch.length === 0) {
    return;
  }

  const requestGeneration = generation;
  useBadgesStore.setState({ unsynced: {} });

  let failed = false;

  try {
    const { error } = await supabase.from('user_badges').upsert(
      batch.map((row) => ({ user_id: userId, badge_id: row.id, earned_at: row.earnedAt })),
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    );

    if (error) {
      failed = true;
      console.warn('[badges] award failed', getErrorCode(error));
    }
  } catch (error) {
    failed = true;
    console.warn('[badges] award failed', getErrorCode(error));
  }

  if (failed && requestGeneration === generation) {
    useBadgesStore.setState({
      unsynced: { ...useBadgesStore.getState().unsynced, ...Object.fromEntries(batch.map((row) => [row.id, row.earnedAt])) },
    });
  }
}

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
    const now = new Date().toISOString();
    const rows = fresh.map((id) => ({ id, earnedAt: options.earnedAt?.[id] ?? now }));

    if (fresh.length > 0) {
      set({
        earned: { ...earned, ...Object.fromEntries(rows.map((row) => [row.id, row.earnedAt])) },
        queue: options.celebrate === false ? queue : [...queue, ...fresh],
      });
    }

    await insertBadges(userId, rows);

    return fresh;
  },

  retryUnsynced: async () => {
    const { userId, loaded } = get();

    if (userId && loaded) {
      await insertBadges(userId, []);
    }
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
