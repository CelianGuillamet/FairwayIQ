import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { IconName } from '../components/ui/Icon';
import type { Round } from '../types';
import { getCompletionResult, parseResult, type CompletionWithResult, type DrillResult } from './drill-results';
import { countWeeklySessions, describeWeeklyProgress, getWeekStart } from './weekly-goal';

export const BADGE_IDS = [
  'first_round',
  'rounds_5',
  'rounds_10',
  'rounds_25',
  'first_birdie',
  'no_three_putt',
  'no_double',
  'break_100',
  'break_90',
  'break_80',
  'first_drill',
  'drills_10',
  'drills_30',
  'streak_7',
  'streak_30',
  'perfect_drill',
  'week_goal',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type BadgeRound = Pick<Round, 'id' | 'played_at' | 'holes' | 'total_score'>;
export type BadgeHole = { par: number; score: number; putts?: number | null };
export type BadgeCompletion = CompletionWithResult;
export type HolesByRoundId = Readonly<Record<string, readonly BadgeHole[] | undefined>>;
export type EarnedInput = Iterable<string>;

export type BackfilledBadge = { id: BadgeId; earnedAt: string };

export type BadgeStats = {
  rounds: number;
  bestFullRound: number | null;
  drills: number;
  streak: number;
  weekSessions: number;
  weeklyGoal: number | null;
};

export type BadgeDefinition = {
  id: BadgeId;
  title: string;
  description: string;
  icon: IconName;
  hint: (stats: BadgeStats) => string;
};

const FULL_ROUND_HOLES = 18;
const PERFECT_DRILL_MIN_ATTEMPTS = 5;

type Threshold = readonly [BadgeId, number];

const ROUND_COUNT_BADGES: readonly Threshold[] = [
  ['first_round', 1],
  ['rounds_5', 5],
  ['rounds_10', 10],
  ['rounds_25', 25],
];
const DRILL_COUNT_BADGES: readonly Threshold[] = [
  ['first_drill', 1],
  ['drills_10', 10],
  ['drills_30', 30],
];
const STREAK_BADGES: readonly Threshold[] = [
  ['streak_7', 7],
  ['streak_30', 30],
];
const BREAK_BADGES: readonly Threshold[] = [
  ['break_100', 100],
  ['break_90', 90],
  ['break_80', 80],
];

function progress(value: number, target: number, noun: string) {
  return `${Math.min(value, target)} sur ${target} ${noun}`;
}

function breakHint(limit: number) {
  return (stats: BadgeStats) =>
    stats.bestFullRound == null
      ? `Moins de ${limit} sur 18 trous`
      : `Moins de ${limit} · ton meilleur : ${stats.bestFullRound}`;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'first_round',
    title: 'Premier round',
    description: 'Tu as enregistré ton premier round.',
    icon: 'flag',
    hint: () => 'Enregistre un round',
  },
  {
    id: 'rounds_5',
    title: '5 rounds',
    description: 'Tu as enregistré 5 rounds.',
    icon: 'flag',
    hint: (stats) => progress(stats.rounds, 5, 'rounds'),
  },
  {
    id: 'rounds_10',
    title: '10 rounds',
    description: 'Tu as enregistré 10 rounds.',
    icon: 'flag',
    hint: (stats) => progress(stats.rounds, 10, 'rounds'),
  },
  {
    id: 'rounds_25',
    title: '25 rounds',
    description: 'Tu as enregistré 25 rounds.',
    icon: 'trophy',
    hint: (stats) => progress(stats.rounds, 25, 'rounds'),
  },
  {
    id: 'first_birdie',
    title: 'Premier birdie',
    description: 'Tu as signé ton premier birdie.',
    icon: 'sparkles',
    hint: () => 'Un birdie sur un round saisi trou par trou',
  },
  {
    id: 'no_three_putt',
    title: 'Zéro 3 putts',
    description: 'Tu as joué 18 trous sans 3 putts.',
    icon: 'target',
    hint: () => '18 trous saisis trou par trou, sans 3 putts',
  },
  {
    id: 'no_double',
    title: 'Zéro double bogey',
    description: 'Tu as joué 18 trous sans double bogey ni pire.',
    icon: 'check',
    hint: () => '18 trous saisis trou par trou, sans double bogey',
  },
  {
    id: 'break_100',
    title: 'Sous les 100',
    description: 'Tu as fini un 18 trous en moins de 100 coups.',
    icon: 'arrow-down',
    hint: breakHint(100),
  },
  {
    id: 'break_90',
    title: 'Sous les 90',
    description: 'Tu as fini un 18 trous en moins de 90 coups.',
    icon: 'arrow-down',
    hint: breakHint(90),
  },
  {
    id: 'break_80',
    title: 'Sous les 80',
    description: 'Tu as fini un 18 trous en moins de 80 coups.',
    icon: 'arrow-down',
    hint: breakHint(80),
  },
  {
    id: 'first_drill',
    title: 'Premier exercice',
    description: 'Tu as terminé ton premier exercice.',
    icon: 'clock',
    hint: () => 'Termine un exercice',
  },
  {
    id: 'drills_10',
    title: '10 exercices',
    description: 'Tu as terminé 10 exercices.',
    icon: 'clock',
    hint: (stats) => progress(stats.drills, 10, 'exercices'),
  },
  {
    id: 'drills_30',
    title: '30 exercices',
    description: 'Tu as terminé 30 exercices.',
    icon: 'clock',
    hint: (stats) => progress(stats.drills, 30, 'exercices'),
  },
  {
    id: 'streak_7',
    title: '7 jours d’affilée',
    description: 'Tu t’es entraîné 7 jours de suite.',
    icon: 'flame',
    hint: (stats) => progress(stats.streak, 7, 'jours d’affilée'),
  },
  {
    id: 'streak_30',
    title: '30 jours d’affilée',
    description: 'Tu t’es entraîné 30 jours de suite.',
    icon: 'flame',
    hint: (stats) => progress(stats.streak, 30, 'jours d’affilée'),
  },
  {
    id: 'perfect_drill',
    title: 'Sans faute',
    description: 'Tu as réussi tous tes essais sur un exercice.',
    icon: 'sparkles',
    hint: () => `Tous les essais réussis, ${PERFECT_DRILL_MIN_ATTEMPTS} essais minimum`,
  },
  {
    id: 'week_goal',
    title: 'Objectif de la semaine',
    description: 'Tu as atteint ton objectif de la semaine.',
    icon: 'target',
    hint: (stats) =>
      stats.weeklyGoal == null
        ? 'Atteins ton objectif de la semaine'
        : describeWeeklyProgress(Math.min(stats.weekSessions, stats.weeklyGoal), stats.weeklyGoal),
  },
];

