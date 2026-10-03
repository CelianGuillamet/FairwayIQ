import type {
  Round,
  RoundAggregate,
  RoundDraftHole,
  RoundHole,
  RoundHoleInsert,
  RoundInsert,
} from '../types';

const DEFAULT_PAR_SEQUENCE_18 = [4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5] as const;

export type ScorecardProgress = {
  completedHoles: number;
  totalHoles: number;
  progressPercentage: number;
  liveScore: number;
  livePar: number;
  liveScoreToPar: number;
  remainingHoles: number;
};

function getDefaultParSequence(holes: 9 | 18) {
  return holes === 9 ? DEFAULT_PAR_SEQUENCE_18.slice(0, 9) : [...DEFAULT_PAR_SEQUENCE_18];
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getDefaultHoleDraft(holeNumber: number, par: number): RoundDraftHole {
  return {
    hole_number: holeNumber,
    par,
    score: par,
    putts: 2,
    gir: false,
    fairway_hit: par === 3 ? null : false,
    penalty: 0,
    completed: false,
  };
}

export function createDefaultScorecard(holes: 9 | 18): RoundDraftHole[] {
  return getDefaultParSequence(holes).map((par, index) => getDefaultHoleDraft(index + 1, par));
}

export function resizeScorecard(scorecard: RoundDraftHole[], holes: 9 | 18) {
  const base = scorecard.slice(0, holes).map((hole, index) => ({
    ...hole,
    hole_number: index + 1,
  }));

  if (base.length === holes) {
    return base;
  }

  const nextDefaults = createDefaultScorecard(holes).slice(base.length);
  return [...base, ...nextDefaults];
}

export function applyParSequenceToScorecard(scorecard: RoundDraftHole[], pars: number[]) {
  return scorecard.map((hole, index) => {
    const nextPar = pars[index] ?? hole.par;

    return {
      ...hole,
      par: nextPar,
      score: hole.completed ? hole.score : nextPar,
      fairway_hit: nextPar === 3 ? null : (hole.fairway_hit ?? false),
      gir: hole.completed ? hole.gir : false,
    };
  });
}

export function applyTargetParToScorecard(scorecard: RoundDraftHole[], targetPar: number) {
  const nextScorecard = scorecard.map((hole) => ({ ...hole }));
  const currentPar = nextScorecard.reduce((sum, hole) => sum + hole.par, 0);
  let delta = targetPar - currentPar;

  if (delta === 0) {
    return nextScorecard;
  }

  const direction = delta > 0 ? 1 : -1;
  const orderedIndexes =
    direction > 0
      ? nextScorecard.map((_, index) => index).sort((left, right) => nextScorecard[left].par - nextScorecard[right].par)
      : nextScorecard.map((_, index) => index).sort((left, right) => nextScorecard[right].par - nextScorecard[left].par);

  while (delta !== 0) {
    let updated = false;

    for (const index of orderedIndexes) {
      const hole = nextScorecard[index];
      const nextPar = hole.par + direction;

      if (nextPar < 3 || nextPar > 6) {
        continue;
      }

      hole.par = nextPar;
      hole.score = hole.completed ? hole.score : nextPar;
      hole.fairway_hit = nextPar === 3 ? null : (hole.fairway_hit ?? false);
      hole.gir = hole.completed ? hole.gir : false;
      delta -= direction;
      updated = true;

      if (delta === 0) {
        break;
      }
    }

    if (!updated) {
      break;
    }
  }

  return nextScorecard;
}

export function createSyntheticScorecardFromRound(round: Round): RoundDraftHole[] {
  const scorecard = applyTargetParToScorecard(createDefaultScorecard(round.holes), round.par);
  const orderedIndexes = scorecard
    .map((hole, index) => ({ index, par: hole.par }))
    .sort((left, right) => right.par - left.par)
    .map((entry) => entry.index);

  let scoreDelta = round.total_score - round.par;
  let cursor = 0;

  while (scoreDelta !== 0 && orderedIndexes.length > 0) {
    const index = orderedIndexes[cursor % orderedIndexes.length];
    const hole = scorecard[index];

    if (scoreDelta > 0 && hole.score < 15) {
      hole.score += 1;
      scoreDelta -= 1;
    } else if (scoreDelta < 0 && hole.score > 1) {
      hole.score -= 1;
      scoreDelta += 1;
    }

    cursor += 1;

    if (cursor > 200) {
      break;
    }
  }

  if (round.putts != null) {
    const basePutts = Math.floor(round.putts / round.holes);
    let remainder = round.putts % round.holes;

    for (const hole of scorecard) {
      const extraPutt = remainder > 0 ? 1 : 0;
      hole.putts = Math.max(0, Math.min(6, basePutts + extraPutt));
      remainder -= extraPutt;
    }
  }

  if ((round.penalties ?? 0) > 0) {
    let penaltiesLeft = round.penalties ?? 0;

    for (const index of orderedIndexes) {
      if (penaltiesLeft === 0) {
        break;
      }

      const hole = scorecard[index];
      const nextPenalty = Math.min(2, penaltiesLeft);
      hole.penalty = nextPenalty;
      penaltiesLeft -= nextPenalty;
    }
  }

  if (round.gir != null && round.gir > 0) {
    let girLeft = round.gir;

    for (const index of orderedIndexes) {
      if (girLeft === 0) {
        break;
      }

      scorecard[index].gir = true;
      girLeft -= 1;
    }
  }

  if (round.fairways_total != null && round.fairways_total > 0) {
    const fairwayHoles = scorecard.filter((hole) => hole.par > 3);
    let fairwaysLeft = Math.min(round.fairways_hit ?? 0, fairwayHoles.length);

    for (const hole of fairwayHoles) {
      hole.fairway_hit = fairwaysLeft > 0;
      if (fairwaysLeft > 0) {
        fairwaysLeft -= 1;
      }
    }
  }

  return scorecard.map((hole) => ({ ...hole, completed: true }));
}

export function mapStoredHolesToDraft(holes: RoundHole[], roundHoles: 9 | 18): RoundDraftHole[] {
  const sortedHoles = [...holes].sort((left, right) => left.hole_number - right.hole_number);

  if (sortedHoles.length === 0) {
    return createDefaultScorecard(roundHoles);
  }

  return sortedHoles.map((hole, index) => ({
    hole_number: hole.hole_number,
    par: hole.par,
    score: hole.score,
    putts: hole.putts ?? 2,
    gir: hole.gir ?? false,
    fairway_hit: hole.par === 3 ? null : hole.fairway_hit ?? false,
    penalty: hole.penalty ?? 0,
    completed: true,
  })).slice(0, roundHoles).concat(
    createDefaultScorecard(roundHoles).slice(sortedHoles.length).map((hole, index) => ({
      ...hole,
      hole_number: sortedHoles.length + index + 1,
    }))
  );
}

export function updateDraftHole(
  scorecard: RoundDraftHole[],
  holeNumber: number,
  patch: Partial<RoundDraftHole>
) {
  return scorecard.map((hole) => {
    if (hole.hole_number !== holeNumber) {
      return hole;
    }

    const nextPar = patch.par ?? hole.par;
    const nextFairwayHit = nextPar === 3 ? null : (patch.fairway_hit ?? hole.fairway_hit ?? false);

    return {
      ...hole,
      ...patch,
      par: nextPar,
      fairway_hit: nextFairwayHit,
      gir: patch.gir ?? hole.gir,
      completed: patch.completed ?? hole.completed,
    };
  });
}

export function resetDraftHole(scorecard: RoundDraftHole[], holeNumber: number) {
  return scorecard.map((hole) => (
    hole.hole_number === holeNumber
      ? getDefaultHoleDraft(hole.hole_number, hole.par)
      : hole
  ));
}

export function getScorecardProgress(scorecard: RoundDraftHole[]): ScorecardProgress {
  const completedHoles = scorecard.filter((hole) => hole.completed);
  const liveScore = completedHoles.reduce((sum, hole) => sum + hole.score, 0);
  const livePar = completedHoles.reduce((sum, hole) => sum + hole.par, 0);

  return {
    completedHoles: completedHoles.length,
    totalHoles: scorecard.length,
    progressPercentage: scorecard.length === 0 ? 0 : Math.round((completedHoles.length / scorecard.length) * 100),
    liveScore,
    livePar,
    liveScoreToPar: liveScore - livePar,
    remainingHoles: Math.max(0, scorecard.length - completedHoles.length),
  };
}

export function aggregateScorecard(scorecard: RoundDraftHole[]): RoundAggregate {
  const holes = scorecard.length === 9 ? 9 : 18;
  const frontNine = scorecard.slice(0, 9);
  const backNine = holes === 18 ? scorecard.slice(9, 18) : [];

  const par = scorecard.reduce((sum, hole) => sum + hole.par, 0);
  const totalScore = scorecard.reduce((sum, hole) => sum + hole.score, 0);
  const putts = scorecard.reduce((sum, hole) => sum + hole.putts, 0);
  const gir = scorecard.reduce((sum, hole) => sum + (hole.gir ? 1 : 0), 0);
  const fairways = scorecard.filter((hole) => hole.par > 3);
  const fairwaysHit = fairways.reduce((sum, hole) => sum + (hole.fairway_hit ? 1 : 0), 0);
  const penalties = scorecard.reduce((sum, hole) => sum + hole.penalty, 0);
  const frontNineScore = frontNine.reduce((sum, hole) => sum + hole.score, 0);
  const frontNinePar = frontNine.reduce((sum, hole) => sum + hole.par, 0);
  const backNineScore = backNine.reduce((sum, hole) => sum + hole.score, 0);
  const backNinePar = backNine.reduce((sum, hole) => sum + hole.par, 0);

  return {
    holes,
    par,
    total_score: totalScore,
    putts,
    gir,
    fairways_hit: fairwaysHit,
    fairways_total: fairways.length,
    penalties,
    front_nine_score: frontNineScore,
    back_nine_score: holes === 18 ? backNineScore : null,
    front_nine_to_par: frontNineScore - frontNinePar,
    back_nine_to_par: holes === 18 ? backNineScore - backNinePar : null,
    average_putts_per_hole: roundToSingleDecimal(putts / holes),
    gir_percentage: Math.round((gir / holes) * 100),
    fairway_percentage: fairways.length > 0 ? Math.round((fairwaysHit / fairways.length) * 100) : null,
    score_to_par: totalScore - par,
  };
}

export function validateScorecard(scorecard: RoundDraftHole[]): string | null {
  if (scorecard.length !== 9 && scorecard.length !== 18) {
    return 'La carte de score doit contenir 9 ou 18 trous.';
  }

  for (const hole of scorecard) {
    if (!hole.completed) {
      return `Le trou ${hole.hole_number} n'a pas encore été saisi.`;
    }

    if (hole.par < 3 || hole.par > 6) {
      return `Le par du trou ${hole.hole_number} doit être compris entre 3 et 6.`;
    }

    if (hole.score < 1 || hole.score > 15) {
      return `Le score du trou ${hole.hole_number} doit être compris entre 1 et 15.`;
    }

    if (hole.putts < 0 || hole.putts > 6) {
      return `Les putts du trou ${hole.hole_number} doivent être compris entre 0 et 6.`;
    }

    if (hole.putts > hole.score) {
      return `Les putts du trou ${hole.hole_number} ne peuvent pas dépasser le score total.`;
    }

    if (hole.penalty < 0 || hole.penalty > 5) {
      return `Les pénalités du trou ${hole.hole_number} doivent être comprises entre 0 et 5.`;
    }
  }

  return null;
}

export function buildRoundInsertFromScorecard(input: {
  userId: string;
  playedAt: string;
  courseId: string | null;
  courseName: string | null;
  courseProvider?: string | null;
  providerCourseId?: string | null;
  teeKey: string | null;
  teeSetId?: string | null;
  teeName?: string | null;
  teeColor?: string | null;
  notes: string | null;
  scorecard: RoundDraftHole[];
}): RoundInsert {
  const aggregate = aggregateScorecard(input.scorecard);

  return {
    user_id: input.userId,
    played_at: input.playedAt,
    course_id: input.courseId,
    course_name: input.courseName,
    course_provider: input.courseProvider ?? null,
    provider_course_id: input.providerCourseId ?? null,
    tee_key: input.teeKey,
    tee_set_id: input.teeSetId ?? null,
    tee_name: input.teeName ?? null,
    tee_color: input.teeColor ?? null,
    holes: aggregate.holes,
    total_score: aggregate.total_score,
    par: aggregate.par,
    putts: aggregate.putts,
    gir: aggregate.gir,
    fairways_hit: aggregate.fairways_hit,
    fairways_total: aggregate.fairways_total,
    penalties: aggregate.penalties,
    notes: input.notes,
  };
}

export function buildRoundHoleInserts(
  roundId: string,
  userId: string,
  scorecard: RoundDraftHole[]
): RoundHoleInsert[] {
  return scorecard.map((hole) => ({
    round_id: roundId,
    user_id: userId,
    hole_number: hole.hole_number,
    par: hole.par,
    score: hole.score,
    putts: hole.putts,
    gir: hole.gir,
    fairway_hit: hole.par === 3 ? null : hole.fairway_hit,
    penalty: hole.penalty,
  }));
}

export function sortRoundHoles(holes: RoundHole[]) {
  return [...holes].sort((left, right) => left.hole_number - right.hole_number);
}

export function getRoundPerformanceSummary(round: Round) {
  const scoreToPar = round.total_score - round.par;
  const girPercentage = round.gir != null ? Math.round((round.gir / round.holes) * 100) : null;
  const fairwayPercentage =
    round.fairways_hit != null && round.fairways_total
      ? Math.round((round.fairways_hit / round.fairways_total) * 100)
      : null;
  const puttsPerHole = round.putts != null ? roundToSingleDecimal(round.putts / round.holes) : null;

  return {
    scoreToPar,
    girPercentage,
    fairwayPercentage,
    puttsPerHole,
  };
}

const WHS_MAX_DIFFERENTIAL_ROUNDS = 20;
const WHS_MIN_DIFFERENTIAL_ROUNDS = 3;
const WHS_NEUTRAL_SLOPE_RATING = 113;
const WHS_MAX_HANDICAP_INDEX = 54;
const FULL_ROUND_HOLES = 18;

// WHS Rule 5.2a: how many of the lowest differentials to average, and the small
// adjustment applied when fewer than 20 scores are available. No index exists
// below 3 scores, hence no entries for 1 and 2.
const WHS_DIFFERENTIAL_TABLE: Record<number, { count: number; adjustment: number }> = {
  3: { count: 1, adjustment: -2.0 },
  4: { count: 1, adjustment: -1.0 },
  5: { count: 1, adjustment: 0 },
  6: { count: 2, adjustment: -1.0 },
  7: { count: 2, adjustment: 0 },
  8: { count: 2, adjustment: 0 },
  9: { count: 3, adjustment: 0 },
  10: { count: 3, adjustment: 0 },
  11: { count: 3, adjustment: 0 },
  12: { count: 4, adjustment: 0 },
  13: { count: 4, adjustment: 0 },
  14: { count: 4, adjustment: 0 },
  15: { count: 5, adjustment: 0 },
  16: { count: 5, adjustment: 0 },
  17: { count: 6, adjustment: 0 },
  18: { count: 6, adjustment: 0 },
  19: { count: 7, adjustment: 0 },
  20: { count: 8, adjustment: 0 },
};

export type HandicapIndexEstimate = {
  index: number | null;
  estimated: boolean;
  excludedNineHoleRounds: number;
};

function hasCourseRatingAndSlope(round: Round) {
  return round.course_rating != null && round.slope_rating != null && round.slope_rating > 0;
}

function getRoundScoreDifferential(round: Round) {
  // Rounds recorded before course_tee_sets existed (or without a matched tee set) have no
  // rating/slope: fall back to a neutral slope (113, the WHS average) and a course rating
  // equal to par, which reduces the differential to the round's plain score-to-par.
  // total_score stands in for the adjusted gross score: net double bogey capping needs the
  // per-hole scores, which a Round does not carry.
  const slopeRating =
    round.slope_rating != null && round.slope_rating > 0 ? round.slope_rating : WHS_NEUTRAL_SLOPE_RATING;
  const courseRating = round.course_rating ?? round.par;

  return ((round.total_score - courseRating) * 113) / slopeRating;
}

function sortByMostRecent(rounds: Round[]) {
  return [...rounds].sort((left, right) => new Date(right.played_at).getTime() - new Date(left.played_at).getTime());
}

// Only 18-hole rounds feed the index: the stored course rating and slope are 18-hole values,
// and the app has neither a 9-hole rating nor the existing index needed to convert a 9-hole score.
export function getHandicapIndexEstimate(rounds: Round[]): HandicapIndexEstimate {
  const fullRounds = rounds.filter((round) => round.holes === FULL_ROUND_HOLES);
  const excludedNineHoleRounds = rounds.length - fullRounds.length;
  const mostRecentRounds = sortByMostRecent(fullRounds).slice(0, WHS_MAX_DIFFERENTIAL_ROUNDS);

  if (mostRecentRounds.length < WHS_MIN_DIFFERENTIAL_ROUNDS) {
    return { index: null, estimated: false, excludedNineHoleRounds };
  }

  const { count, adjustment } = WHS_DIFFERENTIAL_TABLE[mostRecentRounds.length];
  const bestDifferentials = mostRecentRounds
    .map(getRoundScoreDifferential)
    .sort((left, right) => left - right)
    .slice(0, count);

  const averageDifferential = bestDifferentials.reduce((sum, value) => sum + value, 0) / bestDifferentials.length;

  return {
    index: Math.min(roundToSingleDecimal(averageDifferential + adjustment), WHS_MAX_HANDICAP_INDEX),
    estimated: mostRecentRounds.some((round) => !hasCourseRatingAndSlope(round)),
    excludedNineHoleRounds,
  };
}

export function getEstimatedHandicapIndex(rounds: Round[]) {
  return getHandicapIndexEstimate(rounds).index;
}

export function getHandicapIndexCard(rounds: Round[]) {
  const { index, estimated, excludedNineHoleRounds } = getHandicapIndexEstimate(rounds);
  const exclusionNote = excludedNineHoleRounds > 0 ? ' · 9 trous exclus' : '';

  if (index == null) {
    return {
      label: 'Handicap Index',
      value: '--',
      helper: `au moins ${WHS_MIN_DIFFERENTIAL_ROUNDS} parties de ${FULL_ROUND_HOLES} trous${exclusionNote}`,
    };
  }

  return {
    label: estimated ? 'Handicap Index estimé' : 'Handicap Index',
    value: index.toString(),
    helper: `méthode WHS, non officiel${exclusionNote}`,
  };
}

export function normalizeTo18Holes(value: number, holes: number) {
  return (value * FULL_ROUND_HOLES) / holes;
}

function averagePer18Holes(rounds: Round[], getValue: (round: Round) => number | null) {
  const values = rounds.flatMap((round) => {
    const value = getValue(round);
    return value == null ? [] : [normalizeTo18Holes(value, round.holes)];
  });

  if (values.length === 0) return null;

  return roundToSingleDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function getAverageScorePer18Holes(rounds: Round[]) {
  return averagePer18Holes(rounds, (round) => round.total_score);
}

export function getAverageScoreToParPer18Holes(rounds: Round[]) {
  return averagePer18Holes(rounds, (round) => round.total_score - round.par);
}

export function getAveragePuttsPer18Holes(rounds: Round[]) {
  return averagePer18Holes(rounds, (round) => round.putts);
}

export function getAveragePenaltyCount(rounds: Round[]) {
  return averagePer18Holes(rounds, (round) => round.penalties ?? 0);
}

const TREND_WINDOW = 3;

function averageScoreToPar(rounds: Round[]) {
  const total = rounds.reduce((sum, round) => sum + round.total_score - round.par, 0);
  return roundToSingleDecimal(total / rounds.length);
}

// Compares the latest 3 rounds with the 3 before them, only among rounds with the same number
// of holes (18-hole rounds first; 9-hole rounds only when there are too few 18-hole ones).
// The delta is in strokes over that number of holes.
export function getScoreToParTrend(rounds: Round[]) {
  const sortedRounds = sortByMostRecent(rounds);

  for (const holes of [18, 9] as const) {
    const sameHolesRounds = sortedRounds.filter((round) => round.holes === holes);

    if (sameHolesRounds.length <= TREND_WINDOW) continue;

    const recentAverage = averageScoreToPar(sameHolesRounds.slice(0, TREND_WINDOW));
    const previousAverage = averageScoreToPar(sameHolesRounds.slice(TREND_WINDOW, TREND_WINDOW * 2));

    return { holes, delta: roundToSingleDecimal(previousAverage - recentAverage) };
  }

  return null;
}

// A 9-hole score is never ranked against an 18-hole one: 9-hole rounds only compete
// among themselves when there is no 18-hole round at all.
export function getBestRound(rounds: Round[]) {
  const fullRounds = rounds.filter((round) => round.holes === FULL_ROUND_HOLES);
  const comparableRounds = fullRounds.length > 0 ? fullRounds : rounds;

  if (comparableRounds.length === 0) return null;

  return [...comparableRounds].sort((left, right) => {
    const leftDiff = left.total_score - left.par;
    const rightDiff = right.total_score - right.par;

    if (leftDiff !== rightDiff) {
      return leftDiff - rightDiff;
    }

    return left.total_score - right.total_score;
  })[0];
}
