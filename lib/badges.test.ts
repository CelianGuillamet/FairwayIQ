import {
  BADGES,
  BADGE_IDS,
  backfillBadges,
  computeBadgeStats,
  evaluateDrillBadges,
  evaluateRoundBadges,
  formatBadgeDate,
  getBadge,
  isBadgeId,
  isPerfectResult,
  isWeeklyGoalReached,
  type BadgeCompletion,
  type BadgeHole,
  type BadgeId,
  type BadgeRound,
} from './badges';

function local(month: number, day: number, hour = 12) {
  return new Date(2026, month - 1, day, hour, 0, 0);
}

function iso(month: number, day: number, hour = 12) {
  return local(month, day, hour).toISOString();
}

let roundSeed = 0;

function round(overrides: Partial<BadgeRound> = {}): BadgeRound {
  roundSeed += 1;
  return { id: `round-${roundSeed}`, played_at: iso(3, 1), holes: 18, total_score: 105, ...overrides };
}

function card(holes: Partial<BadgeHole>[] = [], length = 18): BadgeHole[] {
  return Array.from({ length }, (_, index) => ({ par: 4, score: 5, putts: 2, ...holes[index] }));
}

function completion(month: number, day: number, overrides: Partial<BadgeCompletion> = {}): BadgeCompletion {
  return { drill_id: 'drill-1', completed_at: iso(month, day), ...overrides };
}

function manyRounds(count: number): BadgeRound[] {
  return Array.from({ length: count }, (_, index) => round({ id: `many-${index}`, played_at: iso(1, 1 + index) }));
}

function manyCompletions(count: number): BadgeCompletion[] {
  return Array.from({ length: count }, (_, index) => completion(1, 1 + index));
}

describe('catalog', () => {
  it('describes every badge id exactly once, in the order of BADGE_IDS', () => {
    expect(BADGES.map((badge) => badge.id)).toEqual([...BADGE_IDS]);
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length);
    expect(BADGES).toHaveLength(17);
  });

  it('gives each badge a title, a one-line description, an icon and a hint', () => {
    const stats = computeBadgeStats({ rounds: [], completions: [], streak: 0 });

    for (const badge of BADGES) {
      expect(badge.title.length).toBeGreaterThan(0);
      expect(badge.description).toMatch(/^[^\n]+\.$/);
      expect(badge.icon.length).toBeGreaterThan(0);
      expect(badge.hint(stats).length).toBeGreaterThan(0);
    }
  });

  it('looks badges up by id and rejects unknown ids', () => {
    expect(getBadge('break_90').title).toBe('Sous les 90');
    expect(isBadgeId('break_90')).toBe(true);
    expect(isBadgeId('break_70')).toBe(false);
    expect(isBadgeId('toString')).toBe(false);
    expect(isBadgeId(undefined)).toBe(false);
  });
});

describe('evaluateRoundBadges: round counts', () => {
  it('awards the first round, even when the saved round is not in the list yet', () => {
    expect(evaluateRoundBadges({ round: round({ total_score: 110 }), rounds: [], earned: [] })).toEqual(['first_round']);
  });

  it('does not count the saved round twice when it is already in the list', () => {
    const saved = round({ total_score: 110 });
    const rounds = [...manyRounds(3), saved];

    expect(evaluateRoundBadges({ round: saved, rounds, earned: ['first_round'] })).toEqual([]);
  });

  it('awards each threshold at its own count', () => {
    const saved = round({ total_score: 110 });
    const at = (previous: number) =>
      evaluateRoundBadges({ round: saved, rounds: manyRounds(previous), earned: ['first_round'] });

    expect(at(3)).toEqual([]);
    expect(at(4)).toEqual(['rounds_5']);
    expect(at(8)).toEqual(['rounds_5']);
    expect(at(9)).toEqual(['rounds_5', 'rounds_10']);
    expect(at(24)).toEqual(['rounds_5', 'rounds_10', 'rounds_25']);
  });

  it('counts 9-hole rounds toward the round counts', () => {
    const saved = round({ holes: 9, total_score: 48 });

    expect(evaluateRoundBadges({ round: saved, rounds: manyRounds(4), earned: ['first_round'] })).toEqual(['rounds_5']);
  });

  it('ignores duplicate entries for the same round id', () => {
    const duplicated = [...manyRounds(2), ...manyRounds(2)];

    expect(evaluateRoundBadges({ round: round({ total_score: 110 }), rounds: duplicated, earned: ['first_round'] })).toEqual([]);
  });
});

