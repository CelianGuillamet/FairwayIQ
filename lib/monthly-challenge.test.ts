import { DRILLS } from './drill-library';
import type { HoleRow, HolesByRound } from './leaks';
import {
  CHALLENGES,
  candidates,
  chooseChallenge,
  describeChallengeProgress,
  describeDaysLeft,
  getChallenge,
  getChallengeProgress,
  getMonthKey,
  getMonthRounds,
  isChallengeId,
  isMonthKey,
  parseStoredChallenge,
  pickReplacement,
  type ChallengeCompletion,
  type ChallengeId,
  type ChallengeLeaks,
  type ChallengeRound,
} from './monthly-challenge';

const NOW = new Date(2026, 9, 15, 12, 0, 0);

function at(month: number, day: number, hour = 12) {
  return new Date(2026, month - 1, day, hour, 0, 0).toISOString();
}

let roundSeed = 0;

function round(overrides: Partial<ChallengeRound> = {}): ChallengeRound {
  roundSeed += 1;
  return { id: `round-${roundSeed}`, played_at: at(10, 3), holes: 18, ...overrides };
}

function card(overrides: Array<Partial<HoleRow>> = [], length = 18): HoleRow[] {
  return Array.from({ length }, (_, index) => ({
    hole_number: index + 1,
    par: 4,
    score: 5,
    putts: 2,
    gir: false,
    fairway_hit: true,
    penalty: 0,
    ...overrides[index],
  }));
}

function holesOf(...entries: Array<[ChallengeRound, HoleRow[] | undefined]>): HolesByRound {
  return Object.fromEntries(entries.map(([entry, rows]) => [entry.id, rows]));
}

function drill(category: string, index = 0) {
  const match = DRILLS.filter((candidate) => candidate.category === category)[index];
  return match.id;
}

function completion(drillId: string, month: number, day: number, result?: [number, number]): ChallengeCompletion {
  return {
    drill_id: drillId,
    completed_at: at(month, day),
    ...(result ? { result_made: result[0], result_attempts: result[1] } : {}),
  };
}

function progressOf(
  id: ChallengeId,
  input: { rounds?: ChallengeRound[]; holesByRound?: HolesByRound; completions?: ChallengeCompletion[]; now?: Date } = {},
) {
  return getChallengeProgress({
    challenge: getChallenge(id),
    rounds: input.rounds ?? [],
    holesByRound: input.holesByRound ?? {},
    completions: input.completions ?? [],
    now: input.now ?? NOW,
  });
}

function leaksOf(ids: Array<ChallengeLeaks['leaks'][number]['id']>, lowConfidence = false): ChallengeLeaks {
  const drills = { putting: 'putting', penalties: 'driving', blowups: 'mental', tee: 'driving', approach: 'approach', short_game: 'short_game' } as const;

  return { lowConfidence, leaks: ids.map((id) => ({ id, drill: drills[id] })) };
}

const FULL_ROUNDS = [round({ holes: 18 })];

describe('catalog', () => {
  it('has unique ids, each one recognised', () => {
    const ids = CHALLENGES.map((challenge) => challenge.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isChallengeId)).toBe(true);
    expect(isChallengeId('rounds_ten')).toBe(false);
    expect(isChallengeId('toString')).toBe(false);
    expect(isChallengeId(undefined)).toBe(false);
  });

  it('covers the five templates, with one drill challenge per category', () => {
    const ids = CHALLENGES.map((challenge) => challenge.id);

    expect(ids).toEqual(expect.arrayContaining([
      'round_no_three_putt',
      'round_no_double',
      'rounds_few_penalties',
      'rounds_three',
      'drills_putting',
      'drills_short_game',
      'drills_approach',
      'drills_driving',
      'drills_mental',
    ]));
    expect(ids).toHaveLength(9);
  });

  it('gives each challenge a title, a one-sentence description, a rule and a positive target', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.title.length).toBeGreaterThan(0);
      expect(challenge.description).toMatch(/^[^\n]+\.$/);
      expect(challenge.rule.length).toBeGreaterThan(0);
      expect(Number.isInteger(challenge.target)).toBe(true);
      expect(challenge.target).toBeGreaterThan(0);
    }
  });

  it('sets the targets of the spec', () => {
    expect(getChallenge('round_no_three_putt').target).toBe(1);
    expect(getChallenge('round_no_double').target).toBe(1);
    expect(getChallenge('rounds_few_penalties').target).toBe(3);
    expect(getChallenge('rounds_three').target).toBe(3);
    expect(getChallenge('drills_putting').target).toBe(4);
  });

  it('marks the challenges that need the hole by hole detail', () => {
    const holeBased = CHALLENGES.filter((challenge) => challenge.holeBased).map((challenge) => challenge.id);

    expect(holeBased).toEqual(['round_no_three_putt', 'round_no_double', 'rounds_few_penalties']);
  });

  it('words the drill challenges per category', () => {
    expect(getChallenge('drills_putting').title).toBe('4 exercices de putting');
    expect(getChallenge('drills_approach').title).toBe('4 exercices d’approche');
    expect(getChallenge('drills_putting').rule).toContain('70 %');
    expect(getChallenge('drills_putting').category).toBe('putting');
  });
});

