import {
  LEAKS_MIN_ROUNDS,
  analyzeLeaks,
  describeLegacyExclusion,
  describeMissingDetails,
  describeLoss,
  getLeakTrendPill,
  getMetricRows,
  hasEnoughLeakData,
  selectLeakRounds,
  type HoleRow,
  type HolesByRound,
  type LeakRound,
} from './leaks';

const PARS = [4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];

function card(overrides: Record<number, Partial<HoleRow>> = {}, holes = 18): HoleRow[] {
  return PARS.slice(0, holes).map((par, index) => ({
    hole_number: index + 1,
    par,
    score: par,
    putts: 2,
    gir: true,
    fairway_hit: par === 3 ? null : true,
    penalty: 0,
    ...overrides[index + 1],
  }));
}

function scoresOnlyCard(overrides: Record<number, Partial<HoleRow>> = {}, holes = 18): HoleRow[] {
  return card(overrides, holes).map((hole) => ({
    ...hole,
    putts: 2,
    gir: false,
    fairway_hit: hole.par === 3 ? null : false,
  }));
}

function makeRounds(count: number): LeakRound[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    played_at: new Date(Date.UTC(2026, 8, 30 - index, 10)).toISOString(),
  }));
}

function holesFor(rounds: LeakRound[], build: (index: number) => HoleRow[] | undefined): HolesByRound {
  const result: HolesByRound = {};
  rounds.forEach((round, index) => {
    result[round.id] = build(index);
  });
  return result;
}

function analyzeOne(holes: HoleRow[], windowSize?: number) {
  const rounds = makeRounds(1);
  return analyzeLeaks({ rounds, holesByRound: holesFor(rounds, () => holes), windowSize });
}

function threePuttHoles(count: number): Record<number, Partial<HoleRow>> {
  const holes = [1, 2, 4, 6, 8, 10, 11, 14, 15];
  return Object.fromEntries(holes.slice(0, count).map((hole) => [hole, { score: PARS[hole - 1] + 1, putts: 3 }]));
}

describe('putting loss = sum(max(putts - 2, 0)) per 18 holes', () => {
  const analysis = analyzeOne(card({
    1: { score: 5, putts: 3 },
    2: { score: 5, putts: 3 },
    5: { score: 6, putts: 4 },
    3: { score: 2, putts: 1 },
    6: { gir: false },
  }));

  it('counts only the putts above two, never credits one-putts', () => {
    expect(analysis.metrics.puttingLossPer18).toBe(4);
  });

  it('counts holes with three putts or more', () => {
    expect(analysis.metrics.threePuttHolesPer18).toBe(3);
  });

  it('becomes the only leak with the real numbers in its sentence', () => {
    expect(analysis.leaks).toHaveLength(1);
    expect(analysis.leaks[0]).toMatchObject({ id: 'putting', title: 'Putting', drill: 'putting', lossPer18: 4 });
    expect(analysis.leaks[0].explanation).toBe(
      'Sur 18 trous, tu joues en moyenne 3 trous en 3 putts ou plus ; tu prends 2,2 putts par trou quand tu touches le green, 2 putts sinon.',
    );
  });
});

describe('penalties = sum(penalty) per 18 holes', () => {
  const analysis = analyzeOne(card({
    3: { score: 4, penalty: 1 },
    8: { score: 7, penalty: 2 },
  }));

  it('sums penalty strokes', () => {
    expect(analysis.metrics.penaltyStrokesPer18).toBe(3);
  });

  it('ranks penalties first, mapped to driving drills', () => {
    expect(analysis.leaks[0]).toMatchObject({ id: 'penalties', title: 'Pénalités', drill: 'driving', lossPer18: 3 });
    expect(analysis.leaks[0].explanation).toBe('Sur 18 trous, tu écopes en moyenne de 3 coups de pénalité.');
  });
});

describe('blow-ups = sum(score - par - 1) over holes with score >= par + 2', () => {
  const analysis = analyzeOne(card({
    1: { score: 6 },
    3: { score: 5 },
    5: { score: 8 },
    2: { score: 5 },
  }));

  it('ignores a plain bogey and counts the strokes above bogey on doubles or worse', () => {
    expect(analysis.metrics.doubleOrWorseHolesPer18).toBe(3);
    expect(analysis.metrics.doubleOrWorseLossPer18).toBe(4);
  });

  it('maps to the mental drills', () => {
    expect(analysis.leaks[0]).toMatchObject({ id: 'blowups', title: 'Trous catastrophe', drill: 'mental', lossPer18: 4 });
    expect(analysis.leaks[0].explanation).toBe(
      'Sur 18 trous, tu joues en moyenne 3 trous en double bogey ou pire ; au-delà du bogey, cela te coûte 4 coups.',
    );
  });
});

