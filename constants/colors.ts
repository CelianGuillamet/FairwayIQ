import { lightColors } from './theme';

/** @deprecated Static light palette kept for screens not yet migrated. Use `useTheme().colors` instead. */
export const Colors = {
  background: lightColors.bg,
  backgroundSoft: lightColors.bg,
  surface: lightColors.surface,
  surfaceElevated: lightColors.surface,
  surfaceAccent: lightColors.sunk,
  border: lightColors.line,
  borderStrong: lightColors.lineStrong,
  primary: lightColors.red,
  primaryDark: lightColors.red,
  primaryMuted: lightColors.redMuted,
  accentBlue: lightColors.ink2,
  accentBlueMuted: lightColors.sunk,
  text: lightColors.ink,
  textMuted: lightColors.ink2,
  textDim: lightColors.ink3,
  error: lightColors.error,
  warning: lightColors.warning,
  overlay: lightColors.overlay,
  white: '#ffffff',
  black: '#000000',
} as const;