describe('month keys and stored state', () => {
  it('formats the month of a date in the device time zone', () => {
    expect(getMonthKey(new Date(2026, 9, 1, 0, 0, 0))).toBe('2026-10');
    expect(getMonthKey(new Date(2026, 8, 30, 23, 59, 59))).toBe('2026-09');
    expect(getMonthKey(new Date(2027, 0, 31))).toBe('2027-01');
  });

  it('recognises month keys', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-00')).toBe(false);
    expect(isMonthKey('26-10')).toBe(false);
    expect(isMonthKey(202610)).toBe(false);
  });

  it('parses a stored challenge and rejects anything else', () => {
    const valid = { month: '2026-10', challengeId: 'drills_putting', changeUsed: true };

    expect(parseStoredChallenge(JSON.stringify(valid))).toEqual(valid);
    expect(parseStoredChallenge(null)).toBeNull();
    expect(parseStoredChallenge(undefined)).toBeNull();
    expect(parseStoredChallenge('{broken')).toBeNull();
    expect(parseStoredChallenge('null')).toBeNull();
    expect(parseStoredChallenge('12')).toBeNull();
    expect(parseStoredChallenge(JSON.stringify({ ...valid, challengeId: 'retired_challenge' }))).toBeNull();
    expect(parseStoredChallenge(JSON.stringify({ ...valid, month: 'octobre' }))).toBeNull();
    expect(parseStoredChallenge(JSON.stringify({ ...valid, changeUsed: 'yes' }))).toBeNull();
    expect(parseStoredChallenge(JSON.stringify({ month: '2026-10', challengeId: 'drills_putting' }))).toBeNull();
  });
});

describe('getMonthRounds', () => {
  it('keeps the rounds of the calendar month, up to its first and last instants', () => {
    const inside = [
      round({ played_at: new Date(2026, 9, 1, 0, 0, 0).toISOString() }),
      round({ played_at: new Date(2026, 9, 31, 23, 59, 59).toISOString() }),
    ];
    const outside = [
      round({ played_at: new Date(2026, 8, 30, 23, 59, 59).toISOString() }),
      round({ played_at: new Date(2026, 10, 1, 0, 0, 0).toISOString() }),
      round({ played_at: new Date(2025, 9, 15).toISOString() }),
    ];

    expect(getMonthRounds([...outside, ...inside], NOW)).toEqual(inside);
  });

  it('counts a round listed twice once, and ignores an unreadable date', () => {
    const once = round();

    expect(getMonthRounds([once, once, round({ played_at: 'not a date' })], NOW)).toEqual([once]);
  });
});

describe('getChallengeProgress: days left', () => {
  const left = (now: Date) => progressOf('rounds_three', { now }).daysLeft;

  it('counts the days after today up to the end of the month', () => {
    expect(left(new Date(2026, 9, 1, 8))).toBe(30);
    expect(left(new Date(2026, 9, 15, 12))).toBe(16);
    expect(left(new Date(2026, 9, 30, 23, 59))).toBe(1);
  });

  it('reaches zero on the last day, whatever the time', () => {
    expect(left(new Date(2026, 9, 31, 0, 0))).toBe(0);
    expect(left(new Date(2026, 9, 31, 23, 59, 59))).toBe(0);
  });

  it('follows the length of the month, leap years included', () => {
    expect(left(new Date(2028, 1, 10))).toBe(19);
    expect(left(new Date(2027, 1, 10))).toBe(18);
    expect(left(new Date(2026, 3, 10))).toBe(20);
  });
});

