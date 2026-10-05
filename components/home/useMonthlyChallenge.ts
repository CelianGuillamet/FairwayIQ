import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getCachedHoles, getHolesFingerprint, loadHolesForRounds } from '../../lib/holes-data';
import { LEAKS_WINDOW } from '../../lib/leaks';
import {
  candidates,
  chooseChallenge,
  getChallenge,
  getChallengeProgress,
  getMonthRounds,
  pickReplacement,
  type Challenge,
  type ChallengeProgress,
} from '../../lib/monthly-challenge';
import { useAuthStore } from '../../stores/auth';
import { useBadgesStore } from '../../stores/badges';
import { useDrillsStore } from '../../stores/drills';
import { useMonthlyChallengeStore } from '../../stores/monthly-challenge';
import { useRoundsStore } from '../../stores/rounds';
import type { LeaksResult } from '../leaks/useLeaks';

export type MonthlyChallengeView =
  | { status: 'hidden' }
  | {
      status: 'ready';
      challenge: Challenge;
      progress: ChallengeProgress;
      canChange: boolean;
      changeUsed: boolean;
      change: () => void;
    };

const HIDDEN: MonthlyChallengeView = { status: 'hidden' };

export function useMonthlyChallenge(leaks: LeaksResult): MonthlyChallengeView {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const rounds = useRoundsStore((state) => state.rounds);
  const roundsReady = useRoundsStore((state) => state.initialized);
  const completions = useDrillsStore((state) => state.completions);
  const drillsReady = useDrillsStore((state) => state.initialized);
  const badgesReady = useBadgesStore((state) => state.loaded && state.userId === userId);
  const stored = useMonthlyChallengeStore();
  const day = format(new Date(), 'yyyy-MM-dd');
  const month = day.slice(0, 7);
  const [holesVersion, setHolesVersion] = useState(0);

  const monthRounds = useMemo(() => getMonthRounds(rounds), [rounds, day]);
  const holesKey = useMemo(
    () => monthRounds.map((round) => `${round.id}@${getHolesFingerprint(round)}`).join('|'),
    [monthRounds],
  );
  const holes = useMemo(
    () => (roundsReady ? getCachedHoles(monthRounds) : null),
    [roundsReady, holesKey, holesVersion],
  );

  useEffect(() => {
    if (userId) void useMonthlyChallengeStore.getState().load(userId, month);
  }, [userId, month]);

  const synced = stored.loaded && stored.userId === userId && stored.month === month;
  const hasActivity = rounds.length > 0 || completions.length > 0;
  const dataReady = userId !== null && roundsReady && drillsReady && synced && hasActivity;
  const recentRounds = rounds.slice(0, LEAKS_WINDOW);
  const challenge = dataReady && stored.challengeId ? getChallenge(stored.challengeId) : null;
  const canChoose = dataReady && stored.challengeId === null && leaks.status === 'ready';
  const needsHoles = challenge?.holeBased === true;

  useEffect(() => {
    if (!needsHoles || holes) return;

    let active = true;

    loadHolesForRounds(monthRounds)
      .then(() => {
        if (active) setHolesVersion((version) => version + 1);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [needsHoles, holesKey, holes]);

  useEffect(() => {
    if (!canChoose) return;

    useMonthlyChallengeStore.getState().choose(chooseChallenge({ leaks: leaks.analysis, rounds: recentRounds, month }));
  }, [canChoose]);

  const holesByRound = holes ?? {};
  const progress = useMemo(() => {
    if (!challenge || (challenge.holeBased && !holes)) return null;

    return getChallengeProgress({ challenge, rounds, holesByRound, completions, now: new Date() });
  }, [challenge, rounds, holes, completions, day]);

  const done = progress ? progress.done : null;

  useEffect(() => {
    if (done === null || !badgesReady) return;

    const outcome = useMonthlyChallengeStore.getState().observeDone(done);

    if (outcome) {
      void useBadgesStore.getState().award(['monthly_challenge'], { celebrate: outcome === 'celebrate' });
    }
  }, [done, badgesReady, stored.challengeId, month]);

  const change = useCallback(() => {
    if (!challenge || leaks.status !== 'ready') return;

    const next = pickReplacement({
      current: challenge.id,
      candidates: candidates({ leaks: leaks.analysis, rounds: recentRounds, month }),
      isDone: (id) =>
        getChallengeProgress({ challenge: getChallenge(id), rounds, holesByRound, completions, now: new Date() }).done,
    });

    if (next) useMonthlyChallengeStore.getState().change(next);
  }, [challenge, leaks, rounds, holes, completions, month]);

  if (!challenge || !progress) return HIDDEN;

  return {
    status: 'ready',
    challenge,
    progress,
    canChange: !stored.changeUsed && leaks.status === 'ready',
    changeUsed: stored.changeUsed,
    change,
  };
}
