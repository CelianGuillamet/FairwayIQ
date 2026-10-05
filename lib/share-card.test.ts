import { buildScorecardHalves } from '../components/rounds-detail/scorecard-model';
import type { RoundAggregate, RoundDraftHole } from '../types';
import { buildShareCardModel, buildShareHoleRows, selectShareStats } from './share-card';

const aggregate: RoundAggregate = {
  holes: 18,
  par: 72,
  total_score: 81,
  putts: 33,
  gir: 6,
  fairways_hit: 8,
  fairways_total: 14,
  penalties: 0,
  front_nine_score: 40,
  back_nine_score: 41,
  front_nine_to_par: 4,
  back_nine_to_par: 5,
  average_putts_per_hole: 1.8,
  gir_percentage: 33,
  fairway_percentage: 57,
  score_to_par: 9,
};

const round = {
  course_name: 'Golf de Saint-Cloud',
  played_at: '2026-10-03T12:00:00.000Z',
  holes: 18 as const,
  total_score: 81,
  par: 72,
  putts: 36,
  gir: 4,
  fairways_hit: 7,
  fairways_total: 14,
  penalties: 3,
};

const bareRound = {
  ...round,
  putts: null,
  gir: null,
  fairways_hit: null,
  fairways_total: null,
  penalties: null,
};

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

function card(count: number, playedCount = count) {
  return Array.from({ length: count }, (_, index) => hole(index + 1, 4, 5, index < playedCount));
}

