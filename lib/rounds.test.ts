import {
  aggregateScorecard,
  createDefaultScorecard,
  getAveragePenaltyCount,
  getAveragePuttsPer18Holes,
  getAverageScorePer18Holes,
  getAverageScoreToParPer18Holes,
  getBestRound,
  getEstimatedHandicapIndex,
  getHandicapIndexCard,
  getHandicapIndexEstimate,
  getScorecardProgress,
  getScoreToParTrend,
  hasRecordedHoleDetails,
} from './rounds';
import type { Round, RoundDraftHole } from '../types';

function makeHole(overrides: Partial<RoundDraftHole> = {}): RoundDraftHole {
  return {
    hole_number: 1,
    par: 4,
    score: 4,
    putts: 2,
    gir: false,
    fairway_hit: false,
    penalty: 0,
    completed: true,
    ...overrides,
  };
}

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round-1',
    user_id: 'user-1',
    played_at: '2026-01-01T00:00:00.000Z',
    course_id: null,
    course_name: null,
    course_provider: null,
    provider_course_id: null,
    tee_key: null,
    tee_set_id: null,
    tee_name: null,
    tee_color: null,
    total_score: 90,
    par: 72,
    holes: 18,
    putts: null,
    gir: null,
    fairways_hit: null,
    fairways_total: null,
    penalties: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('aggregateScorecard', () => {
  it('aggregates a typical completed 18-hole scorecard', () => {
    const scorecard: RoundDraftHole[] = [
      ...Array.from({ length: 9 }, (_, i) =>
        makeHole({ hole_number: i + 1, par: 4, score: 5, putts: 2, gir: i < 3, fairway_hit: i < 4 })
      ),
      ...Array.from({ length: 9 }, (_, i) =>
        makeHole({ hole_number: i + 10, par: 4, score: 4, putts: 2, gir: true, fairway_hit: true })
      ),
    ];

    const aggregate = aggregateScorecard(scorecard);

    expect(aggregate.holes).toBe(18);
    expect(aggregate.par).toBe(72);
    expect(aggregate.total_score).toBe(9 * 5 + 9 * 4);
    expect(aggregate.putts).toBe(36);
    expect(aggregate.average_putts_per_hole).toBe(2);
    expect(aggregate.gir).toBe(3 + 9);
    expect(aggregate.gir_percentage).toBe(Math.round(((3 + 9) / 18) * 100));
    expect(aggregate.fairways_total).toBe(18);
    expect(aggregate.fairways_hit).toBe(4 + 9);
    expect(aggregate.fairway_percentage).toBe(Math.round(((4 + 9) / 18) * 100));
    expect(aggregate.front_nine_score).toBe(9 * 5);
    expect(aggregate.back_nine_score).toBe(9 * 4);
    expect(aggregate.front_nine_to_par).toBe(9 * 5 - 9 * 4);
    expect(aggregate.back_nine_to_par).toBe(0);
    expect(aggregate.score_to_par).toBe(aggregate.total_score - aggregate.par);
  });

  it('leaves back-nine fields null for a 9-hole scorecard', () => {
    const scorecard = createDefaultScorecard(9).map((hole) => ({ ...hole, completed: true }));

    const aggregate = aggregateScorecard(scorecard);

    expect(aggregate.holes).toBe(9);
    expect(aggregate.back_nine_score).toBeNull();
    expect(aggregate.back_nine_to_par).toBeNull();
    expect(aggregate.front_nine_score).toBe(aggregate.total_score);
  });

  it('returns a null fairway_percentage when there are no par-4+ holes', () => {
    const scorecard: RoundDraftHole[] = Array.from({ length: 9 }, (_, i) =>
      makeHole({ hole_number: i + 1, par: 3, score: 3, fairway_hit: null })
    );

    const aggregate = aggregateScorecard(scorecard);

    expect(aggregate.fairways_total).toBe(0);
    expect(aggregate.fairways_hit).toBe(0);
    expect(aggregate.fairway_percentage).toBeNull();
  });

  it('handles an empty scorecard without throwing', () => {
    const aggregate = aggregateScorecard([]);

    expect(aggregate.par).toBe(0);
    expect(aggregate.total_score).toBe(0);
    expect(aggregate.score_to_par).toBe(0);
    expect(aggregate.fairway_percentage).toBeNull();
  });
});

