import type { Round, RoundHole } from '../types';
import type { DrillCategory } from './drill-library';
import { formatDecimalFr, type TrendPill } from './home';

export type HoleRow = Pick<RoundHole, 'hole_number' | 'par' | 'score' | 'putts' | 'gir' | 'fairway_hit' | 'penalty'>;
export type LeakRound = Pick<Round, 'id' | 'played_at'>;
export type HolesByRound = Record<string, readonly HoleRow[] | undefined>;

export const LEAKS_WINDOW = 10;
export const LEAKS_MIN_ROUNDS = 3;
export const LEAKS_MIN_LOSS = 0.5;
export const LEAKS_TREND_THRESHOLD = 0.3;
const TOP_LEAKS = 3;
const FULL_ROUND_HOLES = 18;
const NINE_HOLES = 9;

export type LeakId = 'putting' | 'penalties' | 'blowups' | 'tee' | 'approach' | 'short_game';

export type LeakTrend = {
  direction: 'better' | 'worse' | 'stable';
  delta: number;
};

export type Leak = {
  id: LeakId;
  title: string;
  lossPer18: number;
  explanation: string;
  trend: LeakTrend | null;
  drill: DrillCategory;
  lowConfidence: boolean;
};

export type LeakMetrics = {
  puttingLossPer18: number | null;
  threePuttHolesPer18: number | null;
  penaltyStrokesPer18: number | null;
  doubleOrWorseHolesPer18: number | null;
  doubleOrWorseLossPer18: number | null;
  scramblingPct: number | null;
  toParPar3: number | null;
  toParPar4: number | null;
  toParPar5: number | null;
  frontNineToPar: number | null;
  backNineToPar: number | null;
  fairwayPct: number | null;
  girPct: number | null;
  puttsPerGirHole: number | null;
  puttsPerNonGirHole: number | null;
};

export type LeaksAnalysis = {
  windowSize: number;
  roundsConsidered: number;
  roundsAnalyzed: number;
  legacyRoundsExcluded: number;
  holesAnalyzed: number;
  lowConfidence: boolean;
  leaks: Leak[];
  metrics: LeakMetrics;
};

type Ratio = { sum: number; count: number };