describe('tee = strokes over par left after putting and penalties on holes where the fairway is missed', () => {
  const analysis = analyzeOne(card({
    1: { score: 5, fairway_hit: false, gir: false },
    2: { score: 5, putts: 3, fairway_hit: false },
    4: { score: 6, penalty: 1, fairway_hit: false },
  }));

  it('keeps only what is not explained by extra putts or penalties', () => {
    const tee = analysis.leaks.find((leak) => leak.id === 'tee');
    expect(tee).toMatchObject({ title: 'Départs', drill: 'driving', lossPer18: 2 });
  });

  it('does not count a missed green again as an approach loss when the fairway was missed', () => {
    expect(analysis.leaks.find((leak) => leak.id === 'approach')).toBeUndefined();
  });

  it('adds the fairway rate to the sentence', () => {
    const tee = analysis.leaks.find((leak) => leak.id === 'tee');
    expect(tee?.explanation).toBe(
      'Quand tu rates le fairway, tu perds 2 coups par 18 trous (hors putts et pénalités) ; tu touches 79 % des fairways.',
    );
  });
});

describe('approach = 1 stroke per hole with a missed green, fairway not missed, over par beyond putting and penalties', () => {
  const analysis = analyzeOne(card({
    3: { score: 4, gir: false },
    1: { score: 5, gir: false },
    2: { score: 6, gir: false },
    4: { gir: false },
    5: { score: 8, gir: false },
  }));

  it('counts one stroke per such hole', () => {
    const approach = analysis.leaks.find((leak) => leak.id === 'approach');
    expect(approach).toMatchObject({ title: 'Approches', drill: 'approach', lossPer18: 4 });
  });

  it('puts the strokes beyond the first one in the short game', () => {
    const shortGame = analysis.leaks.find((leak) => leak.id === 'short_game');
    expect(shortGame).toMatchObject({ title: 'Petit jeu', drill: 'short_game', lossPer18: 3 });
  });

  it('computes scrambling as par or better after a missed green', () => {
    expect(analysis.metrics.scramblingPct).toBe(20);
    expect(analysis.metrics.girPct).toBe(72);
  });

  it('ranks the top three by loss and breaks ties in definition order', () => {
    expect(analysis.leaks.map((leak) => [leak.id, leak.lossPer18])).toEqual([
      ['approach', 4],
      ['blowups', 3],
      ['short_game', 3],
    ]);
  });

  it('writes the real numbers in both sentences', () => {
    expect(analysis.leaks[0].explanation).toBe(
      'Quand tu rates le green sans avoir raté le fairway, tu perds au moins un coup sur 4 trous par 18 (hors putts et pénalités) ; tu touches 72 % des greens.',
    );
    expect(analysis.leaks[2].explanation).toBe(
      'Quand tu rates le green sans avoir raté le fairway, tu perds 3 coups au-delà du bogey par 18 trous (hors putts et pénalités) ; tu sauves le par dans 20 % des cas.',
    );
  });
});

describe('ranking', () => {
  it('keeps only the three biggest leaks', () => {
    const analysis = analyzeOne(card({
      ...threePuttHoles(2),
      3: { score: 4, penalty: 1 },
      5: { score: 8, gir: false },
      6: { score: 6, fairway_hit: false },
    }));

    expect(analysis.leaks).toHaveLength(3);
  });

  it('drops leaks below half a stroke per 18 holes', () => {
    const rounds = makeRounds(3);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => card(index === 0 ? threePuttHoles(1) : {})),
    });

    expect(analysis.metrics.puttingLossPer18).toBe(0.3);
    expect(analysis.leaks).toEqual([]);
    expect(hasEnoughLeakData(analysis)).toBe(false);
  });

  it('rounds the displayed loss to one decimal', () => {
    const rounds = makeRounds(3);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => card(index < 2 ? threePuttHoles(2) : {})),
    });

    expect(analysis.leaks[0]).toMatchObject({ id: 'putting', lossPer18: 1.3 });
    expect(analysis.leaks[0].explanation).toContain('1,3 trou en 3 putts ou plus');
  });
});