describe('getScorecardProgress', () => {
  it('reports zero progress when nothing is completed', () => {
    const scorecard = createDefaultScorecard(18);

    const progress = getScorecardProgress(scorecard);

    expect(progress.completedHoles).toBe(0);
    expect(progress.progressPercentage).toBe(0);
    expect(progress.liveScore).toBe(0);
    expect(progress.livePar).toBe(0);
    expect(progress.remainingHoles).toBe(18);
  });

  it('only counts completed holes toward the live score', () => {
    const scorecard = createDefaultScorecard(9).map((hole, index) =>
      index < 3 ? { ...hole, score: hole.par + 1, completed: true } : hole
    );

    const progress = getScorecardProgress(scorecard);

    expect(progress.completedHoles).toBe(3);
    expect(progress.totalHoles).toBe(9);
    expect(progress.progressPercentage).toBe(Math.round((3 / 9) * 100));
    expect(progress.liveScoreToPar).toBe(3);
    expect(progress.remainingHoles).toBe(6);
  });

  it('reports full progress once every hole is completed', () => {
    const scorecard = createDefaultScorecard(9).map((hole) => ({ ...hole, completed: true }));

    const progress = getScorecardProgress(scorecard);

    expect(progress.completedHoles).toBe(9);
    expect(progress.progressPercentage).toBe(100);
    expect(progress.remainingHoles).toBe(0);
  });
});

function makeRoundsFromScores(scores: number[], overrides: Partial<Round> = {}): Round[] {
  return scores.map((score, index) =>
    makeRound({
      id: `round-${index}`,
      total_score: score,
      played_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
      ...overrides,
    })
  );
}

function makeNineHoleRound(overrides: Partial<Round> = {}): Round {
  return makeRound({ holes: 9, total_score: 45, par: 36, ...overrides });
}

