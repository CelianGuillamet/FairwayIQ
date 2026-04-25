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
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 30,
  full: 999,
} as const;

export const Typography = {
  display: { fontSize: 38, lineHeight: 42, fontWeight: '900' as const },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900' as const },
  titleMd: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '800' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '700' as const },
} as const;

export const Shadows = {
  card: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 4,
  },
  elevated: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 6,
  },
} as const;
