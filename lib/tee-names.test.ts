import { formatTeeName } from './tee-names';

describe('formatTeeName', () => {
  it.each([
    ['Back', 'Noir'],
    ['White', 'Blanc'],
    ['Yellow', 'Jaune'],
    ['Blue', 'Bleu'],
    ['Red', 'Rouge'],
    ['Black', 'Noir'],
    ['Gold', 'Or'],
    ['Green', 'Vert'],
    ['Orange', 'Orange'],
  ])('translates %s to %s', (english, french) => {
    expect(formatTeeName(english)).toBe(french);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(formatTeeName('WHITE')).toBe('Blanc');
    expect(formatTeeName('  yellow ')).toBe('Jaune');
    expect(formatTeeName('gOlD')).toBe('Or');
  });

  it('normalises French names, with or without accents or capitals', () => {
    expect(formatTeeName('blanc')).toBe('Blanc');
    expect(formatTeeName('NOIR')).toBe('Noir');
    expect(formatTeeName('Vért')).toBe('Vert');
    expect(formatTeeName('Ôr')).toBe('Or');
  });

  it('keeps unknown names untouched', () => {
    expect(formatTeeName('Championship')).toBe('Championship');
    expect(formatTeeName('Blue / White')).toBe('Blue / White');
    expect(formatTeeName(' Forward ')).toBe(' Forward ');
  });

  it('returns an empty string for missing names', () => {
    expect(formatTeeName(null)).toBe('');
    expect(formatTeeName(undefined)).toBe('');
    expect(formatTeeName('')).toBe('');
  });
});
