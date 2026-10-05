import {
  capitalizeFirst,
  describeScoreToPar,
  describeSparkline,
  formatDecimalFr,
  formatHandicapValue,
  formatHomeDate,
  formatRoundDay,
  formatRoundSubtitle,
  formatSignedFr,
  getFocusInsight,
  getSparklineTone,
  getSparklineValues,
  getTrendPill,
} from './home';
import type { Round } from '../types';

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round-1',
    user_id: 'user-1',
    played_at: '2026-10-03T10:00:00.000Z',
    course_id: null,
    course_name: 'Golf National',
    course_provider: null,
    provider_course_id: null,
    tee_key: null,
    tee_set_id: null,
    tee_name: null,
    tee_color: null,
    total_score: 81,
    par: 72,
    holes: 18,
    putts: null,
    gir: null,
    fairways_hit: null,
    fairways_total: null,
    penalties: null,
    notes: null,
    created_at: '2026-10-03T10:00:00.000Z',
    ...overrides,
  };
}

describe('formatDecimalFr', () => {
  it('uses a decimal comma', () => {
    expect(formatDecimalFr(14.2)).toBe('14,2');
  });

  it('drops a trailing zero decimal', () => {
    expect(formatDecimalFr(12)).toBe('12');
    expect(formatDecimalFr(12.04)).toBe('12');
  });

  it('rounds to the requested number of decimals', () => {
    expect(formatDecimalFr(2.345, 1)).toBe('2,3');
    expect(formatDecimalFr(2.345, 2)).toBe('2,35');
  });

  it('never returns a negative zero', () => {
    expect(formatDecimalFr(-0.04)).toBe('0');
  });
});

describe('formatSignedFr', () => {
  it('prefixes positives with a plus sign', () => {
    expect(formatSignedFr(9, 0)).toBe('+9');
    expect(formatSignedFr(12.3)).toBe('+12,3');
  });

  it('uses a typographic minus for negatives', () => {
    expect(formatSignedFr(-3, 0)).toBe('−3');
    expect(formatSignedFr(-0.6)).toBe('−0,6');
  });

  it('shows plain zero when the rounded value is zero', () => {
    expect(formatSignedFr(0)).toBe('0');
    expect(formatSignedFr(0.04)).toBe('0');
    expect(formatSignedFr(-0.04)).toBe('0');
  });
});

describe('formatHandicapValue', () => {
  it('converts the index to a decimal comma and leaves the placeholder alone', () => {
    expect(formatHandicapValue('14.2')).toBe('14,2');
    expect(formatHandicapValue('--')).toBe('--');
  });
});

describe('describeScoreToPar', () => {
  it('describes over, under and level with par', () => {
    expect(describeScoreToPar(9)).toBe('9 au-dessus du par');
    expect(describeScoreToPar(-2)).toBe('2 sous le par');
    expect(describeScoreToPar(0)).toBe('à égalité avec le par');
  });
});

describe('date formatting', () => {
  it('capitalizes the first letter only', () => {
    expect(capitalizeFirst('dimanche 4 octobre')).toBe('Dimanche 4 octobre');
    expect(capitalizeFirst('')).toBe('');
  });

  it('formats the home header date in French', () => {
    expect(formatHomeDate(new Date(2026, 9, 4, 9, 0))).toBe('Dimanche 4 octobre');
  });

  it('splits a round date into day, abbreviated month and long form', () => {
    expect(formatRoundDay(new Date(2026, 9, 3, 12, 0))).toEqual({ day: '3', month: 'oct.', long: '3 octobre 2026' });
    expect(formatRoundDay(new Date(2026, 8, 27, 12, 0)).month).toBe('sept.');
  });
});

describe('formatRoundSubtitle', () => {
  it('joins the tee and the number of holes', () => {
    expect(formatRoundSubtitle({ tee_name: 'Blanc', holes: 18 })).toBe('Départ Blanc · 18 trous');
  });

  it('shows stored English tee names in French', () => {
    expect(formatRoundSubtitle({ tee_name: 'Yellow', holes: 18 })).toBe('Départ Jaune · 18 trous');
    expect(formatRoundSubtitle({ tee_name: 'Championship', holes: 18 })).toBe('Départ Championship · 18 trous');
  });

  it('omits a missing or blank tee', () => {
    expect(formatRoundSubtitle({ tee_name: null, holes: 9 })).toBe('9 trous');
    expect(formatRoundSubtitle({ tee_name: '  ', holes: 18 })).toBe('18 trous');
  });
});

