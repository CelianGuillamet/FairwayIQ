import {
  aggregateScorecard,
  createDefaultScorecard,
  getEstimatedHandicapIndex,
  getScorecardProgress,
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

describe('getEstimatedHandicapIndex', () => {
  it('returns null when there are no rounds', () => {
    expect(getEstimatedHandicapIndex([])).toBeNull();
  });

  it('applies the WHS adjustment for a single round (differential 13 -> (13 - 2) * 0.96)', () => {
    const rounds = [makeRound({ total_score: 85, par: 72 })];

    expect(getEstimatedHandicapIndex(rounds)).toBe(10.5);
  });

  it('uses course rating and slope when available', () => {
    const rounds = [makeRound({ total_score: 90, par: 72, course_rating: 71.2, slope_rating: 130 })];

    // differential = (90 - 71.2) * 113 / 130 = 16.34; (16.34 - 2) * 0.96 = 13.76 -> truncated to 13.7
    expect(getEstimatedHandicapIndex(rounds)).toBe(13.7);
  });

  it('falls back to par and neutral slope when rating data is missing', () => {
    const withoutRating = [makeRound({ total_score: 85, par: 72, course_rating: null, slope_rating: null })];
    const withNeutralRating = [makeRound({ total_score: 85, par: 72, course_rating: 72, slope_rating: 113 })];

    expect(getEstimatedHandicapIndex(withoutRating)).toBe(getEstimatedHandicapIndex(withNeutralRating));
  });

  it('averages the best 8 differentials out of 20 rounds', () => {
    const rounds = Array.from({ length: 20 }, (_, index) =>
      makeRound({ id: `round-${index}`, total_score: 72 + index + 1, par: 72 })
    ); // differentials 1..20

    // best 8 = 1..8 -> average 4.5; no adjustment; 4.5 * 0.96 = 4.32 -> truncated to 4.3
    expect(getEstimatedHandicapIndex(rounds)).toBe(4.3);
  });

  it('only considers the 20 most recent rounds', () => {
    const recentRounds = Array.from({ length: 20 }, (_, index) =>
      makeRound({ id: `recent-${index}`, total_score: 82, par: 72, played_at: `2026-02-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` })
    ); // differential 10 each
    const olderBetterRounds = Array.from({ length: 5 }, (_, index) =>
      makeRound({ id: `old-${index}`, total_score: 72, par: 72, played_at: `2025-01-0${index + 1}T00:00:00.000Z` })
    ); // differential 0 each, must be ignored

    expect(getEstimatedHandicapIndex([...olderBetterRounds, ...recentRounds])).toBeCloseTo(9.6, 5);
  });

  it('can return a negative (plus) index for rounds under par', () => {
    const rounds = [makeRound({ total_score: 68, par: 72 })];

    // (-4 - 2) * 0.96 = -5.76 -> truncated toward zero to -5.7
    expect(getEstimatedHandicapIndex(rounds)).toBe(-5.7);
  });
});