const BADGES_BY_ID = new Map<string, BadgeDefinition>(BADGES.map((badge) => [badge.id, badge]));

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === 'string' && BADGES_BY_ID.has(value);
}

export function getBadge(id: BadgeId) {
  return BADGES_BY_ID.get(id) as BadgeDefinition;
}

export function formatBadgeDate(earnedAt: string) {
  const date = new Date(earnedAt);

  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy', { locale: fr });
}

function hasUsableScore(hole: BadgeHole) {
  return Number.isFinite(hole.par) && Number.isFinite(hole.score) && hole.score > 0;
}

function isFullCard(holes: readonly BadgeHole[] | null | undefined): holes is readonly BadgeHole[] {
  return !!holes && holes.length === FULL_ROUND_HOLES && holes.every(hasUsableScore);
}

function isBreaking(round: BadgeRound, limit: number) {
  return round.holes === FULL_ROUND_HOLES && Number.isFinite(round.total_score) && round.total_score > 0 && round.total_score < limit;
}

function hasBirdie(holes: readonly BadgeHole[] | null | undefined) {
  return !!holes && holes.some((hole) => hasUsableScore(hole) && hole.score < hole.par);
}

// A hole saved without putts is unknown, not clean: it cannot prove a round without 3 putts.
function hasNoThreePutt(round: BadgeRound, holes: readonly BadgeHole[] | null | undefined) {
  return (
    round.holes === FULL_ROUND_HOLES &&
    isFullCard(holes) &&
    holes.every((hole) => typeof hole.putts === 'number' && hole.putts < 3)
  );
}

