export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  bg: string;
  surface: string;
  sunk: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  green: string;
  greenBg: string;
  red: string;
  redMuted: string;
  onRed: string;
  onInk: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  overlay: string;
};

export const lightColors: ThemeColors = {
  bg: '#F5F6F1',
  surface: '#FFFFFF',
  sunk: '#E9ECE3',
  ink: '#101A14',
  ink2: '#47554B',
  ink3: '#647167',
  line: '#D8DDD2',
  lineStrong: '#B4BEB0',
  green: '#1F6B45',
  greenBg: '#DCEBE0',
  red: '#D8392B',
  redMuted: 'rgba(216, 57, 43, 0.12)',
  onRed: '#FFFFFF',
  onInk: '#F5F6F1',
  warning: '#8A5700',
  warningBg: '#FBEFD0',
  error: '#B42318',
  errorBg: '#FBE4E1',
  overlay: 'rgba(16, 26, 20, 0.5)',
};

export const darkColors: ThemeColors = {
  bg: '#0B120E',
  surface: '#131D17',
  sunk: '#070C09',
  ink: '#EEF2EB',
  ink2: '#B0BCB3',
  ink3: '#86938A',
  line: '#223028',
  lineStrong: '#35473C',
  green: '#5BC48C',
  greenBg: '#16301F',
  red: '#D8392B',
  redMuted: 'rgba(216, 57, 43, 0.12)',
  onRed: '#FFFFFF',
  onInk: '#0B120E',
  warning: '#E8B84A',
  warningBg: '#2E2410',
  error: '#FF8F80',
  errorBg: '#3A1814',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