describe('evaluateRoundBadges: breaking a score', () => {
  const at = (total: number, holes: 9 | 18 = 18) =>
    evaluateRoundBadges({
      round: round({ total_score: total, holes }),
      rounds: [],
      earned: ['first_round'],
    });

  it('requires a total strictly below the limit', () => {
    expect(at(100)).toEqual([]);
    expect(at(99)).toEqual(['break_100']);
    expect(at(90)).toEqual(['break_100']);
    expect(at(89)).toEqual(['break_100', 'break_90']);
    expect(at(80)).toEqual(['break_100', 'break_90']);
    expect(at(79)).toEqual(['break_100', 'break_90', 'break_80']);
  });

  it('never counts a 9-hole round, however low the total', () => {
    expect(at(38, 9)).toEqual([]);
    expect(at(1, 9)).toEqual([]);
  });

  it('counts an 18-hole round that has no hole data (legacy round)', () => {
    expect(evaluateRoundBadges({ round: round({ total_score: 85 }), scorecard: undefined, rounds: [], earned: ['first_round'] })).toEqual([
      'break_100',
      'break_90',
    ]);
    expect(evaluateRoundBadges({ round: round({ total_score: 85 }), scorecard: [], rounds: [], earned: ['first_round'] })).toEqual([
      'break_100',
      'break_90',
    ]);
  });

  it('ignores an unusable total', () => {
    expect(at(0)).toEqual([]);
    expect(at(Number.NaN)).toEqual([]);
    expect(at(-5)).toEqual([]);
  });
});

describe('evaluateRoundBadges: hole data', () => {
  const evaluate = (scorecard: BadgeHole[] | undefined, holes: 9 | 18 = 18, total = 105) =>
    evaluateRoundBadges({
      round: round({ holes, total_score: total }),
      scorecard,
      rounds: [],
      earned: ['first_round'],
    });

  it('awards no three-putt and no double for a clean 18-hole card', () => {
    expect(evaluate(card())).toEqual(['no_three_putt', 'no_double']);
  });

  it('a single three-putt cancels no_three_putt only', () => {
    expect(evaluate(card([{ putts: 2 }, { putts: 3 }]))).toEqual(['no_double']);
  });

  it('a single double bogey cancels no_double only', () => {
    expect(evaluate(card([{ score: 6 }]))).toEqual(['no_three_putt']);
    expect(evaluate(card([{ score: 9 }]))).toEqual(['no_three_putt']);
  });

  it('a bogey is not a double bogey', () => {
    expect(evaluate(card([{ score: 5 }]))).toContain('no_double');
  });

  it('treats a hole without putts as unknown for no_three_putt', () => {
    expect(evaluate(card([{ putts: null }, { putts: undefined }]))).toEqual(['no_double']);
  });

  it('never awards the no_* badges for a 9-hole round', () => {
    expect(evaluate(card([], 9), 9, 45)).toEqual([]);
  });

  it('never awards the no_* badges without a full 18-hole card', () => {
    expect(evaluate(undefined)).toEqual([]);
    expect(evaluate(card([], 17))).toEqual([]);
    expect(evaluate(card([], 19))).toEqual([]);
  });

  it('never awards the no_* badges when a hole has no usable score', () => {
    expect(evaluate(card([{ score: Number.NaN }]))).toEqual([]);
    expect(evaluate(card([{ score: 0 }]))).toEqual([]);
  });

  it('awards the first birdie for a hole under par', () => {
    expect(evaluate(card([{ par: 4, score: 3 }]))).toContain('first_birdie');
  });

  it('counts an eagle or an ace as a birdie or better', () => {
    expect(evaluate(card([{ par: 5, score: 3 }]))).toContain('first_birdie');
    expect(evaluate(card([{ par: 3, score: 1 }]))).toContain('first_birdie');
  });

  it('does not count par or bogey as a birdie', () => {
    expect(evaluate(card([{ par: 4, score: 4 }, { par: 3, score: 4 }]))).not.toContain('first_birdie');
  });

  it('counts a birdie from a 9-hole round', () => {
    expect(evaluate(card([{ par: 4, score: 3 }], 9), 9, 40)).toEqual(['first_birdie']);
  });

  it('does not award a birdie without hole data', () => {
    expect(evaluate(undefined)).not.toContain('first_birdie');
  });

  it('combines everything a single great round earns, in catalog order', () => {
    const scorecard = card([{ par: 4, score: 3 }], 18);

    expect(
      evaluateRoundBadges({ round: round({ total_score: 79 }), scorecard, rounds: [], earned: [] }),
    ).toEqual(['first_round', 'first_birdie', 'no_three_putt', 'no_double', 'break_100', 'break_90', 'break_80']);
  });
});