describe('getChallengeProgress: three rounds', () => {
  it('counts the rounds of the month, with or without hole data', () => {
    const rounds = [round(), round({ holes: 9 }), round({ played_at: at(10, 12) })];
    const holesByRound = holesOf([rounds[0], card()]);

    expect(progressOf('rounds_three', { rounds: rounds.slice(0, 2), holesByRound })).toMatchObject({ current: 2, target: 3, done: false });
    expect(progressOf('rounds_three', { rounds, holesByRound })).toMatchObject({ current: 3, target: 3, done: true });
  });

  it('ignores the rounds of other months', () => {
    const rounds = [round({ played_at: at(9, 30, 23) }), round({ played_at: at(11, 1, 0) }), round()];

    expect(progressOf('rounds_three', { rounds }).current).toBe(1);
  });

  it('never goes above the target', () => {
    const rounds = Array.from({ length: 6 }, () => round());

    expect(progressOf('rounds_three', { rounds })).toMatchObject({ current: 3, target: 3, done: true });
  });

  it('starts at zero', () => {
    expect(progressOf('rounds_three')).toMatchObject({ current: 0, target: 3, done: false });
  });
});

describe('getChallengeProgress: no three-putt round', () => {
  it('counts an 18-hole round with 2 putts or fewer on every hole', () => {
    const clean = round();
    const holesByRound = holesOf([clean, card([{ putts: 1 }, { putts: 0 }])]);

    expect(progressOf('round_no_three_putt', { rounds: [clean], holesByRound })).toMatchObject({ current: 1, target: 1, done: true });
  });

  it('does not count a round whose putts, greens and fairways were never entered (the defaults are 2 putts, no green, no fairway)', () => {
    const scoresOnly = round();
    const holesByRound = holesOf([scoresOnly, card([], 18).map((hole) => ({ ...hole, gir: false, fairway_hit: false }))]);

    expect(progressOf('round_no_three_putt', { rounds: [scoresOnly], holesByRound })).toMatchObject({ current: 0, done: false });
  });

  it('counts such a round once a green or a fairway was marked', () => {
    const marked = round();
    const rows = card([], 18).map((hole, index) => ({ ...hole, gir: index === 4, fairway_hit: false }));

    expect(progressOf('round_no_three_putt', { rounds: [marked], holesByRound: holesOf([marked, rows]) })).toMatchObject({ current: 1, done: true });
  });

  it('keeps counting the other hole-based rules on a scores-only round', () => {
    const scoresOnly = round();
    const rows = card([{ score: 3 }], 18).map((hole) => ({ ...hole, gir: false, fairway_hit: false }));
    const holesByRound = holesOf([scoresOnly, rows]);

    expect(progressOf('round_no_double', { rounds: [scoresOnly], holesByRound }).done).toBe(true);
    expect(progressOf('rounds_few_penalties', { rounds: [scoresOnly], holesByRound }).current).toBe(1);
  });

  it('does not count a round with a three-putt hole', () => {
    const dirty = round();
    const holesByRound = holesOf([dirty, card([{}, {}, { putts: 3 }])]);

    expect(progressOf('round_no_three_putt', { rounds: [dirty], holesByRound })).toMatchObject({ current: 0, done: false });
  });

  it('does not count a hole saved without putts, which is unknown rather than clean', () => {
    const unknown = round();
    const holesByRound = holesOf([unknown, card([{ putts: null }])]);

    expect(progressOf('round_no_three_putt', { rounds: [unknown], holesByRound }).done).toBe(false);
  });

  it('never counts a 9-hole round, an incomplete card or a legacy round', () => {
    const nine = round({ holes: 9 });
    const short = round();
    const legacy = round();
    const missing = round();
    const holesByRound = holesOf([nine, card([], 9)], [short, card([], 17)], [legacy, []], [missing, undefined]);

    expect(progressOf('round_no_three_putt', { rounds: [nine, short, legacy, missing], holesByRound })).toMatchObject({ current: 0, done: false });
  });

  it('only looks at the current month', () => {
    const lastMonth = round({ played_at: at(9, 28) });

    expect(progressOf('round_no_three_putt', { rounds: [lastMonth], holesByRound: holesOf([lastMonth, card()]) }).current).toBe(0);
  });
});

