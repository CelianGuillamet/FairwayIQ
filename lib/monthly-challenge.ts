import { differenceInCalendarDays, endOfMonth, format, isSameMonth } from 'date-fns';
import type { Round } from '../types';
import { hasNoDouble, hasNoThreePutt } from './badges';
import { DRILLS, DRILL_CATEGORY_LABELS, type DrillCategory } from './drill-library';
import { getCompletionResult, type CompletionWithResult } from './drill-results';
import { hasEnoughLeakData, type HolesByRound, type Leak, type LeaksAnalysis } from './leaks';

export type ChallengeId =
  | 'round_no_three_putt'
  | 'round_no_double'
  | 'rounds_few_penalties'
  | 'rounds_three'
  | `drills_${DrillCategory}`;

export type Challenge = {
  id: ChallengeId;
  title: string;
  description: string;
  rule: string;
  target: number;
  holeBased: boolean;
  category?: DrillCategory;
};

export type ChallengeRound = Pick<Round, 'id' | 'played_at' | 'holes'>;
export type ChallengeCompletion = CompletionWithResult;
export type ChallengeLeaks = {
  lowConfidence: LeaksAnalysis['lowConfidence'];
  leaks: readonly Pick<Leak, 'id' | 'drill'>[];
};

export type ChallengeProgress = {
  current: number;
  target: number;
  done: boolean;
  daysLeft: number;
};

export type StoredChallenge = {
  month: string;
  challengeId: ChallengeId;
  changeUsed: boolean;
};

export const CHALLENGE_DONE_LABEL = 'Défi relevé';
export const DRILLS_TARGET = 4;
export const DRILL_MIN_SUCCESS_PERCENT = 70;
export const PENALTY_LIMIT = 2;

const ROUNDS_TARGET = 3;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const DRILL_CATEGORY_BY_ID = new Map(DRILLS.map((drill) => [drill.id, drill.category]));

const DRILL_SUBJECTS: Record<DrillCategory, string> = {
  putting: 'de putting',
  short_game: 'de petit jeu',
  approach: 'd’approche',
  driving: 'de mise en jeu',
  mental: 'mentaux',
};
const DRILL_CATEGORIES = Object.keys(DRILL_SUBJECTS) as DrillCategory[];

const NO_HOLE_DETAIL = 'Les rounds sans le détail des trous ne comptent pas.';

function drillChallenge(category: DrillCategory): Challenge {
  const subject = DRILL_SUBJECTS[category];

  return {
    id: `drills_${category}`,
    title: `${DRILLS_TARGET} exercices ${subject}`,
    description: `Valide ${DRILLS_TARGET} exercices ${subject} ce mois-ci, avec au moins ${DRILL_MIN_SUCCESS_PERCENT} % de réussite quand tu notes ton résultat.`,
    rule: `Chaque exercice « ${DRILL_CATEGORY_LABELS[category]} » validé ce mois-ci compte pour un. Si tu as noté un résultat, il doit atteindre ${DRILL_MIN_SUCCESS_PERCENT} % de réussite ; sans résultat, l’exercice compte.`,
    target: DRILLS_TARGET,
    holeBased: false,
    category,
  };
}

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'round_no_three_putt',
    title: '18 trous sans 3 putts',
    description: 'Joue un 18 trous sans aucun trou en 3 putts ou plus.',
    rule: `Un round de 18 trous saisi trou par trou, avec 2 putts au plus sur chaque trou. ${NO_HOLE_DETAIL}`,
    target: 1,
    holeBased: true,
  },
  {
    id: 'round_no_double',
    title: '18 trous sans double bogey',
    description: 'Joue un 18 trous sans double bogey ni pire.',
    rule: `Un round de 18 trous saisi trou par trou, sans double bogey ni pire. ${NO_HOLE_DETAIL}`,
    target: 1,
    holeBased: true,
  },
  {
    id: 'rounds_few_penalties',
    title: `${ROUNDS_TARGET} rounds avec moins de ${PENALTY_LIMIT} pénalités`,
    description: `Joue trois rounds avec moins de ${PENALTY_LIMIT} coups de pénalité chacun.`,
    rule: `Chaque round de 9 ou 18 trous saisi trou par trou, avec moins de ${PENALTY_LIMIT} coups de pénalité au total, compte pour un. ${NO_HOLE_DETAIL}`,
    target: ROUNDS_TARGET,
    holeBased: true,
  },
  ...DRILL_CATEGORIES.map(drillChallenge),
  {
    id: 'rounds_three',
    title: `${ROUNDS_TARGET} rounds ce mois-ci`,
    description: 'Joue trois rounds ce mois-ci, quel que soit ton score.',
    rule: 'Chaque round enregistré ce mois-ci compte pour un, de 9 ou 18 trous, avec ou sans le détail des trous.',
    target: ROUNDS_TARGET,
    holeBased: false,
  },
];

const CHALLENGES_BY_ID = new Map<string, Challenge>(CHALLENGES.map((challenge) => [challenge.id, challenge]));

export function isChallengeId(value: unknown): value is ChallengeId {
  return typeof value === 'string' && CHALLENGES_BY_ID.has(value);
}

export function getChallenge(id: ChallengeId) {
  return CHALLENGES_BY_ID.get(id) as Challenge;
}

export function getMonthKey(date = new Date()) {
  return format(date, 'yyyy-MM');
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY.test(value);
}

