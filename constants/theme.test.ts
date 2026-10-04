import { Colors } from './colors';
import { Fonts } from './design';
import { darkColors, lightColors, themeColors, type ThemeColors } from './theme';
import { fontAssets } from '../lib/fonts';

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const TEXT_PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink2', 'bg'],
  ['ink2', 'surface'],
  ['ink2', 'sunk'],
  ['ink3', 'bg'],
  ['ink3', 'surface'],
  ['onRed', 'red'],
  ['onInk', 'ink'],
  ['green', 'greenBg'],
  ['green', 'bg'],
  ['green', 'surface'],
  ['warning', 'warningBg'],
  ['error', 'errorBg'],
  ['error', 'bg'],
  ['error', 'surface'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s palette contrast', (_scheme, palette) => {
  it.each(TEXT_PAIRS)('%s on %s reaches 4.5:1', (foreground, background) => {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('palette shape', () => {
  it('defines the same keys in both schemes', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    expect(themeColors.light).toBe(lightColors);
    expect(themeColors.dark).toBe(darkColors);
  });

  it('keeps the brand red identical in both schemes', () => {
    expect(darkColors.red).toBe(lightColors.red);
    expect(darkColors.onRed).toBe(lightColors.onRed);
  });
});

describe('legacy Colors', () => {
  it('maps the old names onto the light palette', () => {
    expect(Colors.background).toBe(lightColors.bg);
    expect(Colors.backgroundSoft).toBe(lightColors.bg);
    expect(Colors.surface).toBe(lightColors.surface);
    expect(Colors.surfaceElevated).toBe(lightColors.surface);
    expect(Colors.surfaceAccent).toBe(lightColors.sunk);
    expect(Colors.border).toBe(lightColors.line);
    expect(Colors.borderStrong).toBe(lightColors.lineStrong);
    expect(Colors.primary).toBe(lightColors.red);
    expect(Colors.primaryDark).toBe(lightColors.red);
    expect(Colors.primaryMuted).toBe(lightColors.redMuted);
    expect(Colors.accentBlue).toBe(lightColors.ink2);
    expect(Colors.accentBlueMuted).toBe(lightColors.sunk);
    expect(Colors.text).toBe(lightColors.ink);
    expect(Colors.textMuted).toBe(lightColors.ink2);
    expect(Colors.textDim).toBe(lightColors.ink3);
    expect(Colors.error).toBe(lightColors.error);
    expect(Colors.warning).toBe(lightColors.warning);
    expect(Colors.overlay).toBe(lightColors.overlay);
  });
});

describe('fonts', () => {
  it('loads every font family the type scale refers to', () => {
    Object.values(Fonts).forEach((family) => {
      expect(Object.keys(fontAssets)).toContain(family);
    });
  });
});
