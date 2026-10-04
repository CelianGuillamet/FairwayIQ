import type { RoundDraftHole } from '../../types';
import {
  buildScorecardHalves,
  describeHalfTotal,
  describeHole,
} from './scorecard-model';

function hole(number: number, par: number, score: number, completed = true): RoundDraftHole {
  return {
    hole_number: number,
    par,
    score,
    putts: 2,
    gir: false,
    fairway_hit: par === 3 ? null : false,
    penalty: 0,
    completed,
  };
}

function buildCard(count: number, pars: number[], scores: number[]) {
  return Array.from({ length: count }, (_, index) => hole(index + 1, pars[index % pars.length], scores[index % scores.length]));
}

describe('buildScorecardHalves', () => {
  it('splits an 18-hole card into Aller and Retour with their totals', () => {
    const card = buildCard(18, [4, 5, 3], [5, 5, 4]);
    const [front, back] = buildScorecardHalves(card, 18);

    expect(front.label).toBe('Aller');
    expect(back.label).toBe('Retour');
    expect(front.cells.map((cell) => cell.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(back.cells.map((cell) => cell.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(front.parTotal).toBe(36);
    expect(front.scoreTotal).toBe(42);
    expect(back.parTotal).toBe(36);
    expect(back.scoreTotal).toBe(42);
  });

  it('keeps a 9-hole card as a single table', () => {
    const card = buildCard(9, [4], [5]);
    const halves = buildScorecardHalves(card, 9);

    expect(halves).toHaveLength(1);
    expect(halves[0]).toMatchObject({ key: 'all', label: 'Trou', parTotal: 36, scoreTotal: 45 });
  });

  it('drops the Retour table when an 18-hole round only has the front nine', () => {
    const halves = buildScorecardHalves(buildCard(9, [4], [4]), 18);

    expect(halves.map((half) => half.label)).toEqual(['Aller']);
  });

  it('ignores holes beyond the round length', () => {
    const halves = buildScorecardHalves(buildCard(18, [4], [4]), 9);

    expect(halves).toHaveLength(1);
    expect(halves[0].cells).toHaveLength(9);
  });

  it('returns nothing for an empty card', () => {
    expect(buildScorecardHalves([], 18)).toEqual([]);
    expect(buildScorecardHalves([], 9)).toEqual([]);
  });

  it('leaves holes that were never entered blank and out of the totals', () => {
    const card = buildCard(9, [4], [5]);
    card[3] = hole(4, 4, 4, false);
    const [half] = buildScorecardHalves(card, 9);

    expect(half.cells[3]).toEqual({ number: 4, par: null, strokes: null });
    expect(half.parTotal).toBe(32);
    expect(half.scoreTotal).toBe(40);
  });

  it('reports null totals when no hole was entered', () => {
    const card = buildCard(9, [4], [5]).map((entry) => ({ ...entry, completed: false }));
    const [half] = buildScorecardHalves(card, 9);

    expect(half.parTotal).toBeNull();
    expect(half.scoreTotal).toBeNull();
  });
});

describe('describeHole', () => {
  it('spells out the hole, par, strokes and notation', () => {
    expect(describeHole({ number: 7, par: 5, strokes: 7 })).toBe('Trou 7, par 5, 7 coups, double bogey ou plus');
    expect(describeHole({ number: 8, par: 3, strokes: 2 })).toBe('Trou 8, par 3, 2 coups, birdie');
    expect(describeHole({ number: 3, par: 4, strokes: 4 })).toBe('Trou 3, par 4, 4 coups, par');
  });

  it('uses the singular for a single stroke', () => {
    expect(describeHole({ number: 2, par: 3, strokes: 1 })).toBe('Trou 2, par 3, 1 coup, eagle ou mieux');
  });

  it('flags a hole that was not entered', () => {
    expect(describeHole({ number: 4, par: null, strokes: null })).toBe('Trou 4, non saisi');
  });
});

describe('describeHalfTotal', () => {
  it('names the half and gives strokes and par', () => {
    const [front, back] = buildScorecardHalves(buildCard(18, [4], [5]), 18);

    expect(describeHalfTotal(front)).toBe('Total aller, 45 coups, par 36');
    expect(describeHalfTotal(back)).toBe('Total retour, 45 coups, par 36');
  });

  it('names a single table as the card', () => {
    const [half] = buildScorecardHalves(buildCard(9, [4], [4]), 9);

    expect(describeHalfTotal(half)).toBe('Total carte, 36 coups, par 36');
  });

  it('flags an empty half', () => {
    const card = buildCard(9, [4], [5]).map((entry) => ({ ...entry, completed: false }));
    const [half] = buildScorecardHalves(card, 9);

    expect(describeHalfTotal(half)).toBe('Total carte, non saisi');
  });
});