describe('evaluateRoundBadges: weekly goal and idempotency', () => {
  it('awards the weekly goal only when the caller says it is reached', () => {
    const saved = round({ total_score: 110 });

    expect(evaluateRoundBadges({ round: saved, rounds: [], earned: ['first_round'], weeklyGoalReached: false })).toEqual([]);
    expect(evaluateRoundBadges({ round: saved, rounds: [], earned: ['first_round'], weeklyGoalReached: true })).toEqual(['week_goal']);
  });

  it('returns only badges that are not earned yet', () => {
    const saved = round({ total_score: 85 });
    const all = evaluateRoundBadges({ round: saved, rounds: [], earned: [] });

    expect(all).toEqual(['first_round', 'break_100', 'break_90']);
    expect(evaluateRoundBadges({ round: saved, rounds: [], earned: ['break_100'] })).toEqual(['first_round', 'break_90']);
  });

  it('is idempotent: evaluating again with the awarded badges returns nothing', () => {
    const saved = round({ total_score: 85 });
    const first = evaluateRoundBadges({ round: saved, scorecard: card(), rounds: [saved], earned: [], weeklyGoalReached: true });

    expect(first.length).toBeGreaterThan(0);
    expect(evaluateRoundBadges({ round: saved, scorecard: card(), rounds: [saved], earned: first, weeklyGoalReached: true })).toEqual([]);
  });

  it('accepts any iterable of earned ids', () => {
    const saved = round({ total_score: 110 });

    expect(evaluateRoundBadges({ round: saved, rounds: [], earned: new Set(['first_round']) })).toEqual([]);
  });
});