function hasNoDouble(round: BadgeRound, holes: readonly BadgeHole[] | null | undefined) {
  return round.holes === FULL_ROUND_HOLES && isFullCard(holes) && holes.every((hole) => hole.score - hole.par < 2);
}

function badgesOfRound(round: BadgeRound, holes: readonly BadgeHole[] | null | undefined): BadgeId[] {
  const ids: BadgeId[] = BREAK_BADGES.filter(([, limit]) => isBreaking(round, limit)).map(([id]) => id);

  if (hasBirdie(holes)) ids.push('first_birdie');
  if (hasNoThreePutt(round, holes)) ids.push('no_three_putt');
  if (hasNoDouble(round, holes)) ids.push('no_double');

  return ids;
}

export function isPerfectResult(result: DrillResult | null | undefined) {
  const parsed = result ? parseResult(result.made, result.attempts) : null;

  return parsed !== null && parsed.attempts >= PERFECT_DRILL_MIN_ATTEMPTS && parsed.made === parsed.attempts;
}

function reachedCounts(thresholds: readonly Threshold[], value: number) {
  return thresholds.filter(([, target]) => value >= target).map(([id]) => id);
}

function newlyEarned(reached: Iterable<BadgeId>, earned: EarnedInput) {
  const reachedSet = new Set(reached);
  const earnedSet = new Set(earned);

  return BADGES.map((badge) => badge.id).filter((id) => reachedSet.has(id) && !earnedSet.has(id));
}

export function isWeeklyGoalReached(input: {
  rounds: readonly Pick<BadgeRound, 'id' | 'played_at'>[];
  completions: readonly Pick<BadgeCompletion, 'completed_at'>[];
  goal: number;
  now?: Date;
}) {
  const unique = new Map(input.rounds.map((round) => [round.id, round]));

  return countWeeklySessions({ rounds: [...unique.values()], completions: input.completions, now: input.now }).total >= input.goal;
}

export function evaluateRoundBadges(input: {
  round: BadgeRound;
  scorecard?: readonly BadgeHole[] | null;
  rounds: readonly Pick<BadgeRound, 'id'>[];
  earned: EarnedInput;
  weeklyGoalReached?: boolean;
}): BadgeId[] {
  const roundCount = new Set([...input.rounds.map((round) => round.id), input.round.id]).size;
  const reached = [...badgesOfRound(input.round, input.scorecard), ...reachedCounts(ROUND_COUNT_BADGES, roundCount)];

  if (input.weeklyGoalReached) reached.push('week_goal');

  return newlyEarned(reached, input.earned);
}

export function evaluateDrillBadges(input: {
  completions: readonly BadgeCompletion[];
  streak: number;
  result?: DrillResult | null;
  earned: EarnedInput;
  weeklyGoalReached?: boolean;
}): BadgeId[] {
  const reached = [
    ...reachedCounts(DRILL_COUNT_BADGES, input.completions.length),
    ...reachedCounts(STREAK_BADGES, input.streak),
  ];

  if (isPerfectResult(input.result)) reached.push('perfect_drill');
  if (input.weeklyGoalReached) reached.push('week_goal');

  return newlyEarned(reached, input.earned);
}

type Dated<T> = { item: T; time: number };