describe('getChallengeProgress: no double bogey round', () => {
  it('counts an 18-hole round without a double bogey or worse', () => {
    const clean = round();
    const holesByRound = holesOf([clean, card([{ score: 3 }, { score: 5 }])]);

    expect(progressOf('round_no_double', { rounds: [clean], holesByRound })).toMatchObject({ current: 1, target: 1, done: true });
  });

  it('does not count a round with a double bogey, or worse', () => {
    const dirty = round();
    const worse = round();
    const holesByRound = holesOf([dirty, card([{ score: 6 }])], [worse, card([{ score: 9 }])]);

    expect(progressOf('round_no_double', { rounds: [dirty, worse], holesByRound }).current).toBe(0);
  });

  it('needs 18 holes of detail', () => {
    const nine = round({ holes: 9 });
    const legacy = round();
    const holesByRound = holesOf([nine, card([], 9)], [legacy, undefined]);

    expect(progressOf('round_no_double', { rounds: [nine, legacy], holesByRound }).current).toBe(0);
  });
});

describe('getChallengeProgress: rounds with few penalties', () => {
  const withPenalties = (penalties: number[], overrides: Partial<ChallengeRound> = {}) => {
    const entry = round(overrides);
    const length = entry.holes;
    return [entry, card(penalties.map((penalty) => ({ penalty })), length)] as [ChallengeRound, HoleRow[]];
  };

  it('counts the rounds with fewer than 2 penalty strokes in total', () => {
    const entries = [withPenalties([]), withPenalties([1]), withPenalties([2]), withPenalties([1, 1])];

    expect(progressOf('rounds_few_penalties', {
      rounds: entries.map(([entry]) => entry),
      holesByRound: holesOf(...entries),
    })).toMatchObject({ current: 2, target: 3, done: false });
  });

  it('is done at three clean rounds, 9-hole rounds included', () => {
    const entries = [withPenalties([]), withPenalties([1], { holes: 9 }), withPenalties([0, 1])];

    expect(progressOf('rounds_few_penalties', {
      rounds: entries.map(([entry]) => entry),
      holesByRound: holesOf(...entries),
    })).toMatchObject({ current: 3, done: true });
  });

  it('never counts a legacy round or a card with missing holes', () => {
    const legacy = round();
    const missing = round();
    const partial = round();
    const holesByRound = holesOf([legacy, []], [missing, undefined], [partial, card([], 12)]);

    expect(progressOf('rounds_few_penalties', { rounds: [legacy, missing, partial], holesByRound }).current).toBe(0);
  });

  it('ignores the rounds of other months', () => {
    const [old, rows] = withPenalties([], { played_at: at(9, 20) });

    expect(progressOf('rounds_few_penalties', { rounds: [old], holesByRound: holesOf([old, rows]) }).current).toBe(0);
  });
});

