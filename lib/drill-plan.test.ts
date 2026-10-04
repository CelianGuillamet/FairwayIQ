import { DRILLS } from './drill-library';
import {
  WEEKLY_PLAN_SIZE,
  buildWeeklyPlan,
  extractDrillGoal,
  isDrillDoneThisWeek,
  selectPlanDrills,
} from './drill-plan';

const categoriesOf = (drills: { category: string }[]) => drills.map((drill) => drill.category);

describe('selectPlanDrills', () => {
  it('picks one drill per area when there is no recommendation', () => {
    const plan = selectPlanDrills([]);

    expect(plan).toHaveLength(WEEKLY_PLAN_SIZE);
    expect(categoriesOf(plan)).toEqual(['putting', 'short_game', 'approach', 'driving', 'mental']);
  });

  it('fills the plan with the other areas when a category runs out of drills', () => {
    const plan = selectPlanDrills(['putting']);

    expect(plan).toHaveLength(WEEKLY_PLAN_SIZE);
    expect(categoriesOf(plan)).toEqual(['putting', 'putting', 'putting', 'short_game', 'approach']);
  });

  it('mixes two recommended areas and keeps the recommended order', () => {
    const plan = selectPlanDrills(['short_game', 'putting']);

    expect(categoriesOf(plan)).toEqual(['short_game', 'short_game', 'short_game', 'putting', 'putting']);
  });

  it('returns every drill of a single area in library order', () => {
    const plan = selectPlanDrills(['putting']);

    expect(plan.slice(0, 3).map((drill) => drill.id)).toEqual(['1', '2', '3']);
  });

  it('ignores unknown and duplicated categories', () => {
    expect(selectPlanDrills(['putting', 'putting', 'swing'])).toEqual(selectPlanDrills(['putting']));
  });

  it('honours a smaller size and never repeats a drill', () => {
    const plan = selectPlanDrills(['putting', 'approach'], 3);

    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((drill) => drill.id)).size).toBe(3);
  });

  it('never exceeds the library', () => {
    expect(selectPlanDrills([], 100)).toHaveLength(DRILLS.length);
  });
});

describe('isDrillDoneThisWeek', () => {
  const sunday = new Date(2026, 9, 4, 18, 0);

  it('counts a completion from earlier in the same week, Monday first', () => {
    const monday = new Date(2026, 8, 28, 8, 0).toISOString();

    expect(isDrillDoneThisWeek('1', [{ drill_id: '1', completed_at: monday }], sunday)).toBe(true);
  });

  it('ignores a completion from the previous Sunday', () => {
    const previousSunday = new Date(2026, 8, 27, 20, 0).toISOString();

    expect(isDrillDoneThisWeek('1', [{ drill_id: '1', completed_at: previousSunday }], sunday)).toBe(false);
  });

  it('ignores other drills', () => {
    const today = sunday.toISOString();

    expect(isDrillDoneThisWeek('2', [{ drill_id: '1', completed_at: today }], sunday)).toBe(false);
  });
});

describe('buildWeeklyPlan', () => {
  const now = new Date(2026, 9, 1, 12, 0);
  const done = (drillId: string, month: number, day: number) => ({
    drill_id: drillId,
    completed_at: new Date(2026, month, day, 9, 0).toISOString(),
  });

  it('starts at zero with the first drill as the next one', () => {
    const plan = buildWeeklyPlan({ categories: ['putting'], completions: [], now });

    expect(plan.total).toBe(5);
    expect(plan.doneCount).toBe(0);
    expect(plan.next?.id).toBe('1');
    expect(plan.items.map((item) => item.status)).toEqual(['next', 'todo', 'todo', 'todo', 'todo']);
  });

  it('marks drills done this week and moves the next one forward', () => {
    const plan = buildWeeklyPlan({ categories: ['putting'], completions: [done('1', 8, 29), done('2', 9, 1)], now });

    expect(plan.doneCount).toBe(2);
    expect(plan.next?.id).toBe('3');
    expect(plan.items.map((item) => item.status)).toEqual(['done', 'done', 'next', 'todo', 'todo']);
  });

  it('keeps the next drill when a later one was done first', () => {
    const plan = buildWeeklyPlan({ categories: ['putting'], completions: [done('2', 9, 1)], now });

    expect(plan.items.map((item) => item.status)).toEqual(['next', 'done', 'todo', 'todo', 'todo']);
  });

  it('has no next drill once everything is done', () => {
    const everything = selectPlanDrills(['putting']).map((drill) => done(drill.id, 8, 30));
    const plan = buildWeeklyPlan({ categories: ['putting'], completions: everything, now });

    expect(plan.doneCount).toBe(plan.total);
    expect(plan.next).toBeNull();
    expect(plan.items.every((item) => item.status === 'done')).toBe(true);
  });

  it('resets on Monday', () => {
    const nextMonday = new Date(2026, 9, 5, 8, 0);
    const plan = buildWeeklyPlan({ categories: ['putting'], completions: [done('1', 9, 1)], now: nextMonday });

    expect(plan.doneCount).toBe(0);
  });

  it('counts a drill once even when it was done several times', () => {
    const plan = buildWeeklyPlan({ categories: ['putting'], completions: [done('1', 8, 29), done('1', 8, 30), done('1', 9, 1)], now });

    expect(plan.doneCount).toBe(1);
  });
});

describe('extractDrillGoal', () => {
  it('reads the goal after "Objectif:"', () => {
    expect(extractDrillGoal('Trace un cercle de 1m autour du trou. Sors 10 balles. Objectif: 7/10 dans le cercle.')).toBe(
      '7/10 dans le cercle',
    );
  });

  it('is tolerant to spacing and case', () => {
    expect(extractDrillGoal('objectif : 5/10 minimum.')).toBe('5/10 minimum');
  });

  it('keeps a goal without a final period', () => {
    expect(extractDrillGoal('Objectif: contact propre')).toBe('contact propre');
  });

  it('returns null when the description has no goal', () => {
    expect(extractDrillGoal('Rentre 100 putts de 1 mètre consécutifs.')).toBeNull();
    expect(extractDrillGoal('Objectif:   .')).toBeNull();
  });

  it('finds a goal in every library drill that announces one', () => {
    const withGoal = DRILLS.filter((drill) => /objectif\s*:/i.test(drill.description));

    expect(withGoal.length).toBeGreaterThan(0);
    for (const drill of withGoal) {
      expect(extractDrillGoal(drill.description)).toBeTruthy();
    }
  });
});
