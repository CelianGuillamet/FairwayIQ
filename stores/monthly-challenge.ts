import { create } from 'zustand';
import { loadStoredChallenge, saveStoredChallenge } from '../lib/monthly-challenge-storage';
import type { ChallengeId } from '../lib/monthly-challenge';

// 'celebrate' when the challenge was seen undone and is now done; 'silent' when it was already
// done the first time this session looked at it, so the badge is kept without a fanfare.
export type DoneOutcome = 'celebrate' | 'silent' | null;

type MonthlyChallengeState = {
  userId: string | null;
  month: string | null;
  challengeId: ChallengeId | null;
  changeUsed: boolean;
  loaded: boolean;
  doneSeen: boolean | null;
  load: (userId: string, month: string) => Promise<void>;
  choose: (challengeId: ChallengeId) => void;
  change: (challengeId: ChallengeId) => boolean;
  observeDone: (done: boolean) => DoneOutcome;
  reset: () => void;
};

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;
let pendingLoad: { key: string; promise: Promise<void> } | null = null;

const INITIAL = {
  userId: null,
  month: null,
  challengeId: null,
  changeUsed: false,
  loaded: false,
  doneSeen: null,
} satisfies Partial<MonthlyChallengeState>;

export const useMonthlyChallengeStore = create<MonthlyChallengeState>((set, get) => ({
  ...INITIAL,

  load: (userId, month) => {
    const state = get();

    if (state.loaded && state.userId === userId && state.month === month) {
      return Promise.resolve();
    }

    const key = `${userId}:${month}`;

    if (pendingLoad?.key === key) {
      return pendingLoad.promise;
    }

    const requestGeneration = generation;
    const promise = (async () => {
      const stored = await loadStoredChallenge(userId);

      if (requestGeneration !== generation) {
        return;
      }

      const current = stored?.month === month ? stored : null;

      set({
        userId,
        month,
        challengeId: current?.challengeId ?? null,
        changeUsed: current?.changeUsed ?? false,
        loaded: true,
        doneSeen: null,
      });
    })().finally(() => {
      if (pendingLoad?.key === key) pendingLoad = null;
    });

    pendingLoad = { key, promise };
    return promise;
  },

  choose: (challengeId) => {
    const { userId, month, loaded, changeUsed, challengeId: current } = get();

    if (!loaded || !userId || !month || current !== null) {
      return;
    }

    set({ challengeId, doneSeen: null });
    void saveStoredChallenge(userId, { month, challengeId, changeUsed });
  },

  change: (challengeId) => {
    const { userId, month, loaded, changeUsed, challengeId: current } = get();

    if (!loaded || !userId || !month || current === null || current === challengeId || changeUsed) {
      return false;
    }

    set({ challengeId, changeUsed: true, doneSeen: null });
    void saveStoredChallenge(userId, { month, challengeId, changeUsed: true });
    return true;
  },

  observeDone: (done) => {
    const { doneSeen } = get();

    set({ doneSeen: done });

    if (doneSeen === null) return done ? 'silent' : null;

    return !doneSeen && done ? 'celebrate' : null;
  },

  reset: () => {
    generation++;
    pendingLoad = null;
    set({ ...INITIAL });
  },
}));
