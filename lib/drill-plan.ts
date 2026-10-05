import { isSameWeek } from 'date-fns';
import type { Drill } from '../types';
import { DRILLS, type DrillCategory, type DrillCompletion } from './drill-library';

export const WEEKLY_PLAN_SIZE = 5;
export const MAX_PLAN_DRILLS_PER_CATEGORY = 3;

const CATEGORY_ORDER: readonly DrillCategory[] = ['putting', 'short_game', 'approach', 'driving', 'mental'];

export type PlanStatus = 'done' | 'next' | 'todo';

export type PlanItem = {
  drill: Drill;
  status: PlanStatus;
};

export type WeeklyPlan = {
  items: PlanItem[];
  doneCount: number;
  total: number;
  next: Drill | null;
};

function isKnownCategory(category: string): category is DrillCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(category);
}

function takeRoundRobin(
  categories: readonly DrillCategory[],
  size: number,
  perCategory: number,
  skip: readonly Drill[] = [],
) {
  const queues = categories.map((category) =>
    DRILLS.filter((drill) => drill.category === category && !skip.includes(drill)).slice(0, perCategory),
  );
  const picked: Drill[] = [];

  for (let round = 0; picked.length < size; round++) {
    const before = picked.length;

    for (const queue of queues) {
      if (picked.length < size && round < queue.length) {
        picked.push(queue[round]);
      }
    }

    if (picked.length === before) break;
  }

  return picked;
}

export function selectPlanDrills(recommendedCategories: string[], size = WEEKLY_PLAN_SIZE) {
  const priority = [...new Set(recommendedCategories.filter(isKnownCategory))];
  const rest = CATEGORY_ORDER.filter((category) => !priority.includes(category));
  const rank = [...priority, ...rest];
  const picked = takeRoundRobin(priority, size, MAX_PLAN_DRILLS_PER_CATEGORY);

  if (picked.length < size) {
    picked.push(...takeRoundRobin(rest, size - picked.length, MAX_PLAN_DRILLS_PER_CATEGORY));
  }

  if (picked.length < size) {
    picked.push(...takeRoundRobin(rank, size - picked.length, Infinity, picked));
  }

  return picked
    .map((drill, index) => ({ drill, index }))
    .sort((left, right) => rank.indexOf(left.drill.category) - rank.indexOf(right.drill.category) || left.index - right.index)
    .map(({ drill }) => drill);
}

export function isDrillDoneThisWeek(drillId: string, completions: DrillCompletion[], now = new Date()) {
  return completions.some(
    (completion) =>
      completion.drill_id === drillId &&
      isSameWeek(new Date(completion.completed_at), now, { weekStartsOn: 1 }),
  );
}

export function buildWeeklyPlan(input: {
  categories: string[];
  completions: DrillCompletion[];
  now?: Date;
  size?: number;
}): WeeklyPlan {
  const now = input.now ?? new Date();
  const drills = selectPlanDrills(input.categories, input.size);
  const doneIds = new Set(
    drills.filter((drill) => isDrillDoneThisWeek(drill.id, input.completions, now)).map((drill) => drill.id),
  );
  const nextDrill = drills.find((drill) => !doneIds.has(drill.id)) ?? null;

  return {
    items: drills.map((drill) => ({
      drill,
      status: doneIds.has(drill.id) ? 'done' : drill.id === nextDrill?.id ? 'next' : 'todo',
    })),
    doneCount: doneIds.size,
    total: drills.length,
    next: nextDrill,
  };
}

export function extractDrillGoal(description: string) {
  const match = /objectif\s*:\s*([^.]+)/i.exec(description);
  const goal = match?.[1].trim();

  return goal ? goal : null;
}
