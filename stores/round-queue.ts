import { create } from 'zustand';
import { classifyRoundSaveFailure, getErrorCode, saveRound, type SaveRoundArgs } from '../lib/round-save';
import {
  enqueueRound,
  getNextDue,
  loadQueue,
  recordFailure,
  removeRound,
  reviveAttention,
  updateQueue,
  type EnqueueResult,
  type QueuedRound,
} from '../lib/round-save-queue';
import type { BadgeHole } from '../lib/badges';
import type { Round } from '../types';
import { useRoundsStore } from './rounds';

export type FlushReason = 'session' | 'foreground' | 'network' | 'timer' | 'manual';

export type QueuedRoundSent = { round: Round; scorecard: BadgeHole[] };

export const MIN_AUTO_FLUSH_GAP_MS = 5_000;

type RoundQueueState = {
  userId: string | null;
  entries: QueuedRound[];
  loaded: boolean;
  flushing: boolean;
  load: (userId: string) => Promise<void>;
  enqueue: (userId: string, args: SaveRoundArgs) => Promise<EnqueueResult | 'storage'>;
  flush: (reason: FlushReason) => Promise<void>;
  retry: () => Promise<void>;
  discard: (clientRequestId: string) => Promise<void>;
  reset: () => void;
};

// Bumped on reset(): work that started before it belongs to a previous user and must not touch the app state.
let generation = 0;
let pendingLoad: { userId: string; promise: Promise<void> } | null = null;
let inFlight: Promise<void> | null = null;
let lastFlushStartedAt = 0;

const sentListeners = new Set<(sent: QueuedRoundSent) => void>();

export function onQueuedRoundSent(listener: (sent: QueuedRoundSent) => void) {
  sentListeners.add(listener);
  return () => {
    sentListeners.delete(listener);
  };
}

function announceSent(sent: QueuedRoundSent) {
  for (const listener of sentListeners) {
    try {
      listener(sent);
    } catch (error) {
      console.warn('[round-queue] sent listener failed', getErrorCode(error));
    }
  }
}

const INITIAL = {
  userId: null,
  entries: [],
  loaded: false,
  flushing: false,
} satisfies Partial<RoundQueueState>;

export const useRoundQueueStore = create<RoundQueueState>((set, get) => {
  async function commit(ownerId: string, update: (entries: QueuedRound[]) => QueuedRound[]) {
    const outcome = await updateQueue(ownerId, update);

    if (outcome.ok && get().userId === ownerId) {
      set({ entries: outcome.entries });
    }

    return outcome.ok;
  }

  async function send(ownerId: string, entry: QueuedRound, isCurrent: () => boolean) {
    let round: Round;

    try {
      round = await saveRound(entry.args);
    } catch (error) {
      const kind = classifyRoundSaveFailure(error);
      const code = getErrorCode(error);
      const failedAt = Date.now();

      await commit(ownerId, (entries) => entries.map((candidate) => (
        candidate.clientRequestId === entry.clientRequestId ? recordFailure(candidate, kind, code, failedAt) : candidate
      )));

      return kind === 'permanent' ? 'next' : 'stop';
    }

    if (isCurrent() && round?.id) {
      useRoundsStore.getState().upsertRound(round);
      announceSent({ round, scorecard: entry.args.p_holes });
    }

    await commit(ownerId, (entries) => removeRound(entries, entry.clientRequestId));
    return 'next';
  }

  async function run(ownerId: string, reason: FlushReason) {
    const requestGeneration = generation;
    const isCurrent = () => generation === requestGeneration && get().userId === ownerId;
    const force = reason !== 'timer';
    const tried = new Set<string>();

    set({ flushing: true });

    try {
      while (isCurrent()) {
        const entry = getNextDue(get().entries, Date.now(), { force, skip: tried });

        if (!entry) break;

        tried.add(entry.clientRequestId);

        if ((await send(ownerId, entry, isCurrent)) === 'stop') break;
      }
    } catch (error) {
      console.warn('[round-queue] flush failed', getErrorCode(error));
    } finally {
      if (generation === requestGeneration) {
        set({ flushing: false });
      }
    }
  }

  return {
    ...INITIAL,

    load: (userId) => {
      if (get().loaded && get().userId === userId) {
        return Promise.resolve();
      }

      if (pendingLoad?.userId === userId) {
        return pendingLoad.promise;
      }

      const requestGeneration = generation;
      const promise = (async () => {
        const entries = await loadQueue(userId);

        if (requestGeneration !== generation) return;

        set({ userId, entries: entries ?? [], loaded: entries !== null });
      })().finally(() => {
        if (pendingLoad?.userId === userId) pendingLoad = null;
      });

      pendingLoad = { userId, promise };
      return promise;
    },

    enqueue: async (userId, args) => {
      let result: EnqueueResult = 'invalid';

      const outcome = await updateQueue(userId, (entries) => {
        const next = enqueueRound(entries, args, Date.now());
        result = next.result;
        return next.entries;
      });

      if (!outcome.ok) {
        return 'storage';
      }

      if (get().userId === userId || !get().loaded) {
        set({ userId, entries: outcome.entries, loaded: true });
      }

      return result;
    },

    flush: (reason) => {
      if (inFlight) return inFlight;

      const { userId, loaded, entries } = get();
      const now = Date.now();

      if (!userId || !loaded || !getNextDue(entries, now, { force: reason !== 'timer' })) {
        return Promise.resolve();
      }

      if (reason !== 'manual' && now - lastFlushStartedAt < MIN_AUTO_FLUSH_GAP_MS) {
        return Promise.resolve();
      }

      lastFlushStartedAt = now;

      const flight: Promise<void> = run(userId, reason).finally(() => {
        if (inFlight === flight) inFlight = null;
      });

      inFlight = flight;
      return flight;
    },

    retry: async () => {
      const { userId } = get();

      if (!userId) return;

      await commit(userId, reviveAttention);
      await get().flush('manual');
    },

    discard: async (clientRequestId) => {
      const { userId } = get();

      if (!userId) return;

      await commit(userId, (entries) => removeRound(entries, clientRequestId));
    },

    reset: () => {
      generation++;
      pendingLoad = null;
      inFlight = null;
      lastFlushStartedAt = 0;
      set({ ...INITIAL });
    },
  };
});
