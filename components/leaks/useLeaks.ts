import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoundsStore } from '../../stores/rounds';
import { HOLES_LOAD_ERROR, getCachedHoles, getHolesFingerprint, loadHolesForRounds } from '../../lib/holes-data';
import { analyzeLeaks, selectLeakRounds, type HolesByRound, type LeaksAnalysis } from '../../lib/leaks';

type Loaded = { key: string; holes: HolesByRound };

export type LeaksResult =
  | { status: 'loading'; analysis: null; error: null; reload: () => void }
  | { status: 'error'; analysis: null; error: string; reload: () => void }
  | { status: 'ready'; analysis: LeaksAnalysis; error: null; reload: () => void };

export function useLeaks(): LeaksResult {
  const rounds = useRoundsStore((state) => state.rounds);
  const initialized = useRoundsStore((state) => state.initialized);
  const windowRounds = useMemo(() => selectLeakRounds(rounds), [rounds]);
  const key = useMemo(
    () => windowRounds.map((round) => `${round.id}@${getHolesFingerprint(round)}`).join('|'),
    [windowRounds],
  );
  const [loaded, setLoaded] = useState<Loaded | null>(() => {
    const cached = initialized ? getCachedHoles(windowRounds) : null;
    return cached ? { key, holes: cached } : null;
  });
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!initialized) return;

    const cached = getCachedHoles(windowRounds);
    setFailedKey(null);

    if (cached) {
      setLoaded({ key, holes: cached });
      return;
    }

    let active = true;

    loadHolesForRounds(windowRounds)
      .then((holes) => {
        if (active && holes) setLoaded({ key, holes });
      })
      .catch(() => {
        if (active) setFailedKey(key);
      });

    return () => {
      active = false;
    };
  }, [initialized, key, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  const holes = loaded?.key === key ? loaded.holes : null;
  const analysis = useMemo(
    () => (initialized && holes ? analyzeLeaks({ rounds: windowRounds, holesByRound: holes }) : null),
    [initialized, holes, windowRounds],
  );

  if (failedKey === key) {
    return { status: 'error', analysis: null, error: HOLES_LOAD_ERROR, reload };
  }

  if (analysis) {
    return { status: 'ready', analysis, error: null, reload };
  }

  return { status: 'loading', analysis: null, error: null, reload };
}