describe('getEstimatedHandicapIndex', () => {
  it('returns null when there are no rounds', () => {
    expect(getEstimatedHandicapIndex([])).toBeNull();
  });

  it('returns null with fewer than 3 rounds', () => {
    expect(getEstimatedHandicapIndex(makeRoundsFromScores([85]))).toBeNull();
    expect(getEstimatedHandicapIndex(makeRoundsFromScores([85, 80]))).toBeNull();
  });

  it('uses the lowest differential minus 2.0 with exactly 3 rounds, without the legacy 0.96 factor', () => {
    const rounds = makeRoundsFromScores([85, 90, 95]); // differentials 13, 18, 23

    expect(getEstimatedHandicapIndex(rounds)).toBe(11);
  });

  it('uses the lowest differential minus 1.0 with 4 rounds', () => {
    expect(getEstimatedHandicapIndex(makeRoundsFromScores([85, 90, 95, 100]))).toBe(12);
  });

  it('uses the lowest differential with no adjustment with exactly 5 rounds', () => {
    const rounds = makeRoundsFromScores([85, 90, 95, 100, 105]);

    expect(getEstimatedHandicapIndex(rounds)).toBe(13);
  });

  it('averages the lowest 2 differentials minus 1.0 with 6 rounds', () => {
    const rounds = makeRoundsFromScores([85, 90, 95, 100, 105, 110]); // lowest 2 = 13, 18

    expect(getEstimatedHandicapIndex(rounds)).toBe(14.5);
  });

  it('follows the WHS table for every round count between 3 and 20', () => {
    const expected: Record<number, number> = {
      3: -1, // lowest 1 (1) - 2.0
      4: 0, // lowest 1 (1) - 1.0
      5: 1, // lowest 1 (1)
      6: 0.5, // lowest 2 (1.5) - 1.0
      7: 1.5,
      8: 1.5, // lowest 2 (1.5)
      9: 2,
      10: 2,
      11: 2, // lowest 3 (2)
      12: 2.5,
      13: 2.5,
      14: 2.5, // lowest 4 (2.5)
      15: 3,
      16: 3, // lowest 5 (3)
      17: 3.5,
      18: 3.5, // lowest 6 (3.5)
      19: 4, // lowest 7 (4)
      20: 4.5, // lowest 8 (4.5)
    }; // round scores 73..72+n give differentials 1..n

    Object.entries(expected).forEach(([count, index]) => {
      const scores = Array.from({ length: Number(count) }, (_, i) => 72 + i + 1);

      expect(getEstimatedHandicapIndex(makeRoundsFromScores(scores))).toBe(index);
    });
  });

  it('averages the best 8 differentials out of 20 rounds with no adjustment', () => {
    const rounds = makeRoundsFromScores(Array.from({ length: 20 }, (_, index) => 72 + index + 1)); // differentials 1..20

    expect(getEstimatedHandicapIndex(rounds)).toBe(4.5);
  });

  it('only considers the 20 most recent rounds out of 25', () => {
    const recentRounds = makeRoundsFromScores(Array.from({ length: 20 }, () => 82)); // differential 10 each
    const olderBetterRounds = makeRoundsFromScores(Array.from({ length: 5 }, () => 72)).map((round, index) => ({
      ...round,
      id: `old-${index}`,
      played_at: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
    })); // differential 0 each, must be ignored

    expect(getEstimatedHandicapIndex([...olderBetterRounds, ...recentRounds])).toBe(10);
  });

  it('uses course rating and slope when available', () => {
    const rounds = makeRoundsFromScores([90, 100, 110], { course_rating: 71.2, slope_rating: 130 });

    // differential = (90 - 71.2) * 113 / 130 = 16.3415; 16.3415 - 2 = 14.3415 -> 14.3
    expect(getEstimatedHandicapIndex(rounds)).toBe(14.3);
  });

  it('falls back to par and neutral slope when rating data is missing', () => {
    const withoutRating = makeRoundsFromScores([85, 90, 95], { course_rating: null, slope_rating: null });
    const withNeutralRating = makeRoundsFromScores([85, 90, 95], { course_rating: 72, slope_rating: 113 });

    expect(getEstimatedHandicapIndex(withoutRating)).toBe(getEstimatedHandicapIndex(withNeutralRating));
  });

  it('treats a non-positive slope as missing instead of dividing by zero', () => {
    const rounds = makeRoundsFromScores([85, 90, 95], { course_rating: 71.2, slope_rating: 0 });

    expect(getEstimatedHandicapIndex(rounds)).toBe(getEstimatedHandicapIndex(makeRoundsFromScores([85, 90, 95], { course_rating: 71.2 })));
    expect(Number.isFinite(getEstimatedHandicapIndex(rounds) as number)).toBe(true);
  });

  it('scores a par-3 course against its own par rather than an 18-hole par 72', () => {
    const parThreeRounds = makeRoundsFromScores([54, 60, 66], { par: 54 }); // differentials 0, 6, 12

    expect(getEstimatedHandicapIndex(parThreeRounds.slice(0, 1))).toBeNull();
    expect(getEstimatedHandicapIndex(parThreeRounds)).toBe(-2);
  });

  it('caps the index at 54.0', () => {
    const rounds = makeRoundsFromScores([200, 200, 200], { course_rating: 72, slope_rating: 155 });

    expect(getEstimatedHandicapIndex(rounds)).toBe(54);
  });

  it('rounds to the nearest tenth (WHS Rule 5.2)', () => {
    const rounds = makeRoundsFromScores([90, 100, 110], { course_rating: 71.2, slope_rating: 125 });

    // (90 - 71.2) * 113 / 125 = 16.9952; 16.9952 - 2 = 14.9952 -> 15.0
    expect(getEstimatedHandicapIndex(rounds)).toBe(15);
  });

  it('rounds a negative (plus) index to the nearest tenth', () => {
    const rounds = makeRoundsFromScores([70, 80, 90], { course_rating: 71.2, slope_rating: 125 });

    // (70 - 71.2) * 113 / 125 = -1.0848; -1.0848 - 2 = -3.0848 -> -3.1
    expect(getEstimatedHandicapIndex(rounds)).toBe(-3.1);
  });

  describe('9-hole rounds', () => {
    it('never produces an index from 9-hole rounds alone', () => {
      const rounds = Array.from({ length: 5 }, (_, index) =>
        makeNineHoleRound({ id: `nine-${index}`, course_rating: 71.2, slope_rating: 125 })
      );

      expect(getEstimatedHandicapIndex(rounds)).toBeNull();
      expect(getEstimatedHandicapIndex(rounds.slice(0, 1))).toBeNull();
      expect(getEstimatedHandicapIndex([makeNineHoleRound({ course_rating: null, slope_rating: null })])).toBeNull();
    });

    it('excludes 9-hole rounds from an otherwise valid index', () => {
      const eighteenHoleRounds = makeRoundsFromScores([90, 90, 90], { course_rating: 71.2, slope_rating: 125 });
      const nineHoleRound = makeNineHoleRound({
        id: 'nine',
        course_rating: 71.2,
        slope_rating: 125,
        played_at: '2026-06-01T00:00:00.000Z',
      });

      expect(getEstimatedHandicapIndex([...eighteenHoleRounds, nineHoleRound])).toBe(
        getEstimatedHandicapIndex(eighteenHoleRounds)
      );
      expect(getEstimatedHandicapIndex([...eighteenHoleRounds, nineHoleRound])).toBe(15);
    });

    it('does not let 9-hole rounds fill the 3-round minimum', () => {
      const rounds = [
        ...makeRoundsFromScores([90, 90]),
        makeNineHoleRound({ id: 'nine-1' }),
        makeNineHoleRound({ id: 'nine-2' }),
      ];

      expect(getEstimatedHandicapIndex(rounds)).toBeNull();
    });
  });
});

