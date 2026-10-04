import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeColors, type ColorScheme, type ThemeColors } from '../constants/theme';
import {
  THEME_PREFERENCE_KEY,
  isThemePreference,
  parseThemePreference,
  resolveColorScheme,
  type ThemePreference,
} from './theme-preference';

export type Theme = {
  colors: ThemeColors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (active) setPreferenceState(parseThemePreference(raw));
      } catch {
        // An unreadable preference falls back to following the system.
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // react-native-web has no setColorScheme.
    if (typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(preference === 'system' ? null : preference);
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    if (!isThemePreference(next)) return;
    setPreferenceState(next);
    void (async () => {
      try {
        await AsyncStorage.setItem(THEME_PREFERENCE_KEY, next);
      } catch {
        // The choice still applies for this session when it cannot be saved.
      }
    })();
  }, []);

  const scheme = resolveColorScheme(preference, systemScheme);

  const value = useMemo<Theme>(
    () => ({ colors: themeColors[scheme], scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  }
  return theme;
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
