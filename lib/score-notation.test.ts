import { SCORE_NOTATION_LABELS, getScoreNotation } from './score-notation';

describe('getScoreNotation', () => {
  it('returns par when strokes equal par', () => {
    expect(getScoreNotation(3, 3)).toBe('par');
    expect(getScoreNotation(4, 4)).toBe('par');
    expect(getScoreNotation(5, 5)).toBe('par');
  });

  it('returns birdie one under par', () => {
    expect(getScoreNotation(2, 3)).toBe('birdie');
    expect(getScoreNotation(3, 4)).toBe('birdie');
    expect(getScoreNotation(4, 5)).toBe('birdie');
  });

  it('returns eagle two under par', () => {
    expect(getScoreNotation(1, 3)).toBe('eagle');
    expect(getScoreNotation(2, 4)).toBe('eagle');
    expect(getScoreNotation(3, 5)).toBe('eagle');
  });

  it('keeps eagle for anything better than two under par', () => {
    expect(getScoreNotation(1, 4)).toBe('eagle');
    expect(getScoreNotation(2, 5)).toBe('eagle');
    expect(getScoreNotation(1, 5)).toBe('eagle');
  });

  it('returns bogey one over par', () => {
    expect(getScoreNotation(4, 3)).toBe('bogey');
    expect(getScoreNotation(5, 4)).toBe('bogey');
    expect(getScoreNotation(6, 5)).toBe('bogey');
  });

  it('returns double for two over par or worse', () => {
    expect(getScoreNotation(5, 3)).toBe('double');
    expect(getScoreNotation(6, 4)).toBe('double');
    expect(getScoreNotation(7, 5)).toBe('double');
    expect(getScoreNotation(9, 4)).toBe('double');
    expect(getScoreNotation(12, 3)).toBe('double');
  });

  it('draws no mark for invalid input', () => {
    expect(getScoreNotation(Number.NaN, 4)).toBe('par');
    expect(getScoreNotation(4, Number.NaN)).toBe('par');
    expect(getScoreNotation(Number.POSITIVE_INFINITY, 4)).toBe('par');
  });

  it('has a spoken label for every notation', () => {
    expect(Object.keys(SCORE_NOTATION_LABELS).sort()).toEqual(['birdie', 'bogey', 'double', 'eagle', 'par']);
  });
});
