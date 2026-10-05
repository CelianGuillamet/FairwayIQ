import {
  DEFAULT_WEEKLY_GOAL,
  clampWeeklyGoal,
  countWeeklySessions,
  describeWeeklyBreakdown,
  describeWeeklyProgress,
  getGoalFromFrequency,
  getWeekStart,
  getWeeklyProgress,
  isInCurrentWeek,
  parseStoredGoal,
} from './weekly-goal';

function local(day: number, hour = 12, minute = 0, second = 0) {
  return new Date(2026, 9, day, hour, minute, second);
}

function iso(day: number, hour = 12, minute = 0, second = 0) {
  return local(day, hour, minute, second).toISOString();
}

const WEDNESDAY = local(7);

describe('getGoalFromFrequency', () => {
  it('maps the profile play frequency to sessions per week', () => {
    expect(getGoalFromFrequency('monthly')).toBe(1);
    expect(getGoalFromFrequency('biweekly')).toBe(2);
    expect(getGoalFromFrequency('weekly')).toBe(3);
    expect(getGoalFromFrequency('frequent')).toBe(4);
  });

  it('falls back to the default for an unknown or missing frequency', () => {
    expect(getGoalFromFrequency('daily')).toBe(DEFAULT_WEEKLY_GOAL);
    expect(getGoalFromFrequency('')).toBe(DEFAULT_WEEKLY_GOAL);
    expect(getGoalFromFrequency(null)).toBe(DEFAULT_WEEKLY_GOAL);
    expect(getGoalFromFrequency(undefined)).toBe(DEFAULT_WEEKLY_GOAL);
    expect(getGoalFromFrequency('toString')).toBe(DEFAULT_WEEKLY_GOAL);
  });
});

describe('goal bounds', () => {
  it('keeps the goal between 1 and 7', () => {
    expect(clampWeeklyGoal(0)).toBe(1);
    expect(clampWeeklyGoal(4)).toBe(4);
    expect(clampWeeklyGoal(12)).toBe(7);
    expect(clampWeeklyGoal(2.6)).toBe(3);
    expect(clampWeeklyGoal(Number.NaN)).toBe(DEFAULT_WEEKLY_GOAL);
  });

  it('only accepts a stored whole number from 1 to 7', () => {
    expect(parseStoredGoal('5')).toBe(5);
    expect(parseStoredGoal('1')).toBe(1);
    expect(parseStoredGoal('7')).toBe(7);
    for (const raw of ['0', '8', '-2', '2.5', 'abc', '', ' 3', null, undefined]) {
      expect(parseStoredGoal(raw)).toBeNull();
    }
  });
});

describe('week boundaries (Monday start, device time zone)', () => {
  it('starts the week on Monday at 00:00', () => {
    expect(getWeekStart(WEDNESDAY).getTime()).toBe(local(5, 0).getTime());
    expect(getWeekStart(local(11, 23, 59)).getTime()).toBe(local(5, 0).getTime());
    expect(getWeekStart(local(5, 0)).getTime()).toBe(local(5, 0).getTime());
  });

  it('puts Sunday night in the previous week and Monday 00:00 in the new one', () => {
    const monday = local(5, 10);

    expect(isInCurrentWeek(iso(4, 23, 59, 59), monday)).toBe(false);
    expect(isInCurrentWeek(iso(5, 0), monday)).toBe(true);
    expect(isInCurrentWeek(iso(11, 23, 59, 59), monday)).toBe(true);
    expect(isInCurrentWeek(iso(12, 0), monday)).toBe(false);
  });

  it('ignores an unreadable date', () => {
    expect(isInCurrentWeek('not a date', WEDNESDAY)).toBe(false);
  });
});

describe('countWeeklySessions', () => {
  it('counts the rounds played and the drills completed since Monday', () => {
    const sessions = countWeeklySessions({
      now: WEDNESDAY,
      rounds: [{ played_at: iso(6, 9) }, { played_at: iso(4, 18) }, { played_at: iso(5, 0) }],
      completions: [{ completed_at: iso(7, 8) }, { completed_at: iso(7, 8, 30) }, { completed_at: iso(2, 8) }],
    });

    expect(sessions).toEqual({ rounds: 2, drills: 2, total: 4 });
  });

  it('is empty when nothing happened this week', () => {
    expect(countWeeklySessions({ now: WEDNESDAY, rounds: [], completions: [] })).toEqual({ rounds: 0, drills: 0, total: 0 });
  });

  it('accepts the extra fields of the stores rows', () => {
    const rounds = [{ id: 'r1', played_at: iso(6, 9), total_score: 90 }];
    const completions = [{ id: 'c1', drill_id: '3', completed_at: iso(6, 10) }];

    const sessions = countWeeklySessions({ now: WEDNESDAY, rounds, completions });

    expect(sessions.total).toBe(2);
  });
});

describe('progress', () => {
  it('computes a ratio capped at 1', () => {
    expect(getWeeklyProgress(0, 3)).toBe(0);
    expect(getWeeklyProgress(2, 4)).toBe(0.5);
    expect(getWeeklyProgress(5, 3)).toBe(1);
    expect(getWeeklyProgress(2, 0)).toBe(0);
  });

  it('words the accessibility label with the right plural', () => {
    expect(describeWeeklyProgress(2, 3)).toBe('2 séances sur 3 cette semaine');
    expect(describeWeeklyProgress(1, 3)).toBe('1 séance sur 3 cette semaine');
    expect(describeWeeklyProgress(0, 1)).toBe('0 séance sur 1 cette semaine');
  });

  it('describes what counted so far', () => {
    expect(describeWeeklyBreakdown({ rounds: 1, drills: 1 }, 3)).toBe('1 round et 1 exercice');
    expect(describeWeeklyBreakdown({ rounds: 2, drills: 0 }, 4)).toBe('2 rounds');
    expect(describeWeeklyBreakdown({ rounds: 0, drills: 2 }, 4)).toBe('2 exercices');
    expect(describeWeeklyBreakdown({ rounds: 0, drills: 0 }, 3)).toBe('Un round ou un exercice = une séance');
    expect(describeWeeklyBreakdown({ rounds: 2, drills: 1 }, 3)).toBe('Objectif atteint');
  });
});