describe('getHandicapIndexEstimate', () => {
  it('flags the index as estimated when a round lacks rating or slope', () => {
    const rated = makeRoundsFromScores([85, 90, 95], { course_rating: 71.2, slope_rating: 125 });
    const unrated = makeRoundsFromScores([85, 90, 95]);
    const partlyRated = [...rated.slice(0, 2), { ...rated[2], slope_rating: null }];

    expect(getHandicapIndexEstimate(rated).estimated).toBe(false);
    expect(getHandicapIndexEstimate(unrated).estimated).toBe(true);
    expect(getHandicapIndexEstimate(partlyRated).estimated).toBe(true);
  });

  it('counts the 9-hole rounds it left out', () => {
    const rounds = [...makeRoundsFromScores([85, 90, 95]), makeNineHoleRound(), makeNineHoleRound({ id: 'nine-2' })];

    expect(getHandicapIndexEstimate(rounds).excludedNineHoleRounds).toBe(2);
  });
});

describe('getHandicapIndexCard', () => {
  it('shows -- with the 3-round helper when there is no index yet', () => {
    const card = getHandicapIndexCard(makeRoundsFromScores([85, 90]));

    expect(card.value).toBe('--');
    expect(card.helper).toBe('au moins 3 parties de 18 trous');
  });

  it('mentions the excluded 9-hole rounds', () => {
    const noIndex = getHandicapIndexCard([makeNineHoleRound()]);
    const withIndex = getHandicapIndexCard([...makeRoundsFromScores([85, 90, 95]), makeNineHoleRound()]);

    expect(noIndex.value).toBe('--');
    expect(noIndex.helper).toContain('9 trous exclus');
    expect(withIndex.value).toBe('11');
    expect(withIndex.helper).toContain('9 trous exclus');
  });

  it('only labels the index as estimated when the rating is missing', () => {
    const rated = getHandicapIndexCard(makeRoundsFromScores([85, 90, 95], { course_rating: 71.2, slope_rating: 125 }));
    const unrated = getHandicapIndexCard(makeRoundsFromScores([85, 90, 95]));

    expect(rated.label).toBe('Handicap Index');
    expect(unrated.label).toBe('Handicap Index estimé');
  });
});