describe('getChallengeProgress: drills of a category', () => {
  const putting = (index: number) => drill('putting', index);

  it('counts the completions of the category validated this month', () => {
    const completions = [
      completion(putting(0), 10, 2),
      completion(putting(1), 10, 9),
      completion(drill('approach'), 10, 9),
      completion(putting(2), 9, 28),
    ];

    expect(progressOf('drills_putting', { completions })).toMatchObject({ current: 2, target: 4, done: false });
    expect(progressOf('drills_approach', { completions }).current).toBe(1);
    expect(progressOf('drills_driving', { completions }).current).toBe(0);
  });

  it('counts a completion without a result as done', () => {
    const completions = Array.from({ length: 4 }, (_, index) => completion(putting(index), 10, 1 + index));

    expect(progressOf('drills_putting', { completions })).toMatchObject({ current: 4, done: true });
  });

  it('requires 70 % or more when a result exists', () => {
    const passing = [completion(putting(0), 10, 1, [7, 10]), completion(putting(1), 10, 2, [14, 20]), completion(putting(2), 10, 3, [10, 10])];
    const failing = [completion(putting(3), 10, 4, [6, 10]), completion(putting(4), 10, 5, [69, 100]), completion(putting(5), 10, 6, [0, 5])];

    expect(progressOf('drills_putting', { completions: passing }).current).toBe(3);
    expect(progressOf('drills_putting', { completions: failing }).current).toBe(0);
    expect(progressOf('drills_putting', { completions: [...passing, ...failing] }).current).toBe(3);
  });

  it('treats an unreadable result as no result', () => {
    const completions: ChallengeCompletion[] = [
      { drill_id: putting(0), completed_at: at(10, 2), result_made: 5, result_attempts: null },
      { drill_id: putting(1), completed_at: at(10, 3), result_made: 11, result_attempts: 10 },
    ];

    expect(progressOf('drills_putting', { completions }).current).toBe(2);
  });

  it('ignores drills the library does not know', () => {
    expect(progressOf('drills_putting', { completions: [completion('999', 10, 2)] }).current).toBe(0);
  });

  it('counts the first and last instants of the month', () => {
    const completions: ChallengeCompletion[] = [
      { drill_id: putting(0), completed_at: new Date(2026, 9, 1, 0, 0, 0).toISOString() },
      { drill_id: putting(1), completed_at: new Date(2026, 9, 31, 23, 59, 59).toISOString() },
      { drill_id: putting(2), completed_at: new Date(2026, 8, 30, 23, 59, 59).toISOString() },
      { drill_id: putting(3), completed_at: new Date(2026, 10, 1, 0, 0, 0).toISOString() },
    ];

    expect(progressOf('drills_putting', { completions }).current).toBe(2);
  });

  it('does not need any hole data', () => {
    const completions = Array.from({ length: 4 }, (_, index) => completion(drill('mental', index), 10, 1 + index));

    expect(progressOf('drills_mental', { completions, holesByRound: {} }).done).toBe(true);
  });
});

describe('chooseChallenge', () => {
  const choose = (leaks: ChallengeLeaks | null, overrides: { rounds?: ChallengeRound[]; month?: string } = {}) =>
    chooseChallenge({ leaks, rounds: overrides.rounds ?? FULL_ROUNDS, month: overrides.month ?? '2026-10' });

  it('alternates the putting challenge from one month to the next, across years', () => {
    const putting = leaksOf(['putting']);

    expect(choose(putting, { month: '2026-10' })).toBe('round_no_three_putt');
    expect(choose(putting, { month: '2026-11' })).toBe('drills_putting');
    expect(choose(putting, { month: '2026-12' })).toBe('round_no_three_putt');
    expect(choose(putting, { month: '2027-01' })).toBe('drills_putting');
    expect(choose(putting, { month: '2027-02' })).toBe('round_no_three_putt');
  });

  it('falls back to putting drills when the player never plays 18 holes', () => {
    const nines = [round({ holes: 9 }), round({ holes: 9 })];

    expect(choose(leaksOf(['putting']), { rounds: nines, month: '2026-10' })).toBe('drills_putting');
  });

  it('maps penalties to the penalty challenge, even for 9-hole players', () => {
    expect(choose(leaksOf(['penalties']))).toBe('rounds_few_penalties');
    expect(choose(leaksOf(['penalties']), { rounds: [round({ holes: 9 })] })).toBe('rounds_few_penalties');
  });

  it('maps blow-ups to a round without a double bogey, or to mental drills without 18-hole rounds', () => {
    expect(choose(leaksOf(['blowups']))).toBe('round_no_double');
    expect(choose(leaksOf(['blowups']), { rounds: [round({ holes: 9 })] })).toBe('drills_mental');
  });

  it('maps tee, approach and short game to drills of their category', () => {
    expect(choose(leaksOf(['tee']))).toBe('drills_driving');
    expect(choose(leaksOf(['approach']))).toBe('drills_approach');
    expect(choose(leaksOf(['short_game']))).toBe('drills_short_game');
  });

  it('only follows the top leak', () => {
    expect(choose(leaksOf(['approach', 'putting', 'penalties']))).toBe('drills_approach');
    expect(choose(leaksOf(['penalties', 'approach']))).toBe('rounds_few_penalties');
  });

  it('falls back to three rounds when there is not enough hole data', () => {
    expect(choose(null)).toBe('rounds_three');
    expect(choose(leaksOf(['putting'], true))).toBe('rounds_three');
    expect(choose(leaksOf([]))).toBe('rounds_three');
    expect(choose(null, { rounds: [] })).toBe('rounds_three');
  });

  it('gives the same answer for the same input', () => {
    const leaks = leaksOf(['putting', 'tee']);

    expect(choose(leaks)).toBe(choose(leaks));
  });
});