// A date that cannot be read cannot be placed in time, so the entry is left out of the backfill.
function chronological<T>(items: readonly T[], read: (item: T) => string): Dated<T>[] {
  return items
    .map((item) => ({ item, time: new Date(read(item)).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => left.time - right.time);
}

function streakReachedAt(completions: readonly Dated<BadgeCompletion>[]) {
  const firstOfDay = new Map<string, number>();

  for (const { time } of completions) {
    const key = format(new Date(time), 'yyyy-MM-dd');
    if (!firstOfDay.has(key)) firstOfDay.set(key, time);
  }

  const reachedAt = new Map<BadgeId, number>();
  let run = 0;
  let previous: Date | null = null;

  for (const time of firstOfDay.values()) {
    const day = startOfDay(new Date(time));
    run = previous && differenceInCalendarDays(day, previous) === 1 ? run + 1 : 1;
    previous = day;

    for (const [id, target] of STREAK_BADGES) {
      if (run >= target && !reachedAt.has(id)) reachedAt.set(id, time);
    }
  }

  return reachedAt;
}

function weeklyGoalReachedAt(rounds: readonly Dated<BadgeRound>[], completions: readonly Dated<BadgeCompletion>[], goal: number) {
  const weeks = new Map<number, { rounds: Dated<BadgeRound>[]; completions: Dated<BadgeCompletion>[] }>();
  const bucket = (time: number) => {
    const key = getWeekStart(new Date(time)).getTime();
    const week = weeks.get(key) ?? { rounds: [], completions: [] };
    weeks.set(key, week);
    return week;
  };

  for (const entry of rounds) bucket(entry.time).rounds.push(entry);
  for (const entry of completions) bucket(entry.time).completions.push(entry);

  let earliest: number | null = null;

  for (const [weekStart, week] of weeks) {
    const times = [...week.rounds, ...week.completions].map((entry) => entry.time).sort((left, right) => left - right);

    for (const time of times) {
      if (earliest !== null && time >= earliest) break;

      const sessions = countWeeklySessions({
        rounds: week.rounds.filter((entry) => entry.time <= time).map((entry) => entry.item),
        completions: week.completions.filter((entry) => entry.time <= time).map((entry) => entry.item),
        now: new Date(weekStart),
      });

      if (sessions.total >= goal) {
        earliest = time;
        break;
      }
    }
  }

  return earliest;
}

export function backfillBadges(input: {
  rounds: readonly BadgeRound[];
  holesByRound?: HolesByRoundId;
  completions: readonly BadgeCompletion[];
  weeklyGoal?: number | null;
  earned?: EarnedInput;
}): BackfilledBadge[] {
  const found = new Map<BadgeId, number>();
  const record = (id: BadgeId, time: number) => {
    const current = found.get(id);
    if (current === undefined || time < current) found.set(id, time);
  };

  const uniqueRounds = [...new Map(input.rounds.map((round) => [round.id, round])).values()];
  const rounds = chronological(uniqueRounds, (round) => round.played_at);
  const completions = chronological(input.completions, (completion) => completion.completed_at);

  for (const [id, target] of ROUND_COUNT_BADGES) {
    const entry = rounds[target - 1];
    if (entry) record(id, entry.time);
  }

  for (const { item, time } of rounds) {
    for (const id of badgesOfRound(item, input.holesByRound?.[item.id])) record(id, time);
  }

  for (const [id, target] of DRILL_COUNT_BADGES) {
    const entry = completions[target - 1];
    if (entry) record(id, entry.time);
  }

  for (const [id, time] of streakReachedAt(completions)) record(id, time);

  for (const { item, time } of completions) {
    if (isPerfectResult(getCompletionResult(item))) record('perfect_drill', time);
  }

  if (input.weeklyGoal != null && input.weeklyGoal >= 1) {
    const time = weeklyGoalReachedAt(rounds, completions, input.weeklyGoal);
    if (time !== null) record('week_goal', time);
  }

  const earned = new Set(input.earned ?? []);

  return BADGES.filter((badge) => found.has(badge.id) && !earned.has(badge.id)).map((badge) => ({
    id: badge.id,
    earnedAt: new Date(found.get(badge.id) as number).toISOString(),
  }));
}

export function computeBadgeStats(input: {
  rounds: readonly Pick<BadgeRound, 'id' | 'played_at' | 'holes' | 'total_score'>[];
  completions: readonly Pick<BadgeCompletion, 'completed_at'>[];
  streak: number;
  weeklyGoal?: number | null;
  now?: Date;
}): BadgeStats {
  const unique = [...new Map(input.rounds.map((round) => [round.id, round])).values()];
  const fullScores = unique
    .filter((round) => round.holes === FULL_ROUND_HOLES && Number.isFinite(round.total_score) && round.total_score > 0)
    .map((round) => round.total_score);

  return {
    rounds: unique.length,
    bestFullRound: fullScores.length > 0 ? Math.min(...fullScores) : null,
    drills: input.completions.length,
    streak: input.streak,
    weekSessions: countWeeklySessions({ rounds: unique, completions: input.completions, now: input.now }).total,
    weeklyGoal: input.weeklyGoal ?? null,
  };
}
