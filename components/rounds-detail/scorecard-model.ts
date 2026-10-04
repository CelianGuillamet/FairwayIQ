import { describeStrokes } from '../../lib/score-labels';
import type { RoundDraftHole } from '../../types';

export const SCORECARD_COLUMNS = 9;

export type ScorecardCell = {
  number: number;
  par: number | null;
  strokes: number | null;
};

export type ScorecardHalf = {
  key: 'front' | 'back' | 'all';
  label: string;
  cells: ScorecardCell[];
  parTotal: number | null;
  scoreTotal: number | null;
};

function toCell(hole: RoundDraftHole): ScorecardCell {
  return hole.completed
    ? { number: hole.hole_number, par: hole.par, strokes: hole.score }
    : { number: hole.hole_number, par: null, strokes: null };
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

function buildHalf(key: ScorecardHalf['key'], label: string, holes: RoundDraftHole[]): ScorecardHalf {
  const cells = holes.map(toCell);

  return {
    key,
    label,
    cells,
    parTotal: sumKnown(cells.map((cell) => cell.par)),
    scoreTotal: sumKnown(cells.map((cell) => cell.strokes)),
  };
}

export function buildScorecardHalves(scorecard: RoundDraftHole[], roundHoles: 9 | 18): ScorecardHalf[] {
  const front = scorecard.slice(0, SCORECARD_COLUMNS);

  if (roundHoles !== 18) {
    return front.length > 0 ? [buildHalf('all', 'Trou', front)] : [];
  }

  const back = scorecard.slice(SCORECARD_COLUMNS, SCORECARD_COLUMNS * 2);

  return [
    ...(front.length > 0 ? [buildHalf('front', 'Aller', front)] : []),
    ...(back.length > 0 ? [buildHalf('back', 'Retour', back)] : []),
  ];
}

export function describeHole(cell: ScorecardCell): string {
  if (cell.par == null || cell.strokes == null) {
    return `Trou ${cell.number}, non saisi`;
  }

  return `Trou ${cell.number}, par ${cell.par}, ${describeStrokes(cell.strokes, cell.par)}`;
}

const TOTAL_NAMES: Record<ScorecardHalf['key'], string> = {
  front: 'aller',
  back: 'retour',
  all: 'carte',
};

export function describeHalfTotal(half: ScorecardHalf): string {
  const name = TOTAL_NAMES[half.key];

  if (half.scoreTotal == null) {
    return `Total ${name}, non saisi`;
  }

  const strokes = `${half.scoreTotal} coup${half.scoreTotal > 1 ? 's' : ''}`;
  return half.parTotal == null ? `Total ${name}, ${strokes}` : `Total ${name}, ${strokes}, par ${half.parTotal}`;
}
