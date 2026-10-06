import type { FontVariant } from 'react-native';

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  display: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const Fonts = {
  serif: 'Newsreader_500Medium',
  serifSemiBold: 'Newsreader_600SemiBold',
  sans: 'HankenGrotesk_400Regular',
  sansMedium: 'HankenGrotesk_500Medium',
  sansSemiBold: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',
} as const;

export const Numerals = {
  fontVariant: ['lining-nums', 'tabular-nums'] as FontVariant[],
} as const;

export const Typography = {
  numeralXL: {
    fontFamily: Fonts.serif,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -1.4,
    fontVariant: Numerals.fontVariant,
  },
  display: { fontFamily: Fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -0.4 },
  title: { fontFamily: Fonts.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  titleMd: { fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, letterSpacing: -0.24 },
  heading: { fontFamily: Fonts.sansBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: Fonts.sansSemiBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.sansMedium, fontSize: 12, lineHeight: 16 },
} as const;

export const Shadows = {
  card: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  elevated: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;