describe('evaluateDrillBadges', () => {
  const evaluate = (
    completions: BadgeCompletion[],
    extra: Partial<Parameters<typeof evaluateDrillBadges>[0]> = {},
  ) => evaluateDrillBadges({ completions, streak: 0, earned: [], ...extra });

  it('awards the first drill, then 10 and 30 completions', () => {
    expect(evaluate([])).toEqual([]);
    expect(evaluate(manyCompletions(1))).toEqual(['first_drill']);
    expect(evaluate(manyCompletions(9), { earned: ['first_drill'] })).toEqual([]);
    expect(evaluate(manyCompletions(10), { earned: ['first_drill'] })).toEqual(['drills_10']);
    expect(evaluate(manyCompletions(30), { earned: ['first_drill', 'drills_10'] })).toEqual(['drills_30']);
  });

  it('counts every completion, repeats of the same drill included', () => {
    const repeated = Array.from({ length: 10 }, () => completion(1, 1, { drill_id: 'same' }));

    expect(evaluate(repeated, { earned: ['first_drill'] })).toEqual(['drills_10']);
  });

  it('awards the streak badges at 7 and 30 days', () => {
    const earned = ['first_drill'];

    expect(evaluate(manyCompletions(1), { streak: 6, earned })).toEqual([]);
    expect(evaluate(manyCompletions(1), { streak: 7, earned })).toEqual(['streak_7']);
    expect(evaluate(manyCompletions(1), { streak: 29, earned: [...earned, 'streak_7'] })).toEqual([]);
    expect(evaluate(manyCompletions(1), { streak: 30, earned: [...earned, 'streak_7'] })).toEqual(['streak_30']);
    expect(evaluate(manyCompletions(1), { streak: 30, earned })).toEqual(['streak_7', 'streak_30']);
  });

  it('awards a perfect drill when every try is made, from 5 attempts', () => {
    const earned = ['first_drill'];
    const withResult = (made: number, attempts: number) => evaluate(manyCompletions(1), { result: { made, attempts }, earned });

    expect(withResult(5, 5)).toEqual(['perfect_drill']);
    expect(withResult(10, 10)).toEqual(['perfect_drill']);
    expect(withResult(100, 100)).toEqual(['perfect_drill']);
  });

  it('does not award a perfect drill for fewer than 5 attempts, a miss or an invalid result', () => {
    const earned = ['first_drill'];
    const withResult = (made: number, attempts: number) => evaluate(manyCompletions(1), { result: { made, attempts }, earned });

    expect(withResult(4, 4)).toEqual([]);
    expect(withResult(1, 1)).toEqual([]);
    expect(withResult(9, 10)).toEqual([]);
    expect(withResult(0, 10)).toEqual([]);
    expect(withResult(11, 10)).toEqual([]);
    expect(withResult(2.5, 5)).toEqual([]);
    expect(evaluate(manyCompletions(1), { result: null, earned })).toEqual([]);
    expect(evaluate(manyCompletions(1), { earned })).toEqual([]);
  });

  it('awards the weekly goal only when the caller says it is reached', () => {
    expect(evaluate(manyCompletions(1), { earned: ['first_drill'], weeklyGoalReached: true })).toEqual(['week_goal']);
    expect(evaluate(manyCompletions(1), { earned: ['first_drill'], weeklyGoalReached: false })).toEqual([]);
  });

  it('is idempotent: evaluating again with the awarded badges returns nothing', () => {
    const input = { completions: manyCompletions(12), streak: 8, result: { made: 10, attempts: 10 }, weeklyGoalReached: true };
    const first = evaluateDrillBadges({ ...input, earned: [] });

    expect(first).toEqual(['first_drill', 'drills_10', 'streak_7', 'perfect_drill', 'week_goal']);
    expect(evaluateDrillBadges({ ...input, earned: first })).toEqual([]);
  });
});

describe('isPerfectResult', () => {
  it('needs a valid result with every try made and at least 5 attempts', () => {
    expect(isPerfectResult({ made: 5, attempts: 5 })).toBe(true);
    expect(isPerfectResult({ made: 4, attempts: 4 })).toBe(false);
    expect(isPerfectResult({ made: 4, attempts: 5 })).toBe(false);
    expect(isPerfectResult(null)).toBe(false);
    expect(isPerfectResult(undefined)).toBe(false);
  });
});

describe('isWeeklyGoalReached', () => {
  const now = local(10, 7);

  it('counts rounds and days with a drill in the current week', () => {
    const rounds = [{ id: 'a', played_at: iso(10, 5) }];
    const completions = [{ completed_at: iso(10, 6) }, { completed_at: iso(10, 6, 18) }];

    expect(isWeeklyGoalReached({ rounds, completions, goal: 2, now })).toBe(true);
    expect(isWeeklyGoalReached({ rounds, completions, goal: 3, now })).toBe(false);
  });

  it('ignores sessions from another week and counts a duplicated round once', () => {
    const rounds = [
      { id: 'a', played_at: iso(10, 6) },
      { id: 'a', played_at: iso(10, 6) },
      { id: 'b', played_at: iso(9, 20) },
    ];

    expect(isWeeklyGoalReached({ rounds, completions: [], goal: 2, now })).toBe(false);
    expect(isWeeklyGoalReached({ rounds, completions: [], goal: 1, now })).toBe(true);
  });
});