export function parseStoredChallenge(raw: string | null | undefined): StoredChallenge | null {
  if (raw == null) return null;

  try {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== 'object' || value === null) return null;

    const { month, challengeId, changeUsed } = value as Record<string, unknown>;

    return isMonthKey(month) && isChallengeId(challengeId) && typeof changeUsed === 'boolean'
      ? { month, challengeId, changeUsed }
      : null;
  } catch {
    return null;
  }
}

export function getMonthRounds<T extends Pick<Round, 'id' | 'played_at'>>(rounds: readonly T[], now = new Date()): T[] {
  const unique = new Map(rounds.map((round) => [round.id, round]));

  return [...unique.values()].filter((round) => isSameMonth(new Date(round.played_at), now));
}

function hasFewPenalties(round: Pick<Round, 'holes'>, rows: HolesByRound[string]) {
  if (!rows || rows.length === 0 || rows.length !== round.holes) return false;

  const penalties = rows.reduce((total, hole) => total + (Number.isFinite(hole.penalty) ? hole.penalty : 0), 0);

  return penalties < PENALTY_LIMIT;
}

// A result that cannot be read counts as no result: the drill was validated all the same.
function meetsSuccessBar(completion: ChallengeCompletion) {
  const result = getCompletionResult(completion);

  return result === null || result.made * 100 >= result.attempts * DRILL_MIN_SUCCESS_PERCENT;
}

function countDrills(category: DrillCategory, completions: readonly ChallengeCompletion[], now: Date) {
  return completions.filter(
    (completion) =>
      isSameMonth(new Date(completion.completed_at), now) &&
      DRILL_CATEGORY_BY_ID.get(completion.drill_id) === category &&
      meetsSuccessBar(completion),
  ).length;
}

function countProgress(
  challenge: Challenge,
  input: { rounds: readonly ChallengeRound[]; holesByRound: HolesByRound; completions: readonly ChallengeCompletion[]; now: Date },
) {
  const { holesByRound, now } = input;
  const rounds = getMonthRounds(input.rounds, now);

  switch (challenge.id) {
    case 'round_no_three_putt':
      return rounds.filter((round) => hasNoThreePutt(round, holesByRound[round.id])).length;
    case 'round_no_double':
      return rounds.filter((round) => hasNoDouble(round, holesByRound[round.id])).length;
    case 'rounds_few_penalties':
      return rounds.filter((round) => hasFewPenalties(round, holesByRound[round.id])).length;
    case 'rounds_three':
      return rounds.length;
    default:
      return challenge.category ? countDrills(challenge.category, input.completions, now) : 0;
  }
}

export function getChallengeProgress(input: {
  challenge: Challenge;
  rounds: readonly ChallengeRound[];
  holesByRound: HolesByRound;
  completions: readonly ChallengeCompletion[];
  now?: Date;
}): ChallengeProgress {
  const now = input.now ?? new Date();
  const { target } = input.challenge;
  const count = countProgress(input.challenge, { ...input, now });

  return {
    current: Math.min(count, target),
    target,
    done: count >= target,
    daysLeft: differenceInCalendarDays(endOfMonth(now), now),
  };
}

type ChoiceInput = {
  leaks: ChallengeLeaks | null;
  rounds: readonly ChallengeRound[];
  month: string;
};

function monthIndex(month: string) {
  const [year, number] = month.split('-').map(Number);

  return year * 12 + number;
}

function challengesForLeak(leak: Pick<Leak, 'id' | 'drill'>, input: { playsFullRounds: boolean; month: string }): ChallengeId[] {
  const drills: ChallengeId = `drills_${leak.drill}`;

  switch (leak.id) {
    case 'putting':
      if (!input.playsFullRounds) return [drills];
      return monthIndex(input.month) % 2 === 0 ? ['round_no_three_putt', drills] : [drills, 'round_no_three_putt'];
    case 'penalties':
      return ['rounds_few_penalties'];
    case 'blowups':
      return input.playsFullRounds ? ['round_no_double', drills] : [drills];
    default:
      return [drills];
  }
}

const FULL_ROUND_CHALLENGES = new Set<ChallengeId>(['round_no_three_putt', 'round_no_double']);

// Best fit first: what the top leaks call for, then the rest of the catalog that can apply.
export function candidates(input: ChoiceInput): ChallengeId[] {
  const playsFullRounds = input.rounds.some((round) => round.holes === 18);
  const leaks = input.leaks && hasEnoughLeakData(input.leaks) ? input.leaks.leaks : null;
  const forLeaks = (leaks ?? []).flatMap((leak) => challengesForLeak(leak, { playsFullRounds, month: input.month }));
  const applicable = CHALLENGES.filter(
    (challenge) => (leaks !== null || !challenge.holeBased) && (playsFullRounds || !FULL_ROUND_CHALLENGES.has(challenge.id)),
  ).map((challenge) => challenge.id);

  return [...new Set<ChallengeId>([...forLeaks, 'rounds_three', ...applicable])];
}

export function chooseChallenge(input: ChoiceInput): ChallengeId {
  return candidates(input)[0];
}

export function pickReplacement(input: {
  current: ChallengeId;
  candidates: readonly ChallengeId[];
  isDone?: (id: ChallengeId) => boolean;
}): ChallengeId | null {
  const others = input.candidates.filter((id) => id !== input.current);

  return others.find((id) => !input.isDone?.(id)) ?? others[0] ?? null;
}

export function describeChallengeProgress(progress: Pick<ChallengeProgress, 'current' | 'target'>) {
  return `${progress.current} sur ${progress.target}`;
}

export function describeDaysLeft(daysLeft: number) {
  if (daysLeft <= 0) return 'Dernier jour';

  return `Plus que ${daysLeft} ${daysLeft > 1 ? 'jours' : 'jour'}`;
}
