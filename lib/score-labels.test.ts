import {
  describeStrokes,
  describeToPar,
  formatHolesPlayed,
  formatRemainingHoles,
  formatScoreToPar,
  getNotationWord,
  getRelativeLabel,
} from './score-labels';

describe('formatScoreToPar', () => {
  it('prefixes overs with a plus sign', () => {
    expect(formatScoreToPar(1)).toBe('+1');
    expect(formatScoreToPar(14)).toBe('+14');
  });

  it('uses a real minus sign under par', () => {
    expect(formatScoreToPar(-3)).toBe('−3');
  });

  it('shows E at par and for invalid input', () => {
    expect(formatScoreToPar(0)).toBe('E');
    expect(formatScoreToPar(Number.NaN)).toBe('E');
  });
});

describe('describeToPar', () => {
  it('speaks the distance to par', () => {
    expect(describeToPar(5)).toBe('5 au-dessus du par');
    expect(describeToPar(-2)).toBe('2 sous le par');
    expect(describeToPar(0)).toBe('à égalité avec le par');
  });
});

describe('formatHolesPlayed', () => {
  it('pluralises the holes played', () => {
    expect(formatHolesPlayed(7)).toBe('après 7 trous');
    expect(formatHolesPlayed(1)).toBe('après 1 trou');
  });

  it('says so when no hole was played', () => {
    expect(formatHolesPlayed(0)).toBe('aucun trou joué');
  });
});

describe('formatRemainingHoles', () => {
  it('pluralises the holes left to enter', () => {
    expect(formatRemainingHoles(3)).toBe('Il reste 3 trous à saisir');
    expect(formatRemainingHoles(1)).toBe('Il reste 1 trou à saisir');
  });
});

describe('getRelativeLabel', () => {
  it('matches the grid labels on a par 3', () => {
    expect([1, 2, 3, 4, 5, 6].map((strokes) => getRelativeLabel(strokes, 3))).toEqual([
      '−2',
      '−1',
      'par',
      '+1',
      '+2',
      '+3',
    ]);
  });

  it('shifts with the par', () => {
    expect([1, 2, 3, 4, 5, 6].map((strokes) => getRelativeLabel(strokes, 4))).toEqual([
      '',
      '−2',
      '−1',
      'par',
      '+1',
      '+2',
    ]);
    expect([1, 2, 3, 4, 5, 6].map((strokes) => getRelativeLabel(strokes, 5))).toEqual([
      '',
      '',
      '−2',
      '−1',
      'par',
      '+1',
    ]);
  });

  it('leaves the label empty outside the -2 to +3 window', () => {
    expect(getRelativeLabel(8, 4)).toBe('');
    expect(getRelativeLabel(1, 5)).toBe('');
  });

  it('is empty for invalid input', () => {
    expect(getRelativeLabel(Number.NaN, 4)).toBe('');
  });
});

describe('getNotationWord', () => {
  it('names the usual results', () => {
    expect(getNotationWord(3, 4)).toBe('Birdie');
    expect(getNotationWord(4, 4)).toBe('Par');
    expect(getNotationWord(5, 4)).toBe('Bogey');
    expect(getNotationWord(6, 4)).toBe('Double bogey');
  });

  it('keeps eagle for two under or better', () => {
    expect(getNotationWord(3, 5)).toBe('Eagle');
    expect(getNotationWord(2, 5)).toBe('Eagle');
  });

  it('falls back to the signed difference from three over', () => {
    expect(getNotationWord(7, 4)).toBe('+3');
    expect(getNotationWord(9, 4)).toBe('+5');
  });

  it('recognises a hole in one on any par', () => {
    expect(getNotationWord(1, 3)).toBe('Trou en un');
    expect(getNotationWord(1, 4)).toBe('Trou en un');
  });

  it('is empty for invalid input', () => {
    expect(getNotationWord(Number.NaN, 4)).toBe('');
  });
});

describe('describeStrokes', () => {
  it('reads the strokes with their notation', () => {
    expect(describeStrokes(2, 3)).toBe('2 coups, birdie');
    expect(describeStrokes(4, 4)).toBe('4 coups, par');
    expect(describeStrokes(6, 4)).toBe('6 coups, double bogey');
  });

  it('uses the singular for one stroke', () => {
    expect(describeStrokes(1, 3)).toBe('1 coup, trou en un');
  });

  it('spells out the distance to par from three over', () => {
    expect(describeStrokes(7, 4)).toBe('7 coups, 3 au-dessus du par');
  });
});
