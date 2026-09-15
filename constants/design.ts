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
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 14,
  full: 999,
} as const;

export const Typography = {
  display: { fontSize: 40, lineHeight: 42, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  titleMd: { fontSize: 22, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 23, fontWeight: '700' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export const Shadows = {
  card: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 2,
  },
  elevated: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;