describe('candidates', () => {
  const list = (leaks: ChallengeLeaks | null, overrides: { rounds?: ChallengeRound[]; month?: string } = {}) =>
    candidates({ leaks, rounds: overrides.rounds ?? FULL_ROUNDS, month: overrides.month ?? '2026-10' });

  it('starts with the chosen challenge', () => {
    const leaks = leaksOf(['putting', 'penalties']);

    expect(list(leaks)[0]).toBe(chooseChallenge({ leaks, rounds: FULL_ROUNDS, month: '2026-10' }));
  });

  it('lists the other leaks next, in their order, then three rounds', () => {
    expect(list(leaksOf(['approach', 'penalties', 'tee'])).slice(0, 4)).toEqual([
      'drills_approach',
      'rounds_few_penalties',
      'drills_driving',
      'rounds_three',
    ]);
  });

  it('offers both putting challenges, the preferred one of the month first', () => {
    expect(list(leaksOf(['putting']), { month: '2026-10' }).slice(0, 2)).toEqual(['round_no_three_putt', 'drills_putting']);
    expect(list(leaksOf(['putting']), { month: '2026-11' }).slice(0, 2)).toEqual(['drills_putting', 'round_no_three_putt']);
  });

  it('never repeats a challenge and always keeps a way to change', () => {
    for (const leaks of [leaksOf(['putting', 'blowups', 'penalties']), leaksOf(['tee']), null]) {
      const ids = list(leaks);

      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('rounds_three');
      expect(ids.length).toBeGreaterThan(1);
    }
  });

  it('covers the whole catalog when the data is there', () => {
    expect([...list(leaksOf(['putting']))].sort()).toEqual(CHALLENGES.map((challenge) => challenge.id).sort());
  });

  it('leaves out the hole-based challenges without enough hole data', () => {
    expect(list(null)).toEqual([
      'rounds_three',
      'drills_putting',
      'drills_short_game',
      'drills_approach',
      'drills_driving',
      'drills_mental',
    ]);
    expect(list(leaksOf(['putting'], true))).toEqual(list(null));
  });

  it('leaves out the 18-hole challenges for a player who only plays 9 holes', () => {
    const ids = list(leaksOf(['putting', 'blowups', 'penalties']), { rounds: [round({ holes: 9 })] });

    expect(ids).not.toContain('round_no_three_putt');
    expect(ids).not.toContain('round_no_double');
    expect(ids).toEqual(expect.arrayContaining(['rounds_few_penalties', 'drills_putting', 'drills_mental', 'rounds_three']));
  });
});

describe('pickReplacement', () => {
  const order: ChallengeId[] = ['drills_putting', 'rounds_few_penalties', 'rounds_three'];

  it('takes the first candidate other than the current one', () => {
    expect(pickReplacement({ current: 'drills_putting', candidates: order })).toBe('rounds_few_penalties');
    expect(pickReplacement({ current: 'rounds_three', candidates: order })).toBe('drills_putting');
  });

  it('skips the candidates already done', () => {
    expect(pickReplacement({
      current: 'drills_putting',
      candidates: order,
      isDone: (id) => id === 'rounds_few_penalties',
    })).toBe('rounds_three');
  });

  it('still changes when every other candidate is done', () => {
    expect(pickReplacement({ current: 'drills_putting', candidates: order, isDone: () => true })).toBe('rounds_few_penalties');
  });

  it('has nothing to offer when the current challenge is the only one', () => {
    expect(pickReplacement({ current: 'rounds_three', candidates: ['rounds_three'] })).toBeNull();
    expect(pickReplacement({ current: 'rounds_three', candidates: [] })).toBeNull();
  });
});

describe('wording', () => {
  it('writes the progress as "x sur y"', () => {
    expect(describeChallengeProgress({ current: 1, target: 3 })).toBe('1 sur 3');
    expect(describeChallengeProgress({ current: 0, target: 1 })).toBe('0 sur 1');
  });

  it('writes the days left, with the last day on its own', () => {
    expect(describeDaysLeft(12)).toBe('Plus que 12 jours');
    expect(describeDaysLeft(2)).toBe('Plus que 2 jours');
    expect(describeDaysLeft(1)).toBe('Plus que 1 jour');
    expect(describeDaysLeft(0)).toBe('Dernier jour');
  });
});