describe('buildShareHoleRows', () => {
  it('lays an 18-hole round out as two rows of nine', () => {
    const rows = buildShareHoleRows(buildScorecardHalves(card(18), 18));

    expect(rows.map((row) => row.key)).toEqual(['front', 'back']);
    expect(rows[0].cells.map((cell) => cell.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rows[1].cells.map((cell) => cell.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('shows a 9-hole round as one row of nine, never padded to eighteen', () => {
    const rows = buildShareHoleRows(buildScorecardHalves(card(9), 9));

    expect(rows).toHaveLength(1);
    expect(rows[0].cells).toHaveLength(9);
  });

  it('returns no row when there is no hole-by-hole data', () => {
    expect(buildShareHoleRows([])).toEqual([]);
  });

  it('drops a half where no hole was played', () => {
    const rows = buildShareHoleRows(buildScorecardHalves(card(18, 9), 18));

    expect(rows.map((row) => row.key)).toEqual(['front']);
  });

  it('leaves unplayed holes empty instead of inventing a score', () => {
    const [row] = buildShareHoleRows(buildScorecardHalves(card(9, 6), 9));

    expect(row.cells.slice(0, 6).every((cell) => cell.strokes === 5 && cell.par === 4)).toBe(true);
    expect(row.cells.slice(6)).toEqual([
      { number: 7, strokes: null, par: null },
      { number: 8, strokes: null, par: null },
      { number: 9, strokes: null, par: null },
    ]);
  });
});

describe('selectShareStats', () => {
  it('keeps the four stats in order when everything is recorded', () => {
    const stats = selectShareStats(round, null);

    expect(stats.map((stat) => stat.key)).toEqual(['fairways', 'gir', 'putts', 'penalties']);
    expect(stats.map((stat) => stat.label)).toEqual(['Fairways', 'Greens en rég.', 'Putts', 'Pénalités']);
  });

  it('formats ratios with their total', () => {
    const [fairways, gir, putts, penalties] = selectShareStats(round, null);

    expect(fairways).toMatchObject({ value: '7', suffix: '/14' });
    expect(gir).toMatchObject({ value: '4', suffix: '/18' });
    expect(putts).toMatchObject({ value: '36', suffix: null });
    expect(penalties).toMatchObject({ value: '3', suffix: null });
  });

  it('omits what is not recorded', () => {
    expect(selectShareStats(bareRound, null)).toEqual([]);
    expect(selectShareStats({ ...bareRound, putts: 34 }, null).map((stat) => stat.key)).toEqual(['putts']);
    expect(selectShareStats({ ...bareRound, gir: 5 }, null).map((stat) => stat.key)).toEqual(['gir']);
  });

  it('omits fairways when the course has none to hit', () => {
    const stats = selectShareStats({ ...round, fairways_hit: 0, fairways_total: 0 }, null);

    expect(stats.map((stat) => stat.key)).toEqual(['gir', 'putts', 'penalties']);
  });

  it('keeps a recorded zero for penalties', () => {
    const stats = selectShareStats({ ...bareRound, penalties: 0 }, null);

    expect(stats).toEqual([{ key: 'penalties', label: 'Pénalités', value: '0', suffix: null }]);
  });

  it('prefers the hole-by-hole totals and always has penalties', () => {
    const stats = selectShareStats(bareRound, aggregate);

    expect(stats.map((stat) => stat.key)).toEqual(['fairways', 'gir', 'putts', 'penalties']);
    expect(stats[0]).toMatchObject({ value: '8', suffix: '/14' });
    expect(stats[3]).toMatchObject({ value: '0' });
  });
});

describe('buildShareCardModel', () => {
  it('describes the score against par in French', () => {
    const model = buildShareCardModel({ round, aggregate: null, halves: [] });

    expect(model.totalScore).toBe(81);
    expect(model.toParLabel).toBe('+9 par rapport au par');
    expect(model.parLabel).toBe('Par 72');
  });

  it('writes under par with a real minus and even par as Au par', () => {
    expect(buildShareCardModel({ round: { ...round, total_score: 70 }, aggregate: null, halves: [] }).toParLabel)
      .toBe('−2 par rapport au par');
    expect(buildShareCardModel({ round: { ...round, total_score: 72 }, aggregate: null, halves: [] }).toParLabel)
      .toBe('Au par');
  });

  it('takes totals from the hole-by-hole data when there is some', () => {
    const model = buildShareCardModel({
      round: { ...round, total_score: 90, par: 70 },
      aggregate,
      halves: buildScorecardHalves(card(18), 18),
    });

    expect(model.totalScore).toBe(81);
    expect(model.parLabel).toBe('Par 72');
    expect(model.toParLabel).toBe('+9 par rapport au par');
    expect(model.rows).toHaveLength(2);
  });

  it('has no hole row without hole-by-hole data', () => {
    expect(buildShareCardModel({ round, aggregate: null, halves: [] }).rows).toEqual([]);
  });

  it('puts the date and the number of holes in the eyebrow', () => {
    const model = buildShareCardModel({ round, aggregate: null, halves: [] });

    expect(model.eyebrow).toBe('Samedi 3 octobre 2026 · 18 trous');
  });

  it('keeps only the holes when the date is invalid', () => {
    const model = buildShareCardModel({ round: { ...round, played_at: 'nope', holes: 9 }, aggregate: null, halves: [] });

    expect(model.eyebrow).toBe('9 trous');
  });

  it('trims the course name and falls back to Parcours', () => {
    expect(buildShareCardModel({ round: { ...round, course_name: '  Golf de Chantilly ' }, aggregate: null, halves: [] }).courseName)
      .toBe('Golf de Chantilly');
    expect(buildShareCardModel({ round: { ...round, course_name: '   ' }, aggregate: null, halves: [] }).courseName)
      .toBe('Parcours');
    expect(buildShareCardModel({ round: { ...round, course_name: null }, aggregate: null, halves: [] }).courseName)
      .toBe('Parcours');
  });

  it('carries nothing personal', () => {
    const storedRound = { ...round, user_id: 'u-1', notes: 'secret' };
    const model = buildShareCardModel({ round: storedRound, aggregate: null, halves: [] });

    expect(JSON.stringify(model)).not.toMatch(/u-1|secret/);
  });
});
