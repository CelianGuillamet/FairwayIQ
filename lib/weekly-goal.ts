import { format, isSameWeek, startOfWeek } from 'date-fns';
import type { DrillCompletion } from './drill-library';

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 7;
export const DEFAULT_WEEKLY_GOAL = 3;

const FREQUENCY_GOALS = new Map([
  ['monthly', 1],
  ['biweekly', 2],
  ['weekly', 3],
  ['frequent', 4],
]);

// A day with at least one drill counts once, so five drills in an evening are one session.
export type WeeklySessions = {
  rounds: number;
  drills: number;
  total: number;
};

export function getGoalFromFrequency(playFrequency: string | null | undefined) {
  return FREQUENCY_GOALS.get(playFrequency ?? '') ?? DEFAULT_WEEKLY_GOAL;
}

export function clampWeeklyGoal(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_WEEKLY_GOAL;
  return Math.min(Math.max(Math.round(value), WEEKLY_GOAL_MIN), WEEKLY_GOAL_MAX);
}

export function parseStoredGoal(raw: string | null | undefined) {
  if (raw == null || !/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  return value >= WEEKLY_GOAL_MIN && value <= WEEKLY_GOAL_MAX ? value : null;
}

// Same week rule as the weekly plan in drill-plan.ts: Monday start, in the device's time zone.
export function isInCurrentWeek(date: string | Date, now = new Date()) {
  return isSameWeek(new Date(date), now, { weekStartsOn: 1 });
}

export function getWeekStart(now = new Date()) {
  return startOfWeek(now, { weekStartsOn: 1 });
}

export function countWeeklySessions(input: {
  rounds: readonly { played_at: string }[];
  completions: readonly Pick<DrillCompletion, 'completed_at'>[];
  now?: Date;
}): WeeklySessions {
  const now = input.now ?? new Date();
  const rounds = input.rounds.filter((round) => isInCurrentWeek(round.played_at, now)).length;
  const drillDays = new Set(
    input.completions
      .filter((completion) => isInCurrentWeek(completion.completed_at, now))
      .map((completion) => format(new Date(completion.completed_at), 'yyyy-MM-dd'))
  );
  const drills = drillDays.size;

  return { rounds, drills, total: rounds + drills };
}

export function getWeeklyProgress(count: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(Math.max(count / goal, 0), 1);
}

export function describeWeeklyProgress(count: number, goal: number) {
  return `${count} ${count > 1 ? 'séances' : 'séance'} sur ${goal} cette semaine`;
}

export function describeWeeklyBreakdown(sessions: Pick<WeeklySessions, 'rounds' | 'drills'>, goal: number) {
  if (sessions.rounds + sessions.drills >= goal) {
    return 'Objectif atteint';
  }

  const parts = [
    sessions.rounds > 0 ? `${sessions.rounds} ${sessions.rounds > 1 ? 'rounds' : 'round'}` : null,
    sessions.drills > 0 ? `${sessions.drills} ${sessions.drills > 1 ? 'jours' : 'jour'} d’exercice` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' et ') : 'Un round ou un jour d’exercice = une séance';
}