describe('18-hole equivalents', () => {
  it('pools holes across 9 and 18-hole rounds instead of averaging per round', () => {
    const rounds = makeRounds(2);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => (index === 0 ? card(threePuttHoles(2), 18) : card(threePuttHoles(1), 9))),
    });

    expect(analysis.holesAnalyzed).toBe(27);
    expect(analysis.metrics.puttingLossPer18).toBe(2);
  });

  it('scales a 9-hole round to 18 holes', () => {
    const analysis = analyzeOne(card(threePuttHoles(2), 9));

    expect(analysis.metrics.puttingLossPer18).toBe(4);
    expect(analysis.metrics.backNineToPar).toBeNull();
    expect(analysis.metrics.frontNineToPar).toBe(2);
  });
});

describe('legacy rounds and confidence', () => {
  it('excludes rounds without hole rows and counts them', () => {
    const rounds = makeRounds(5);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => (index < 3 ? card(threePuttHoles(2)) : index === 3 ? [] : undefined)),
    });

    expect(analysis.roundsConsidered).toBe(5);
    expect(analysis.roundsAnalyzed).toBe(3);
    expect(analysis.legacyRoundsExcluded).toBe(2);
    expect(analysis.lowConfidence).toBe(false);
    expect(hasEnoughLeakData(analysis)).toBe(true);
  });

  it('flags low confidence below three rounds with hole data, but still computes', () => {
    const rounds = makeRounds(4);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => (index < LEAKS_MIN_ROUNDS - 1 ? card(threePuttHoles(2)) : undefined)),
    });

    expect(analysis.roundsAnalyzed).toBe(2);
    expect(analysis.lowConfidence).toBe(true);
    expect(analysis.leaks[0]).toMatchObject({ id: 'putting', lowConfidence: true });
    expect(hasEnoughLeakData(analysis)).toBe(false);
  });

  it('returns empty metrics when nothing has hole data', () => {
    const rounds = makeRounds(3);
    const analysis = analyzeLeaks({ rounds, holesByRound: {} });

    expect(analysis.roundsAnalyzed).toBe(0);
    expect(analysis.legacyRoundsExcluded).toBe(3);
    expect(analysis.leaks).toEqual([]);
    expect(Object.values(analysis.metrics).every((value) => value === null)).toBe(true);
  });

  it('ignores hole rows with a non-numeric score or par', () => {
    const rows = card(threePuttHoles(1));
    rows[5] = { ...rows[5], score: Number.NaN };

    expect(analyzeOne(rows).holesAnalyzed).toBe(17);
  });
});