type Summary = {
  rounds: number;
  holes: number;
  puttingScope: number;
  teeScope: number;
  greenScope: number;
  puttingLoss: number;
  threePutts: number;
  penaltyStrokes: number;
  doubleHoles: number;
  doubleLoss: number;
  teeLoss: number;
  approachLoss: number;
  shortGameLoss: number;
  missedGreens: number;
  parSaves: number;
  fairwayHits: number;
  fairwayChances: number;
  girHits: number;
  girChances: number;
  puttsOnGreen: Ratio;
  puttsOffGreen: Ratio;
  toPar: Record<3 | 4 | 5, Ratio>;
  frontNine: Ratio;
  backNine: Ratio;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function per18(value: number, scope: number) {
  return scope > 0 ? (value / scope) * FULL_ROUND_HOLES : null;
}

function average(ratio: Ratio) {
  return ratio.count > 0 ? ratio.sum / ratio.count : null;
}

function percent(hits: number, chances: number) {
  return chances > 0 ? Math.round((hits / chances) * 100) : null;
}

function isUsableHole(hole: HoleRow) {
  return Number.isFinite(hole.par) && Number.isFinite(hole.score);
}

function nineHolesToPar(rows: readonly HoleRow[], first: number, last: number) {
  const nine = rows.filter((hole) => hole.hole_number >= first && hole.hole_number <= last);

  if (new Set(nine.map((hole) => hole.hole_number)).size !== NINE_HOLES) {
    return null;
  }

  return nine.reduce((total, hole) => total + hole.score - hole.par, 0);
}

function emptySummary(): Summary {
  const ratio = (): Ratio => ({ sum: 0, count: 0 });

  return {
    rounds: 0,
    holes: 0,
    puttingScope: 0,
    teeScope: 0,
    greenScope: 0,
    puttingLoss: 0,
    threePutts: 0,
    penaltyStrokes: 0,
    doubleHoles: 0,
    doubleLoss: 0,
    teeLoss: 0,
    approachLoss: 0,
    shortGameLoss: 0,
    missedGreens: 0,
    parSaves: 0,
    fairwayHits: 0,
    fairwayChances: 0,
    girHits: 0,
    girChances: 0,
    puttsOnGreen: ratio(),
    puttsOffGreen: ratio(),
    toPar: { 3: ratio(), 4: ratio(), 5: ratio() },
    frontNine: ratio(),
    backNine: ratio(),
  };
}

function unexplainedStrokes(overPar: number, putts: number, penalty: number) {
  return Math.max(overPar - Math.max(putts - 2, 0) - penalty, 0);
}

function addRound(summary: Summary, rows: readonly HoleRow[]) {
  const hasPutts = rows.some((hole) => hole.putts != null);
  const hasFairways = rows.some((hole) => hole.fairway_hit != null);
  const hasGreens = rows.some((hole) => hole.gir != null);

  summary.rounds += 1;
  summary.holes += rows.length;
  if (hasPutts) summary.puttingScope += rows.length;
  if (hasPutts && hasFairways) summary.teeScope += rows.length;
  if (hasPutts && hasGreens) summary.greenScope += rows.length;

  for (const hole of rows) {
    const overPar = hole.score - hole.par;
    const penalty = Number.isFinite(hole.penalty) ? hole.penalty : 0;

    summary.penaltyStrokes += penalty;

    if (overPar >= 2) {
      summary.doubleHoles += 1;
      summary.doubleLoss += overPar - 1;
    }

    if (hole.par === 3 || hole.par === 4 || hole.par === 5) {
      summary.toPar[hole.par].sum += overPar;
      summary.toPar[hole.par].count += 1;
    }

    if (hole.fairway_hit != null) {
      summary.fairwayChances += 1;
      if (hole.fairway_hit) summary.fairwayHits += 1;
    }

    if (hole.gir != null) {
      summary.girChances += 1;
      if (hole.gir) summary.girHits += 1;
      if (!hole.gir) {
        summary.missedGreens += 1;
        if (overPar <= 0) summary.parSaves += 1;
      }

      if (hole.putts != null) {
        const target = hole.gir ? summary.puttsOnGreen : summary.puttsOffGreen;
        target.sum += hole.putts;
        target.count += 1;
      }
    }

    if (hole.putts == null) continue;

    summary.puttingLoss += Math.max(hole.putts - 2, 0);
    if (hole.putts >= 3) summary.threePutts += 1;

    const unexplained = unexplainedStrokes(overPar, hole.putts, penalty);

    // A missed fairway takes the blame first; the missed green only counts when the fairway was
    // not missed (hit, or a par 3 where the tee shot is the approach).
    if (hole.fairway_hit === false) {
      summary.teeLoss += unexplained;
    } else if (hole.gir === false) {
      summary.approachLoss += Math.min(unexplained, 1);
      summary.shortGameLoss += Math.max(unexplained - 1, 0);
    }
  }

  const front = nineHolesToPar(rows, 1, 9);
  if (front != null) {
    summary.frontNine.sum += front;
    summary.frontNine.count += 1;
  }

  const back = nineHolesToPar(rows, 10, 18);
  if (back != null) {
    summary.backNine.sum += back;
    summary.backNine.count += 1;
  }
}

function summarize(roundsRows: readonly (readonly HoleRow[])[]) {
  const summary = emptySummary();

  for (const rows of roundsRows) {
    addRound(summary, rows);
  }

  return summary;
}

function toMetrics(summary: Summary): LeakMetrics {
  const nullable = (value: number | null, round: (v: number) => number) => (value == null ? null : round(value));
  const onGreen = average(summary.puttsOnGreen);
  const offGreen = average(summary.puttsOffGreen);

  return {
    puttingLossPer18: nullable(per18(summary.puttingLoss, summary.puttingScope), round1),
    threePuttHolesPer18: nullable(per18(summary.threePutts, summary.puttingScope), round1),
    penaltyStrokesPer18: nullable(per18(summary.penaltyStrokes, summary.holes), round1),
    doubleOrWorseHolesPer18: nullable(per18(summary.doubleHoles, summary.holes), round1),
    doubleOrWorseLossPer18: nullable(per18(summary.doubleLoss, summary.holes), round1),
    scramblingPct: percent(summary.parSaves, summary.missedGreens),
    toParPar3: nullable(average(summary.toPar[3]), round2),
    toParPar4: nullable(average(summary.toPar[4]), round2),
    toParPar5: nullable(average(summary.toPar[5]), round2),
    frontNineToPar: nullable(average(summary.frontNine), round1),
    backNineToPar: nullable(average(summary.backNine), round1),
    fairwayPct: percent(summary.fairwayHits, summary.fairwayChances),
    girPct: percent(summary.girHits, summary.girChances),
    puttsPerGirHole: nullable(onGreen, round2),
    puttsPerNonGirHole: nullable(offGreen, round2),
  };
}

function count(value: number, singular: string, plural = `${singular}s`) {
  const rounded = round1(value);
  return `${formatDecimalFr(rounded, 1)} ${rounded >= 2 ? plural : singular}`;
}

function pct(value: number) {
  return `${value} %`;
}

type LeakDefinition = {
  id: LeakId;
  title: string;
  drill: DrillCategory;
  loss: (summary: Summary) => number | null;
  explain: (summary: Summary, metrics: LeakMetrics, loss: number) => string;
};

// The order is also the tie-break when two leaks cost the same.
const LEAK_DEFINITIONS: readonly LeakDefinition[] = [
  {
    id: 'putting',
    title: 'Putting',
    drill: 'putting',
    loss: (summary) => per18(summary.puttingLoss, summary.puttingScope),
    explain: (summary, metrics) => {
      const threePutts = count(per18(summary.threePutts, summary.puttingScope) ?? 0, 'trou', 'trous');
      const split = metrics.puttsPerGirHole != null && metrics.puttsPerNonGirHole != null
        ? ` ; tu prends ${count(metrics.puttsPerGirHole, 'putt')} par trou quand tu touches le green, ${count(metrics.puttsPerNonGirHole, 'putt')} sinon`
        : '';

      return `Sur 18 trous, tu joues en moyenne ${threePutts} en 3 putts ou plus${split}.`;
    },
  },
  {
    id: 'penalties',
    title: 'Pénalités',
    drill: 'driving',
    loss: (summary) => per18(summary.penaltyStrokes, summary.holes),
    explain: (_summary, _metrics, loss) => `Sur 18 trous, tu écopes en moyenne de ${count(loss, 'coup')} de pénalité.`,
  },
  {
    id: 'blowups',
    title: 'Trous catastrophe',
    drill: 'mental',
    loss: (summary) => per18(summary.doubleLoss, summary.holes),
    explain: (summary, _metrics, loss) => {
      const holes = count(per18(summary.doubleHoles, summary.holes) ?? 0, 'trou', 'trous');
      return `Sur 18 trous, tu joues en moyenne ${holes} en double bogey ou pire ; au-delà du bogey, cela te coûte ${count(loss, 'coup')}.`;
    },
  },
  {
    id: 'tee',
    title: 'Départs',
    drill: 'driving',
    loss: (summary) => per18(summary.teeLoss, summary.teeScope),
    explain: (_summary, metrics, loss) => {
      const accuracy = metrics.fairwayPct != null ? ` ; tu touches ${pct(metrics.fairwayPct)} des fairways` : '';
      return `Quand tu rates le fairway, tu perds ${count(loss, 'coup')} par 18 trous (hors putts et pénalités)${accuracy}.`;
    },
  },
  {
    id: 'approach',
    title: 'Approches',
    drill: 'approach',
    loss: (summary) => per18(summary.approachLoss, summary.greenScope),
    explain: (_summary, metrics, loss) => {
      const accuracy = metrics.girPct != null ? ` ; tu touches ${pct(metrics.girPct)} des greens` : '';
      return `Quand tu rates le green sans avoir raté le fairway, tu perds au moins un coup sur ${count(loss, 'trou', 'trous')} par 18 (hors putts et pénalités)${accuracy}.`;
    },
  },
  {
    id: 'short_game',
    title: 'Petit jeu',
    drill: 'short_game',
    loss: (summary) => per18(summary.shortGameLoss, summary.greenScope),
    explain: (_summary, metrics, loss) => {
      const recovery = metrics.scramblingPct != null ? ` ; tu sauves le par dans ${pct(metrics.scramblingPct)} des cas` : '';
      return `Quand tu rates le green sans avoir raté le fairway, tu perds ${count(loss, 'coup')} au-delà du bogey par 18 trous (hors putts et pénalités)${recovery}.`;
    },
  },
];

function compareNewestFirst(left: LeakRound, right: LeakRound) {
  const byDate = new Date(right.played_at).getTime() - new Date(left.played_at).getTime();

  if (byDate !== 0 && !Number.isNaN(byDate)) {
    return byDate;
  }

  return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
}

export function selectLeakRounds<T extends LeakRound>(rounds: readonly T[], windowSize = LEAKS_WINDOW) {
  return [...rounds].sort(compareNewestFirst).slice(0, windowSize * 2);
}

function usableRows(round: LeakRound, holesByRound: HolesByRound) {
  const rows = (holesByRound[round.id] ?? []).filter(isUsableHole);
  return rows.length > 0 ? rows : null;
}

function collectRows(rounds: readonly LeakRound[], holesByRound: HolesByRound) {
  return rounds.flatMap((round) => {
    const rows = usableRows(round, holesByRound);
    return rows ? [rows] : [];
  });
}

function getTrend(current: number, previous: number | null): LeakTrend | null {
  if (previous == null) return null;

  const delta = round1(previous - current);
  const direction = delta >= LEAKS_TREND_THRESHOLD ? 'better' : delta <= -LEAKS_TREND_THRESHOLD ? 'worse' : 'stable';

  return { direction, delta };
}

export function analyzeLeaks(input: {
  rounds: readonly LeakRound[];
  holesByRound: HolesByRound;
  windowSize?: number;
}): LeaksAnalysis {
  const windowSize = input.windowSize ?? LEAKS_WINDOW;
  const sorted = [...input.rounds].sort(compareNewestFirst);
  const recent = sorted.slice(0, windowSize);
  const earlier = sorted.slice(windowSize, windowSize * 2);

  const currentRows = collectRows(recent, input.holesByRound);
  const previousRows = collectRows(earlier, input.holesByRound);
  const current = summarize(currentRows);
  const previous = summarize(previousRows);
  const metrics = toMetrics(current);
  const lowConfidence = current.rounds < LEAKS_MIN_ROUNDS;
  const hasPrevious = !lowConfidence && previous.rounds >= LEAKS_MIN_ROUNDS;

  const leaks = LEAK_DEFINITIONS
    .flatMap((definition, order) => {
      const loss = definition.loss(current);
      return loss != null && loss >= LEAKS_MIN_LOSS ? [{ definition, order, loss }] : [];
    })
    .sort((left, right) => right.loss - left.loss || left.order - right.order)
    .slice(0, TOP_LEAKS)
    .map(({ definition, loss }): Leak => ({
      id: definition.id,
      title: definition.title,
      lossPer18: round1(loss),
      explanation: definition.explain(current, metrics, loss),
      trend: hasPrevious ? getTrend(loss, definition.loss(previous)) : null,
      drill: definition.drill,
      lowConfidence,
    }));

  return {
    windowSize,
    roundsConsidered: recent.length,
    roundsAnalyzed: current.rounds,
    legacyRoundsExcluded: recent.length - current.rounds,
    holesAnalyzed: current.holes,
    lowConfidence,
    leaks,
    metrics,
  };
}

export function hasEnoughLeakData(analysis: LeaksAnalysis) {
  return !analysis.lowConfidence && analysis.leaks.length > 0;
}

export function describeLoss(lossPer18: number) {
  const rounded = round1(lossPer18);

  return {
    value: `≈ ${formatDecimalFr(rounded, 1)}`,
    unit: `${rounded >= 2 ? 'coups' : 'coup'} par 18 trous`,
  };
}

export function describeLegacyExclusion(count: number) {
  if (count <= 0) return null;

  return count === 1
    ? '1 round saisi sans le détail des trous n’est pas pris en compte.'
    : `${count} rounds saisis sans le détail des trous ne sont pas pris en compte.`;
}

export function getLeakTrendPill(trend: LeakTrend | null): TrendPill {
  if (trend == null) {
    return {
      tone: 'neutral',
      icon: null,
      label: 'Pas encore de tendance',
      accessibilityLabel: 'Pas assez de rounds trou par trou pour comparer avec les rounds précédents.',
    };
  }

  if (trend.direction === 'stable') {
    return {
      tone: 'neutral',
      icon: 'minus',
      label: 'Stable',
      accessibilityLabel: 'Tendance stable par rapport aux rounds précédents.',
    };
  }

  const amount = count(Math.abs(trend.delta), 'coup');

  if (trend.direction === 'better') {
    return {
      tone: 'good',
      icon: 'arrow-down',
      label: `${amount} de moins`,
      accessibilityLabel: `Tendance : environ ${amount} de moins perdu par 18 trous que sur les rounds précédents.`,
    };
  }

  return {
    tone: 'warn',
    icon: 'arrow-up',
    label: `${amount} de plus`,
    accessibilityLabel: `Tendance : environ ${amount} de plus perdu par 18 trous que sur les rounds précédents.`,
  };
}

export type MetricRow = {
  key: string;
  label: string;
  value: string;
  unit?: string;
};

const PLACEHOLDER = '--';
const PER_18 = 'par 18 trous';
const PER_9 = 'par 9 trous';

function numberRow(key: string, label: string, value: number | null, unit?: string): MetricRow {
  return { key, label, value: value == null ? PLACEHOLDER : formatDecimalFr(value, 1), unit: value == null ? undefined : unit };
}

function signedRow(key: string, label: string, value: number | null, unit: string | undefined, decimals: number): MetricRow {
  if (value == null) return { key, label, value: PLACEHOLDER };

  const rounded = Number(value.toFixed(decimals));
  const text = formatDecimalFr(Math.abs(rounded), decimals);
  const signed = rounded > 0 ? `+${text}` : rounded < 0 ? `−${text}` : '0';

  return { key, label, value: signed, unit };
}

function percentRow(key: string, label: string, value: number | null): MetricRow {
  return { key, label, value: value == null ? PLACEHOLDER : pct(value) };
}

export function getMetricRows(metrics: LeakMetrics): MetricRow[] {
  return [
    numberRow('putting-loss', 'Coups perdus aux putts', metrics.puttingLossPer18, PER_18),
    numberRow('three-putts', 'Trous à 3 putts ou plus', metrics.threePuttHolesPer18, PER_18),
    numberRow('putts-gir', 'Putts par green touché', metrics.puttsPerGirHole),
    numberRow('putts-no-gir', 'Putts par green raté', metrics.puttsPerNonGirHole),
    numberRow('penalties', 'Coups de pénalité', metrics.penaltyStrokesPer18, PER_18),
    numberRow('doubles', 'Doubles bogeys ou pires', metrics.doubleOrWorseHolesPer18, PER_18),
    numberRow('doubles-loss', 'Coups perdus au-delà du bogey', metrics.doubleOrWorseLossPer18, PER_18),
    percentRow('scrambling', 'Par sauvé après un green raté', metrics.scramblingPct),
    percentRow('fairways', 'Fairways touchés', metrics.fairwayPct),
    percentRow('gir', 'Greens en régulation', metrics.girPct),
    signedRow('par-3', 'Écart au par sur les par 3', metrics.toParPar3, 'par trou', 2),
    signedRow('par-4', 'Écart au par sur les par 4', metrics.toParPar4, 'par trou', 2),
    signedRow('par-5', 'Écart au par sur les par 5', metrics.toParPar5, 'par trou', 2),
    signedRow('front-nine', 'Aller (trous 1 à 9)', metrics.frontNineToPar, PER_9, 1),
    signedRow('back-nine', 'Retour (trous 10 à 18)', metrics.backNineToPar, PER_9, 1),
  ];
}