describe('getTrendPill', () => {
  it('has a neutral placeholder without a trend', () => {
    expect(getTrendPill(null)).toMatchObject({ tone: 'neutral', icon: null, label: 'Pas encore de tendance' });
  });

  it('flags a gain from 1.5 strokes with a downward arrow', () => {
    expect(getTrendPill({ holes: 18, delta: 2.3 })).toMatchObject({
      tone: 'good',
      icon: 'arrow-down',
      label: '2,3 coups de mieux',
    });
    expect(getTrendPill({ holes: 18, delta: 1.5 }).tone).toBe('good');
  });

  it('flags a loss from 1.5 strokes with a warning tone', () => {
    expect(getTrendPill({ holes: 18, delta: -4 })).toMatchObject({
      tone: 'warn',
      icon: 'arrow-up',
      label: '4 coups de plus',
    });
  });

  it('calls anything between the thresholds stable', () => {
    expect(getTrendPill({ holes: 18, delta: 1.4 })).toMatchObject({ tone: 'neutral', icon: 'minus', label: 'Tendance stable' });
    expect(getTrendPill({ holes: 18, delta: -1.4 }).tone).toBe('neutral');
  });

  it('notes 9-hole trends', () => {
    expect(getTrendPill({ holes: 9, delta: 2 }).label).toBe('2 coups de mieux (9 trous)');
  });
});

describe('getSparklineValues', () => {
  it('returns the most recent rounds in chronological order', () => {
    const rounds = [90, 88, 86, 84].map((total, index) => makeRound({ id: `r${index}`, total_score: total }));

    expect(getSparklineValues(rounds)).toEqual([12, 14, 16, 18]);
  });

  it('caps the series length', () => {
    const rounds = Array.from({ length: 12 }, (_, index) => makeRound({ id: `r${index}`, total_score: 80 + index }));

    expect(getSparklineValues(rounds)).toHaveLength(8);
    expect(getSparklineValues(rounds, 3)).toEqual([10, 9, 8]);
  });

  it('normalizes 9-hole rounds to 18 holes', () => {
    expect(getSparklineValues([makeRound({ holes: 9, par: 36, total_score: 41 })])).toEqual([10]);
  });

  it('is empty without rounds', () => {
    expect(getSparklineValues([])).toEqual([]);
  });
});

describe('describeSparkline', () => {
  it('describes the first and last value', () => {
    expect(describeSparkline([14, 12, 13, 9])).toBe('Score par rapport au par sur les 4 derniers rounds, de +14 à +9');
  });

  it('is empty below two values', () => {
    expect(describeSparkline([14])).toBe('');
  });
});

describe('getSparklineTone', () => {
  it('is good when the last round is at or below the first', () => {
    expect(getSparklineTone([14, 12, 9])).toBe('good');
    expect(getSparklineTone([10, 12, 10])).toBe('good');
  });

  it('is neutral when the series gets worse or is too short', () => {
    expect(getSparklineTone([9, 12, 14])).toBe('neutral');
    expect(getSparklineTone([9])).toBe('neutral');
  });
});

describe('getFocusInsight', () => {
  it('asks for a first round without rounds', () => {
    expect(getFocusInsight([])).toMatchObject({ actionLabel: 'Saisir un round', actionRoute: '/(tabs)/round' });
  });

  it('points to the exercises when the latest round has two penalties or more', () => {
    expect(getFocusInsight([makeRound({ penalties: 2 })])).toMatchObject({
      title: 'Le score fuit sur les coups donnés',
      actionLabel: 'Voir les exercices',
      actionRoute: '/(tabs)/drills',
    });
  });

  it('points to putting above two putts per hole', () => {
    expect(getFocusInsight([makeRound({ putts: 38 })]).title).toBe('Le putting reste le gain le plus rapide');
  });

  it('points to approaches below 33 percent of greens in regulation', () => {
    expect(getFocusInsight([makeRound({ putts: 30, gir: 4 })]).title).toBe('Les approches freinent le scoring');
  });

  it('points to tee shots below 50 percent of fairways', () => {
    expect(getFocusInsight([makeRound({ putts: 30, gir: 8, fairways_hit: 5, fairways_total: 14 })]).title).toBe(
      'Les mises en jeu rendent les trous trop défensifs',
    );
  });

  it('falls back to a balanced profile and asks for another round', () => {
    expect(getFocusInsight([makeRound({ putts: 30, gir: 8, fairways_hit: 9, fairways_total: 14 })])).toMatchObject({
      title: 'Profil équilibré, cap sur la répétabilité',
      actionLabel: 'Analyser un round',
      actionRoute: '/(tabs)/round',
    });
  });

  it('only looks at the latest round', () => {
    const rounds = [makeRound({ id: 'new', putts: 30, gir: 8 }), makeRound({ id: 'old', penalties: 5 })];

    expect(getFocusInsight(rounds).title).toBe('Profil équilibré, cap sur la répétabilité');
  });
});