describe('per-18-hole averages', () => {
  const eighteenHoleRound = makeRound({ id: 'eighteen', total_score: 90, par: 72, putts: 36, penalties: 2 });
  const nineHoleRound = makeNineHoleRound({ id: 'nine', total_score: 40, putts: 16, penalties: 1 });

  it('returns null without rounds', () => {
    expect(getAverageScorePer18Holes([])).toBeNull();
    expect(getAverageScoreToParPer18Holes([])).toBeNull();
    expect(getAveragePuttsPer18Holes([])).toBeNull();
    expect(getAveragePenaltyCount([])).toBeNull();
  });

  it('scales 9-hole scores to 18 holes before averaging', () => {
    expect(getAverageScorePer18Holes([eighteenHoleRound, nineHoleRound])).toBe(85); // (90 + 80) / 2
    expect(getAverageScoreToParPer18Holes([eighteenHoleRound, nineHoleRound])).toBe(13); // (18 + 8) / 2
  });

  it('scales putts and penalties per 18 holes and skips rounds without putts', () => {
    const noPutts = makeRound({ id: 'no-putts', putts: null, penalties: null });

    expect(getAveragePuttsPer18Holes([eighteenHoleRound, nineHoleRound, noPutts])).toBe(34); // (36 + 32) / 2
    expect(getAveragePenaltyCount([eighteenHoleRound, nineHoleRound, noPutts])).toBe(1.3); // (2 + 2 + 0) / 3
  });

  it('leaves a pure 18-hole history unchanged', () => {
    expect(getAverageScorePer18Holes([eighteenHoleRound, makeRound({ id: 'other', total_score: 80 })])).toBe(85);
  });
});

describe('getBestRound', () => {
  it('returns null without rounds', () => {
    expect(getBestRound([])).toBeNull();
  });

  it('never ranks a 9-hole round above an 18-hole one', () => {
    const eighteenHoleRound = makeRound({ id: 'eighteen', total_score: 100, par: 72 });
    const bestNineHoleRound = makeNineHoleRound({ id: 'nine', total_score: 37, par: 36 });

    expect(getBestRound([bestNineHoleRound, eighteenHoleRound])?.id).toBe('eighteen');
  });

  it('picks the lowest score to par among 18-hole rounds', () => {
    const rounds = [
      makeRound({ id: 'a', total_score: 90, par: 72 }),
      makeRound({ id: 'b', total_score: 85, par: 72 }),
      makeNineHoleRound({ id: 'c', total_score: 36 }),
    ];

    expect(getBestRound(rounds)?.id).toBe('b');
  });

  it('falls back to 9-hole rounds when there is no 18-hole round', () => {
    const rounds = [makeNineHoleRound({ id: 'a', total_score: 45 }), makeNineHoleRound({ id: 'b', total_score: 41 })];

    expect(getBestRound(rounds)?.id).toBe('b');
  });
});