describe('backfillBadges', () => {
  it('returns nothing for a player without data', () => {
    expect(backfillBadges({ rounds: [], completions: [] })).toEqual([]);
  });

  it('derives deserved badges with the date they were actually earned', () => {
    const rounds = [
      round({ id: 'r3', played_at: iso(3, 3), total_score: 85 }),
      round({ id: 'r1', played_at: iso(3, 1), total_score: 105 }),
      round({ id: 'r2', played_at: iso(3, 2), total_score: 97 }),
    ];

    expect(backfillBadges({ rounds, completions: [] })).toEqual([
      { id: 'first_round', earnedAt: iso(3, 1) },
      { id: 'break_100', earnedAt: iso(3, 2) },
      { id: 'break_90', earnedAt: iso(3, 3) },
    ]);
  });

  it('dates round count badges at the round that reached the count', () => {
    const rounds = manyRounds(10);
    const entries = backfillBadges({ rounds, completions: [] });

    expect(entries).toEqual([
      { id: 'first_round', earnedAt: iso(1, 1) },
      { id: 'rounds_5', earnedAt: iso(1, 5) },
      { id: 'rounds_10', earnedAt: iso(1, 10) },
    ]);
  });

  it('counts duplicated rounds once', () => {
    const rounds = [...manyRounds(4), ...manyRounds(4)];

    expect(backfillBadges({ rounds, completions: [] }).map((entry) => entry.id)).toEqual(['first_round']);
  });

  it('skips badges already earned', () => {
    const rounds = manyRounds(5);

    expect(backfillBadges({ rounds, completions: [], earned: ['first_round'] }).map((entry) => entry.id)).toEqual(['rounds_5']);
    expect(backfillBadges({ rounds, completions: [], earned: new Set(['first_round', 'rounds_5']) })).toEqual([]);
  });

  it('never derives break or no_* badges from 9-hole rounds', () => {
    const rounds = [round({ id: 'nine', holes: 9, total_score: 38 })];

    expect(backfillBadges({ rounds, holesByRound: { nine: card([], 9) }, completions: [] }).map((entry) => entry.id)).toEqual(['first_round']);
  });

  it('derives break badges for legacy rounds without hole data, but not the hole-based ones', () => {
    const rounds = [round({ id: 'legacy', total_score: 88 })];

    expect(backfillBadges({ rounds, holesByRound: {}, completions: [] }).map((entry) => entry.id)).toEqual([
      'first_round',
      'break_100',
      'break_90',
    ]);
    expect(backfillBadges({ rounds, holesByRound: { legacy: [] }, completions: [] }).map((entry) => entry.id)).toEqual([
      'first_round',
      'break_100',
      'break_90',
    ]);
  });

  it('derives the hole-based badges from the rounds that have hole data', () => {
    const rounds = [
      round({ id: 'old', played_at: iso(2, 1), total_score: 110 }),
      round({ id: 'clean', played_at: iso(2, 8), total_score: 100 }),
    ];
    const holesByRound = {
      old: card([{ score: 7 }, { putts: 3 }]),
      clean: card([{ par: 4, score: 3 }]),
    };

    expect(backfillBadges({ rounds, holesByRound, completions: [] })).toEqual([
      { id: 'first_round', earnedAt: iso(2, 1) },
      { id: 'first_birdie', earnedAt: iso(2, 8) },
      { id: 'no_three_putt', earnedAt: iso(2, 8) },
      { id: 'no_double', earnedAt: iso(2, 8) },
    ]);
  });

  it('keeps the earliest date when several rounds qualify', () => {
    const rounds = [
      round({ id: 'late', played_at: iso(5, 20), total_score: 92 }),
      round({ id: 'early', played_at: iso(4, 2), total_score: 94 }),
    ];

    expect(backfillBadges({ rounds, completions: [] }).find((entry) => entry.id === 'break_100')).toEqual({
      id: 'break_100',
      earnedAt: iso(4, 2),
    });
  });

  it('derives the drill counts and dates them at the completion that reached the count', () => {
    const entries = backfillBadges({ rounds: [], completions: manyCompletions(10) });

    expect(entries).toEqual([
      { id: 'first_drill', earnedAt: iso(1, 1) },
      { id: 'drills_10', earnedAt: iso(1, 10) },
      { id: 'streak_7', earnedAt: iso(1, 7) },
    ]);
  });

  it('derives a streak from the longest run of days with a drill, even when it is broken now', () => {
    const days = [1, 2, 3, 4, 5, 6, 7, 9, 10];
    const completions = days.map((day) => completion(1, day));
    const entries = backfillBadges({ rounds: [], completions });

    expect(entries.find((entry) => entry.id === 'streak_7')).toEqual({ id: 'streak_7', earnedAt: iso(1, 7) });
    expect(entries.find((entry) => entry.id === 'streak_30')).toBeUndefined();
  });

  it('does not chain two runs separated by a missed day, nor count several drills in a day twice', () => {
    const completions = [
      ...[1, 2, 3].map((day) => completion(1, day)),
      ...[5, 6, 7, 8].map((day) => completion(1, day)),
      ...Array.from({ length: 5 }, () => completion(1, 8)),
    ];

    expect(backfillBadges({ rounds: [], completions }).map((entry) => entry.id)).not.toContain('streak_7');
  });

  it('derives a 30-day streak across a month boundary', () => {
    const completions = Array.from({ length: 30 }, (_, index) => ({
      drill_id: 'd',
      completed_at: new Date(2026, 0, 20 + index, 9).toISOString(),
    }));
    const entries = backfillBadges({ rounds: [], completions });

    expect(entries.find((entry) => entry.id === 'streak_30')).toEqual({
      id: 'streak_30',
      earnedAt: new Date(2026, 0, 49, 9).toISOString(),
    });
  });

  it('derives a perfect drill only from a result of at least 5 attempts with every try made', () => {
    const noPerfect = [
      completion(1, 1, { result_made: 4, result_attempts: 4 }),
      completion(1, 2, { result_made: 9, result_attempts: 10 }),
      completion(1, 3, { result_made: null, result_attempts: null }),
      completion(1, 4),
    ];
    const withPerfect = [...noPerfect, completion(1, 20, { result_made: 10, result_attempts: 10 }), completion(1, 15, { result_made: 5, result_attempts: 5 })];

    expect(backfillBadges({ rounds: [], completions: noPerfect }).map((entry) => entry.id)).not.toContain('perfect_drill');
    expect(backfillBadges({ rounds: [], completions: withPerfect }).find((entry) => entry.id === 'perfect_drill')).toEqual({
      id: 'perfect_drill',
      earnedAt: iso(1, 15),
    });
  });

  it('derives the weekly goal from the first week where it was reached, with the goal given', () => {
    const rounds = [
      round({ id: 'a', played_at: iso(10, 5), total_score: 110 }),
      round({ id: 'b', played_at: iso(10, 12), total_score: 110 }),
    ];
    const completions = [
      completion(10, 6),
      completion(10, 6, { completed_at: iso(10, 6, 18) }),
      completion(10, 13),
      completion(10, 14),
    ];

    const withGoal = (weeklyGoal: number | null) =>
      backfillBadges({ rounds, completions, weeklyGoal }).find((entry) => entry.id === 'week_goal');

    expect(withGoal(2)).toEqual({ id: 'week_goal', earnedAt: iso(10, 6) });
    expect(withGoal(3)).toEqual({ id: 'week_goal', earnedAt: iso(10, 14) });
    expect(withGoal(4)).toBeUndefined();
    expect(withGoal(null)).toBeUndefined();
  });

  it('does not count a drill day twice toward the weekly goal', () => {
    const completions = Array.from({ length: 6 }, (_, index) => completion(10, 6, { completed_at: iso(10, 6, 8 + index) }));

    expect(backfillBadges({ rounds: [], completions, weeklyGoal: 2 }).map((entry) => entry.id)).not.toContain('week_goal');
  });

  it('does not chain sessions across two weeks toward the weekly goal', () => {
    const rounds = [
      round({ id: 'sun', played_at: iso(10, 4), total_score: 110 }),
      round({ id: 'mon', played_at: iso(10, 5), total_score: 110 }),
    ];

    expect(backfillBadges({ rounds, completions: [], weeklyGoal: 2 }).map((entry) => entry.id)).not.toContain('week_goal');
  });

  it('leaves out entries whose date cannot be read', () => {
    const rounds = [round({ id: 'bad', played_at: 'not a date', total_score: 85 })];
    const completions = [completion(1, 1, { completed_at: 'nope' })];

    expect(backfillBadges({ rounds, completions })).toEqual([]);
  });

  it('is idempotent: feeding the derived badges back as earned derives nothing', () => {
    const rounds = [...manyRounds(6), round({ id: 'great', played_at: iso(4, 1), total_score: 79 })];
    const holesByRound = { great: card([{ par: 4, score: 3 }]) };
    const completions = [...manyCompletions(12), completion(2, 1, { result_made: 10, result_attempts: 10 })];
    const first = backfillBadges({ rounds, holesByRound, completions, weeklyGoal: 1 });

    expect(first.length).toBeGreaterThan(5);
    expect(
      backfillBadges({ rounds, holesByRound, completions, weeklyGoal: 1, earned: first.map((entry) => entry.id) }),
    ).toEqual([]);
  });

  it('returns badges in catalog order', () => {
    const rounds = [round({ id: 'x', played_at: iso(1, 1), total_score: 70 })];
    const entries = backfillBadges({ rounds, completions: manyCompletions(1) });
    const ids = entries.map((entry) => entry.id);
    const order = (id: BadgeId) => BADGE_IDS.indexOf(id);

    expect(ids).toEqual([...ids].sort((left, right) => order(left) - order(right)));
  });
});

