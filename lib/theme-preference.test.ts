import {
  THEME_PREFERENCES,
  THEME_PREFERENCE_KEY,
  isThemePreference,
  parseThemePreference,
  resolveColorScheme,
} from './theme-preference';

describe('resolveColorScheme', () => {
  it('follows the system when the preference is system', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  it('defaults to light when the system scheme is unknown', () => {
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
    expect(resolveColorScheme('system', 'unspecified')).toBe('light');
  });

  it('ignores the system when the user forces light', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('light', 'light')).toBe('light');
    expect(resolveColorScheme('light', null)).toBe('light');
  });

  it('ignores the system when the user forces dark', () => {
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('dark', 'dark')).toBe('dark');
    expect(resolveColorScheme('dark', null)).toBe('dark');
  });
});

describe('parseThemePreference', () => {
  it('accepts the three stored values', () => {
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('falls back to system for missing or corrupt values', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('DARK')).toBe('system');
    expect(parseThemePreference('{"mode":"dark"}')).toBe('system');
  });
});

describe('isThemePreference', () => {
  it('only accepts known preferences', () => {
    THEME_PREFERENCES.forEach((value) => expect(isThemePreference(value)).toBe(true));
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(1)).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('uses a namespaced storage key', () => {
    expect(THEME_PREFERENCE_KEY).toBe('fairwayiq:theme-preference');
  });
});
