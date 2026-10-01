import {
  aggregateScorecard,
  createDefaultScorecard,
  getEstimatedHandicap,
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

describe('getEstimatedHandicap', () => {
  it('returns null when there are no rounds', () => {
    expect(getEstimatedHandicap([])).toBeNull();
  });

  it('estimates from a single round', () => {
    const rounds = [makeRound({ total_score: 85, par: 72 })];

    expect(getEstimatedHandicap(rounds)).toBeCloseTo(13 * 0.9, 5);
  });

  it('averages the score-to-par across multiple rounds', () => {
    const rounds = [
      makeRound({ total_score: 82, par: 72 }), // +10
      makeRound({ total_score: 92, par: 72 }), // +20
      makeRound({ total_score: 72, par: 72 }), // 0
    ];

    expect(getEstimatedHandicap(rounds)).toBeCloseTo(10 * 0.9, 5);
  });

  it('only considers the 8 most recent rounds', () => {
    const goodRounds = Array.from({ length: 8 }, () => makeRound({ total_score: 72, par: 72 })); // all even par
    const ignoredBadRounds = Array.from({ length: 4 }, () => makeRound({ total_score: 120, par: 72 }));

    const handicap = getEstimatedHandicap([...goodRounds, ...ignoredBadRounds]);

    expect(handicap).toBe(0);
  });

  it('clamps a negative average score-to-par to zero', () => {
    const rounds = [makeRound({ total_score: 68, par: 72 })]; // -4 to par

    expect(getEstimatedHandicap(rounds)).toBe(0);
  });
});
