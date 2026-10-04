import type { RoundAggregate } from '../../types';
import {
  buildRoundStats,
  buildRoundSubtitle,
  describeScoreToPar,
  formatRoundDate,
} from './round-summary';

const aggregate: RoundAggregate = {
  holes: 18,
  par: 72,
  total_score: 81,
  putts: 33,
  gir: 6,
  fairways_hit: 8,
  fairways_total: 14,
  penalties: 2,
  front_nine_score: 40,
  back_nine_score: 41,
  front_nine_to_par: 4,
  back_nine_to_par: 5,
  average_putts_per_hole: 1.8,
  gir_percentage: 33,
  fairway_percentage: 57,
  score_to_par: 9,
};

const legacyRound = {
  holes: 18 as const,
  putts: 36,
  gir: 4,
  fairways_hit: 7,
  fairways_total: 14,
  penalties: null,
};

describe('describeScoreToPar', () => {
  it('describes a score over, under and on par', () => {
    expect(describeScoreToPar(9)).toBe('+9 par rapport au par');
    expect(describeScoreToPar(-2)).toBe('−2 par rapport au par');
    expect(describeScoreToPar(0)).toBe('Au par');
  });
});

describe('formatRoundDate', () => {
  it('writes the date in French with a capital', () => {
    expect(formatRoundDate('2026-10-03T12:00:00.000Z')).toBe('Samedi 3 octobre 2026');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatRoundDate('not a date')).toBe('');
  });
});

describe('buildRoundSubtitle', () => {
  it('lists the holes and the tee', () => {
    expect(buildRoundSubtitle({ holes: 18, tee_name: 'Blanc' })).toBe('18 trous · départ Blanc');
  });

  it('omits a missing or blank tee', () => {
    expect(buildRoundSubtitle({ holes: 9, tee_name: null })).toBe('9 trous');
    expect(buildRoundSubtitle({ holes: 9, tee_name: '  ' })).toBe('9 trous');
  });
});

describe('buildRoundStats', () => {
  it('reads the live aggregate when the card is stored', () => {
    const stats = buildRoundStats({ ...legacyRound }, aggregate);

    expect(stats.map((stat) => [stat.key, stat.value, stat.suffix])).toEqual([
      ['fairways', '8', '/14'],
      ['gir', '6', '/18'],
      ['putts', '33', null],
      ['penalties', '2', null],
    ]);
  });

  it('gives each stat a spoken label with ratio and percentage', () => {
    const [fairways, gir, putts, penalties] = buildRoundStats({ ...legacyRound }, aggregate);

    expect(fairways.accessibilityLabel).toBe('Fairways : 8 sur 14, 57 %');
    expect(gir.accessibilityLabel).toBe('Greens en régulation : 6 sur 18, 33 %');
    expect(putts.accessibilityLabel).toBe('Putts : 33, 1,8 par trou');
    expect(penalties.accessibilityLabel).toBe('Pénalités : 2');
  });

  it('falls back to the round totals when there is no hole detail', () => {
    const [fairways, gir, putts, penalties] = buildRoundStats({ ...legacyRound }, null);

    expect([fairways.value, fairways.suffix]).toEqual(['7', '/14']);
    expect([gir.value, gir.suffix]).toEqual(['4', '/18']);
    expect(putts.value).toBe('36');
    expect(putts.accessibilityLabel).toBe('Putts : 36, 2 par trou');
    expect(penalties.value).toBe('0');
  });

  it('shows a dash when a figure was never recorded', () => {
    const stats = buildRoundStats(
      { holes: 9, putts: null, gir: null, fairways_hit: null, fairways_total: null, penalties: null },
      null,
    );

    expect(stats.map((stat) => stat.value)).toEqual(['–', '–', '–', '0']);
    expect(stats[0].suffix).toBeNull();
    expect(stats[0].accessibilityLabel).toBe('Fairways : non renseigné');
    expect(stats[2].accessibilityLabel).toBe('Putts : non renseigné');
  });

  it('shows a dash for fairways when the course has only par 3s', () => {
    const [fairways] = buildRoundStats(
      { ...legacyRound },
      { ...aggregate, fairways_hit: 0, fairways_total: 0, fairway_percentage: null },
    );

    expect(fairways.value).toBe('–');
  });

  it('keeps a recorded zero', () => {
    const [fairways, gir] = buildRoundStats({ ...legacyRound, gir: 0, fairways_hit: 0 }, null);

    expect([fairways.value, fairways.suffix]).toEqual(['0', '/14']);
    expect([gir.value, gir.suffix]).toEqual(['0', '/18']);
  });
});
