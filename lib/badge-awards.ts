import type { Round } from '../types';
import { useAuthStore } from '../stores/auth';
import { useBadgesStore } from '../stores/badges';
import { useDrillsStore, type Completion } from '../stores/drills';
import { useRoundsStore } from '../stores/rounds';
import {
  backfillBadges,
  evaluateDrillBadges,
  evaluateRoundBadges,
  isWeeklyGoalReached,
  type BadgeHole,
  type BadgeId,
  type HolesByRoundId,
} from './badges';
import { getCompletionResult } from './drill-results';
import { loadHolesForRounds } from './holes-data';
import { getErrorCode } from './round-save';
import { getGoalFromFrequency } from './weekly-goal';
import { loadStoredWeeklyGoal } from './weekly-goal-storage';

const HOLES_CHUNK = 20;
const HOLE_BADGES: readonly BadgeId[] = ['first_birdie', 'no_three_putt', 'no_double'];

async function getWeeklyGoal(userId: string) {
  return (await loadStoredWeeklyGoal(userId)) ?? getGoalFromFrequency(useAuthStore.getState().profile?.play_frequency);
}

function earnedIds() {
  return Object.keys(useBadgesStore.getState().earned);
}

// Hole rows only matter for the hole-based badges, so nothing is fetched once they are all earned.
async function loadBackfillHoles(rounds: readonly Round[], earned: ReadonlySet<string>): Promise<HolesByRoundId | undefined> {
  if (rounds.length === 0 || HOLE_BADGES.every((id) => earned.has(id))) {
    return undefined;
  }

  const holesByRound: Record<string, HolesByRoundId[string]> = {};

  try {
    for (let start = 0; start < rounds.length; start += HOLES_CHUNK) {
      const holes = await loadHolesForRounds(rounds.slice(start, start + HOLES_CHUNK));
      if (!holes) return undefined;
      Object.assign(holesByRound, holes);
    }
  } catch (error) {
    console.warn('[badges] hole rows unavailable for the backfill', getErrorCode(error));
  }

  return holesByRound;
}

async function runSync() {
  try {
    const userId = useAuthStore.getState().user?.id;
    if (!userId || !(await useBadgesStore.getState().load(userId))) return;
    await useBadgesStore.getState().retryUnsynced();
    if (useBadgesStore.getState().backfilled) return;

    const roundsState = useRoundsStore.getState();
    const drillsState = useDrillsStore.getState();
    if (!roundsState.initialized || roundsState.error || !drillsState.initialized) return;

    const earned = new Set(earnedIds());
    const [weeklyGoal, holesByRound] = await Promise.all([
      getWeeklyGoal(userId),
      loadBackfillHoles(roundsState.rounds, earned),
    ]);
    const entries = backfillBadges({
      rounds: roundsState.rounds,
      holesByRound,
      completions: drillsState.completions,
      weeklyGoal,
      earned,
    });

    await useBadgesStore.getState().award(
      entries.map((entry) => entry.id),
      { celebrate: false, earnedAt: Object.fromEntries(entries.map((entry) => [entry.id, entry.earnedAt])) },
    );
    useBadgesStore.getState().markBackfilled(userId);
  } catch (error) {
    console.warn('[badges] backfill failed', getErrorCode(error));
  }
}

let running: Promise<void> | null = null;

// Loads the earned badges, then silently awards what the existing data already deserves, once
// per session: nothing earned before this feature existed is celebrated.
export function syncBadges(): Promise<void> {
  if (!running) {
    running = runSync().finally(() => {
      running = null;
    });
  }

  return running;
}

// An event is only judged against a complete picture: until the backfill has run, the badges it
// would announce could be old ones, so it is left to the silent backfill instead.
async function readyUserId() {
  const userId = useAuthStore.getState().user?.id;
  if (!userId || !(await useBadgesStore.getState().load(userId))) return null;

  if (!useBadgesStore.getState().backfilled) {
    await syncBadges();
    return null;
  }

  return userId;
}

export async function awardAfterRound(round: Round, scorecard: readonly BadgeHole[]) {
  try {
    const userId = await readyUserId();
    if (!userId) return;

    const { rounds } = useRoundsStore.getState();
    const { completions } = useDrillsStore.getState();
    const goal = await getWeeklyGoal(userId);

    await useBadgesStore.getState().award(
      evaluateRoundBadges({
        round,
        scorecard,
        rounds,
        earned: earnedIds(),
        weeklyGoalReached: isWeeklyGoalReached({ rounds: [round, ...rounds], completions, goal }),
      }),
    );
  } catch (error) {
    console.warn('[badges] round evaluation failed', getErrorCode(error));
  }
}

export async function awardAfterDrill(completion: Completion) {
  try {
    const userId = await readyUserId();
    if (!userId) return;

    const { rounds } = useRoundsStore.getState();
    const { completions, getStreak } = useDrillsStore.getState();
    const goal = await getWeeklyGoal(userId);

    await useBadgesStore.getState().award(
      evaluateDrillBadges({
        completions,
        streak: getStreak(),
        result: getCompletionResult(completion),
        earned: earnedIds(),
        weeklyGoalReached: isWeeklyGoalReached({ rounds, completions, goal }),
      }),
    );
  } catch (error) {
    console.warn('[badges] drill evaluation failed', getErrorCode(error));
  }
}