describe('computeBadgeStats and hints', () => {
  const now = local(10, 7);
  const hint = (id: BadgeId, stats: ReturnType<typeof computeBadgeStats>) => getBadge(id).hint(stats);

  it('counts distinct rounds and keeps the best 18-hole total', () => {
    const rounds = [
      round({ id: 'a', total_score: 92 }),
      round({ id: 'a', total_score: 92 }),
      round({ id: 'b', total_score: 88 }),
      round({ id: 'c', holes: 9, total_score: 40 }),
    ];
    const stats = computeBadgeStats({ rounds, completions: [], streak: 0, now });

    expect(stats.rounds).toBe(3);
    expect(stats.bestFullRound).toBe(88);
  });

  it('has no best 18-hole total without an 18-hole round', () => {
    const stats = computeBadgeStats({ rounds: [round({ holes: 9, total_score: 40 })], completions: [], streak: 0, now });

    expect(stats.bestFullRound).toBeNull();
    expect(hint('break_100', stats)).toBe('Moins de 100 sur 18 trous');
  });

  it('writes progress hints with the real numbers, capped at the target', () => {
    const stats = computeBadgeStats({
      rounds: manyRounds(3),
      completions: manyCompletions(12),
      streak: 4,
      weeklyGoal: 3,
      now: local(1, 15),
    });

    expect(hint('rounds_5', stats)).toBe('3 sur 5 rounds');
    expect(hint('rounds_10', stats)).toBe('3 sur 10 rounds');
    expect(hint('drills_10', stats)).toBe('10 sur 10 exercices');
    expect(hint('drills_30', stats)).toBe('12 sur 30 exercices');
    expect(hint('streak_7', stats)).toBe('4 sur 7 jours d’affilée');
    expect(hint('streak_30', stats)).toBe('4 sur 30 jours d’affilée');
  });

  it('names the best score next to a break target', () => {
    const stats = computeBadgeStats({ rounds: [round({ total_score: 96 })], completions: [], streak: 0, now });

    expect(hint('break_90', stats)).toBe('Moins de 90 · ton meilleur : 96');
  });

  it('shows this week’s sessions against the goal, or a plain hint without a goal', () => {
    const rounds = [round({ id: 'w', played_at: iso(10, 6) })];
    const completions = [{ drill_id: 'd', completed_at: iso(10, 7) }];

    expect(hint('week_goal', computeBadgeStats({ rounds, completions, streak: 0, weeklyGoal: 4, now }))).toBe(
      '2 séances sur 4 cette semaine',
    );
    expect(hint('week_goal', computeBadgeStats({ rounds, completions, streak: 0, weeklyGoal: 1, now }))).toBe(
      '1 séance sur 1 cette semaine',
    );
    expect(hint('week_goal', computeBadgeStats({ rounds, completions, streak: 0, now }))).toBe('Atteins ton objectif de la semaine');
  });
});

describe('formatBadgeDate', () => {
  it('formats the earned date in French', () => {
    expect(formatBadgeDate(iso(10, 5))).toBe('5 oct. 2026');
    expect(formatBadgeDate(iso(1, 1))).toBe('1 janv. 2026');
  });

  it('returns an empty string for an unreadable date', () => {
    expect(formatBadgeDate('nope')).toBe('');
  });
});