describe('getScoreToParTrend', () => {
  function makeDatedRounds(scoresToPar: number[], overrides: Partial<Round> = {}) {
    const par = overrides.holes === 9 ? 36 : 72;

    return scoresToPar.map((scoreToPar, index) =>
      makeRound({
        id: `${overrides.holes ?? 18}-${index}`,
        par,
        total_score: par + scoreToPar,
        played_at: new Date(Date.UTC(2026, 5, 30 - index)).toISOString(),
        ...overrides,
      })
    );
  }

  it('returns null with fewer than 4 rounds of the same length', () => {
    const rounds = [...makeDatedRounds([10, 10, 10]), ...makeDatedRounds([4, 4, 4], { holes: 9 })];

    expect(getScoreToParTrend(rounds)).toBeNull();
  });

  it('compares the 3 latest rounds with the 3 before them', () => {
    const rounds = makeDatedRounds([10, 10, 10, 14, 14, 14, 30]);

    expect(getScoreToParTrend(rounds)).toEqual({ holes: 18, delta: 4 });
  });

  it('ignores 9-hole rounds when there are enough 18-hole rounds', () => {
    const nineHoleRounds = makeDatedRounds([0, 0], { holes: 9 }).map((round, index) => ({
      ...round,
      played_at: new Date(Date.UTC(2026, 6, 1 + index)).toISOString(),
    }));
    const rounds = [...makeDatedRounds([10, 10, 10, 14]), ...nineHoleRounds];

    expect(getScoreToParTrend(rounds)).toEqual({ holes: 18, delta: 4 });
  });

  it('falls back to 9-hole rounds when there are too few 18-hole rounds', () => {
    const rounds = [...makeDatedRounds([10, 10]), ...makeDatedRounds([3, 3, 3, 5], { holes: 9 })];

    expect(getScoreToParTrend(rounds)).toEqual({ holes: 9, delta: 2 });
  });
});

describe('hasRecordedHoleDetails (heuristic: putts other than 2, a green hit or a fairway hit on at least one hole)', () => {
  it('is false for a card that still holds the new-hole defaults', () => {
    expect(hasRecordedHoleDetails(createDefaultScorecard(18))).toBe(false);
  });

  it('is false for a card where only the scores were tapped', () => {
    const scorecard = createDefaultScorecard(18).map((hole) => ({ ...hole, score: hole.par + 1, completed: true }));

    expect(hasRecordedHoleDetails(scorecard)).toBe(false);
  });

  it('is false for a full card played with 2 putts everywhere and no green or fairway hit, which cannot be told from the defaults', () => {
    const scorecard = Array.from({ length: 18 }, (_, index) => makeHole({ hole_number: index + 1, putts: 2, gir: false, fairway_hit: false }));

    expect(hasRecordedHoleDetails(scorecard)).toBe(false);
  });

  it('is true as soon as one hole has other than 2 putts', () => {
    const base = createDefaultScorecard(18);

    expect(hasRecordedHoleDetails([{ ...base[0], putts: 3 }, ...base.slice(1)])).toBe(true);
    expect(hasRecordedHoleDetails([{ ...base[0], putts: 1 }, ...base.slice(1)])).toBe(true);
    expect(hasRecordedHoleDetails([{ ...base[0], putts: 0 }, ...base.slice(1)])).toBe(true);
  });

  it('is true as soon as one green is hit', () => {
    const base = createDefaultScorecard(18);

    expect(hasRecordedHoleDetails([...base.slice(0, 5), { ...base[5], gir: true }, ...base.slice(6)])).toBe(true);
  });

  it('is true as soon as one fairway is hit', () => {
    const base = createDefaultScorecard(18);

    expect(hasRecordedHoleDetails([{ ...base[0], fairway_hit: true }, ...base.slice(1)])).toBe(true);
  });

  it('does not take missing values for entries', () => {
    expect(hasRecordedHoleDetails([{ putts: null, gir: null, fairway_hit: null }, {}])).toBe(false);
  });

  it('is false without any hole', () => {
    expect(hasRecordedHoleDetails([])).toBe(false);
    expect(hasRecordedHoleDetails(null)).toBe(false);
    expect(hasRecordedHoleDetails(undefined)).toBe(false);
  });
});
