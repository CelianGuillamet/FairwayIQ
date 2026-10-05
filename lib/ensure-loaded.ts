import { useDrillsStore } from '../stores/drills';
import { useRoundsStore } from '../stores/rounds';

export function createLoadOnce(isLoaded: () => boolean, load: () => Promise<unknown>) {
  let inFlight: Promise<void> | null = null;

  return function ensureLoaded(): Promise<void> {
    if (isLoaded()) {
      return Promise.resolve();
    }

    if (!inFlight) {
      inFlight = new Promise<unknown>((resolve) => resolve(load()))
        .catch((error: any) => {
          console.warn('[stores] Load failed', error?.message ?? error);
        })
        .then(() => {
          inFlight = null;
        });
    }

    return inFlight;
  };
}

export const ensureRoundsLoaded = createLoadOnce(
  () => useRoundsStore.getState().initialized,
  () => useRoundsStore.getState().fetchRounds(),
);

export const ensureCompletionsLoaded = createLoadOnce(
  () => useDrillsStore.getState().initialized,
  () => useDrillsStore.getState().fetchCompletions(),
);