describe('window', () => {
  it('only looks at the most recent windowSize rounds, whatever the input order', () => {
    const rounds = makeRounds(6);
    const holesByRound = holesFor(rounds, (index) => card(index < 2 ? threePuttHoles(2) : {}));
    const analysis = analyzeLeaks({ rounds: [...rounds].reverse(), holesByRound, windowSize: 2 });

    expect(analysis.roundsConsidered).toBe(2);
    expect(analysis.metrics.puttingLossPer18).toBe(2);
  });

  it('defaults to the last 10 rounds', () => {
    const rounds = makeRounds(14);
    const analysis = analyzeLeaks({ rounds, holesByRound: holesFor(rounds, () => card()) });

    expect(analysis.windowSize).toBe(10);
    expect(analysis.roundsConsidered).toBe(10);
  });

  it('selects the current and the previous window for fetching', () => {
    const rounds = makeRounds(30);

    expect(selectLeakRounds(rounds).map((round) => round.id)).toEqual(rounds.slice(0, 20).map((round) => round.id));
    expect(selectLeakRounds([...rounds].reverse(), 3).map((round) => round.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
  });
});

describe('trend vs the previous window', () => {
  function withTrend(recentThreePutts: number, previousThreePutts: number, previousRounds = 3) {
    const rounds = makeRounds(3 + previousRounds);
    return analyzeLeaks({
      rounds,
      windowSize: 3,
      holesByRound: holesFor(rounds, (index) => card(threePuttHoles(index < 3 ? recentThreePutts : previousThreePutts))),
    });
  }

  it('reports an improvement as strokes lost per 18 holes', () => {
    const analysis = withTrend(2, 5);

    expect(analysis.leaks[0].trend).toEqual({ direction: 'better', delta: 3 });
  });

  it('reports a regression', () => {
    expect(withTrend(5, 2).leaks[0].trend).toEqual({ direction: 'worse', delta: -3 });
  });

  it('reports stable under 0.3 stroke of difference', () => {
    expect(withTrend(2, 2).leaks[0].trend).toEqual({ direction: 'stable', delta: 0 });
  });

  it('has no trend when the previous window has fewer than three rounds with hole data', () => {
    expect(withTrend(2, 5, 2).leaks[0].trend).toBeNull();
  });

  it('has no trend when the previous window has no data for that leak', () => {
    const rounds = makeRounds(6);
    const analysis = analyzeLeaks({
      rounds,
      windowSize: 3,
      holesByRound: holesFor(rounds, (index) =>
        index < 3 ? card(threePuttHoles(2)) : card().map((hole) => ({ ...hole, putts: null }))),
    });

    expect(analysis.leaks[0].id).toBe('putting');
    expect(analysis.leaks[0].trend).toBeNull();
  });
});

describe('other figures', () => {
  const analysis = analyzeOne(card({
    1: { score: 5 },
    3: { score: 4, gir: false },
    5: { score: 4, putts: 1, gir: true },
    10: { score: 6, fairway_hit: false },
    11: { score: 3 },
    16: { putts: 1 },
    17: { putts: 3, score: 5, gir: false },
  }));

  it('averages the result to par per hole by par type', () => {
    expect(analysis.metrics.toParPar3).toBe(0.25);
    expect(analysis.metrics.toParPar4).toBe(0.3);
    expect(analysis.metrics.toParPar5).toBe(-0.25);
  });

  it('splits front and back nine to par', () => {
    expect(analysis.metrics.frontNineToPar).toBe(1);
    expect(analysis.metrics.backNineToPar).toBe(2);
  });

  it('rates fairways on par 4 and 5 holes only, and greens on every hole', () => {
    expect(analysis.metrics.fairwayPct).toBe(93);
    expect(analysis.metrics.girPct).toBe(89);
  });

  it('compares putts on holes with and without the green in regulation', () => {
    expect(analysis.metrics.puttsPerGirHole).toBe(1.88);
    expect(analysis.metrics.puttsPerNonGirHole).toBe(2.5);
  });

  it('only splits the nines when all nine holes are there', () => {
    const rows = card().filter((hole) => hole.hole_number !== 4);
    const partial = analyzeOne(rows);

    expect(partial.metrics.frontNineToPar).toBeNull();
    expect(partial.metrics.backNineToPar).toBe(0);
  });
});

describe('metrics without the supporting data', () => {
  it('leaves green and fairway figures empty when they were not recorded', () => {
    const rows = card().map((hole) => ({ ...hole, gir: null, fairway_hit: null }));
    const { metrics, leaks } = analyzeOne(rows);

    expect(metrics.girPct).toBeNull();
    expect(metrics.fairwayPct).toBeNull();
    expect(metrics.scramblingPct).toBeNull();
    expect(metrics.puttsPerGirHole).toBeNull();
    expect(leaks).toEqual([]);
  });

  it('does not guess putting figures when putts were not recorded', () => {
    const rows = card({ 1: { score: 6 } }).map((hole) => ({ ...hole, putts: null }));
    const { metrics } = analyzeOne(rows);

    expect(metrics.puttingLossPer18).toBeNull();
    expect(metrics.threePuttHolesPer18).toBeNull();
    expect(metrics.doubleOrWorseHolesPer18).toBe(1);
  });
});

describe('formatting', () => {
  it('describes the loss with a French decimal and a plural that follows the rounded value', () => {
    expect(describeLoss(2.44)).toEqual({ value: '≈ 2,4', unit: 'coups par 18 trous' });
    expect(describeLoss(1.96)).toEqual({ value: '≈ 2', unit: 'coups par 18 trous' });
    expect(describeLoss(1.4)).toEqual({ value: '≈ 1,4', unit: 'coup par 18 trous' });
  });

  it('uses the singular below two strokes in the trend pill and the loss, whatever the decimal', () => {
    expect(getLeakTrendPill({ direction: 'better', delta: 1.5 }).label).toBe('1,5 coup de moins');
    expect(getLeakTrendPill({ direction: 'worse', delta: -1.9 }).label).toBe('1,9 coup de plus');
    expect(getLeakTrendPill({ direction: 'worse', delta: -1.96 }).label).toBe('2 coups de plus');
    expect(getLeakTrendPill({ direction: 'better', delta: 1.5 }).accessibilityLabel).toContain('environ 1,5 coup de moins perdu');
    expect(describeLoss(1.5)).toEqual({ value: '≈ 1,5', unit: 'coup par 18 trous' });
  });

  it('words the legacy exclusion note', () => {
    expect(describeLegacyExclusion(0)).toBeNull();
    expect(describeLegacyExclusion(1)).toBe('1 round saisi sans le détail des trous n’est pas pris en compte.');
    expect(describeLegacyExclusion(3)).toBe('3 rounds saisis sans le détail des trous ne sont pas pris en compte.');
  });

  it('builds the trend pill', () => {
    expect(getLeakTrendPill({ direction: 'better', delta: 0.6 })).toMatchObject({ tone: 'good', icon: 'arrow-down', label: '0,6 coup de moins' });
    expect(getLeakTrendPill({ direction: 'worse', delta: -2.4 })).toMatchObject({ tone: 'warn', icon: 'arrow-up', label: '2,4 coups de plus' });
    expect(getLeakTrendPill({ direction: 'stable', delta: 0.1 })).toMatchObject({ tone: 'neutral', icon: 'minus', label: 'Stable' });
    expect(getLeakTrendPill(null)).toMatchObject({ tone: 'neutral', icon: null, label: 'Pas encore de tendance' });
  });

  it('lists every figure, with a placeholder when there is no data', () => {
    const rows = getMetricRows(analyzeOne(card({ 3: { score: 4, gir: false }, 5: { score: 4, putts: 1 } })).metrics);

    expect(rows.map((row) => row.key)).toEqual([
      'putting-loss',
      'three-putts',
      'putts-gir',
      'putts-no-gir',
      'penalties',
      'doubles',
      'doubles-loss',
      'scrambling',
      'fairways',
      'gir',
      'par-3',
      'par-4',
      'par-5',
      'front-nine',
      'back-nine',
    ]);
    expect(rows.find((row) => row.key === 'scrambling')).toEqual({ key: 'scrambling', label: 'Par sauvé après un green raté', value: '0 %' });
    expect(rows.find((row) => row.key === 'par-3')).toMatchObject({ value: '+0,25', unit: 'par trou' });
    expect(rows.find((row) => row.key === 'par-5')).toMatchObject({ value: '−0,25' });

    const empty = getMetricRows(analyzeLeaks({ rounds: [], holesByRound: {} }).metrics);
    expect(empty.every((row) => row.value === '--' && row.unit === undefined)).toBe(true);
  });
});

describe('rounds whose putts, greens and fairways were never entered (defaults: 2 putts, no green, no fairway)', () => {
  const overPar = { 1: { score: 6 }, 2: { score: 5 }, 4: { score: 5 }, 5: { score: 7 }, 6: { score: 5 }, 8: { score: 5 } };

  it('do not blame the tee, the approach, the short game or the putting for strokes over par', () => {
    const analysis = analyzeOne(scoresOnlyCard(overPar));

    expect(analysis.leaks.map((leak) => leak.id)).toEqual(['blowups']);
    expect(analysis.metrics.puttingLossPer18).toBeNull();
    expect(analysis.metrics.threePuttHolesPer18).toBeNull();
    expect(analysis.metrics.fairwayPct).toBeNull();
    expect(analysis.metrics.girPct).toBeNull();
    expect(analysis.metrics.scramblingPct).toBeNull();
    expect(analysis.metrics.puttsPerGirHole).toBeNull();
    expect(analysis.metrics.puttsPerNonGirHole).toBeNull();
  });

  it('still count penalties, blow-ups and the result to par from the explicit scores', () => {
    const analysis = analyzeOne(scoresOnlyCard({ 1: { score: 7, penalty: 1 }, 2: { score: 3 }, 3: { score: 3 } }));

    expect(analysis.metrics.penaltyStrokesPer18).toBe(1);
    expect(analysis.metrics.doubleOrWorseHolesPer18).toBe(1);
    expect(analysis.metrics.doubleOrWorseLossPer18).toBe(2);
    expect(analysis.metrics.toParPar4).toBe(0.2);
    expect(analysis.holesAnalyzed).toBe(18);
  });

  it('attribute strokes as before once the same card has a green or a fairway marked', () => {
    const rows = scoresOnlyCard(overPar);
    rows[11] = { ...rows[11], gir: true };

    const analysis = analyzeOne(rows);

    expect(analysis.leaks.map((leak) => leak.id)).toEqual(expect.arrayContaining(['tee']));
    expect(analysis.metrics.girPct).toBe(6);
  });

  it('count for the confidence of penalties and blow-ups, not for the detail-based leaks', () => {
    const rounds = makeRounds(4);
    const analysis = analyzeLeaks({ rounds, holesByRound: holesFor(rounds, () => scoresOnlyCard(overPar)) });

    expect(analysis.roundsAnalyzed).toBe(4);
    expect(analysis.roundsWithDetails).toBe(0);
    expect(analysis.lowConfidence).toBe(false);
    expect(analysis.detailsLowConfidence).toBe(true);
    expect(analysis.leaks.map((leak) => leak.id)).toEqual(['blowups']);
    expect(hasEnoughLeakData(analysis)).toBe(true);
  });

  it('do not complete a window of detailed rounds: two detailed rounds among five are still too few for the detail-based leaks', () => {
    const rounds = makeRounds(5);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => (index < 2 ? card(threePuttHoles(4)) : scoresOnlyCard(overPar))),
    });

    expect(analysis.roundsAnalyzed).toBe(5);
    expect(analysis.roundsWithDetails).toBe(2);
    expect(analysis.detailsLowConfidence).toBe(true);
    expect(analysis.leaks.find((leak) => leak.id === 'putting')).toBeUndefined();
    expect(analysis.leaks.find((leak) => leak.id === 'blowups')).toBeDefined();
  });

  it('do not dilute the detail-based figures of the detailed rounds they sit next to', () => {
    const rounds = makeRounds(5);
    const analysis = analyzeLeaks({
      rounds,
      holesByRound: holesFor(rounds, (index) => (index < 3 ? card(threePuttHoles(2)) : scoresOnlyCard({}))),
    });

    expect(analysis.roundsWithDetails).toBe(3);
    expect(analysis.detailsLowConfidence).toBe(false);
    expect(analysis.metrics.puttingLossPer18).toBe(2);
    expect(analysis.leaks[0]).toMatchObject({ id: 'putting', lossPer18: 2 });
  });

  it('have no trend for a detail-based leak when the previous window has too few detailed rounds', () => {
    const rounds = makeRounds(6);
    const analysis = analyzeLeaks({
      rounds,
      windowSize: 3,
      holesByRound: holesFor(rounds, (index) =>
        index < 3 ? card({ ...threePuttHoles(2), 12: { score: 7 } }) : index === 3 ? card(threePuttHoles(5)) : scoresOnlyCard({ 12: { score: 6 } })),
    });

    expect(analysis.leaks.find((leak) => leak.id === 'putting')?.trend).toBeNull();
    expect(analysis.leaks.find((leak) => leak.id === 'blowups')?.trend).not.toBeNull();
  });

  it('are listed in the legacy exclusion only when they have no hole rows at all', () => {
    const rounds = makeRounds(3);
    const analysis = analyzeLeaks({ rounds, holesByRound: holesFor(rounds, (index) => (index === 0 ? undefined : scoresOnlyCard())) });

    expect(analysis.legacyRoundsExcluded).toBe(1);
  });
});

describe('describeMissingDetails', () => {
  it('is empty when enough rounds carry putts, greens or fairways', () => {
    expect(describeMissingDetails({ roundsWithDetails: 3, detailsLowConfidence: false })).toBeNull();
  });

  it('says how many detailed rounds there are', () => {
    expect(describeMissingDetails({ roundsWithDetails: 0, detailsLowConfidence: true })).toBe(
      'Putts, greens et fairways ne sont pas analysés : il faut au moins 3 rounds où tu les as saisis. Tu n’en as pas encore.',
    );
    expect(describeMissingDetails({ roundsWithDetails: 2, detailsLowConfidence: true })).toBe(
      'Putts, greens et fairways ne sont pas analysés : il faut au moins 3 rounds où tu les as saisis. Tu en as\u00a02.',
    );
  });
});
