import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultNotificationSettings,
  formatReminderTime,
  getWeekdayLong,
  isWeekday,
  parseNotificationSettings,
  sanitizeNotificationSettings,
} from './notification-settings';
import {
  getNotificationSettingsKey,
  loadNotificationSettings,
  saveNotificationSettings,
} from './notification-settings-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('defaults', () => {
  it('keeps the master switch off until the user opts in', () => {
    expect(defaultNotificationSettings().enabled).toBe(false);
  });

  it('plans the play reminder on Saturday 08:00 and the practice nudge on Wednesday 12:00', () => {
    const defaults = defaultNotificationSettings();

    expect(defaults.playReminder).toEqual({ enabled: true, weekday: 6, hour: 8 });
    expect(defaults.practiceReminder).toEqual({ enabled: true, weekday: 3, hour: 12 });
  });

  it('returns a fresh object every time', () => {
    const first = defaultNotificationSettings();
    first.playReminder.weekday = 1;

    expect(defaultNotificationSettings().playReminder.weekday).toBe(6);
  });
});

describe('sanitizeNotificationSettings', () => {
  it('keeps valid values', () => {
    const settings = {
      enabled: true,
      weeklyPlan: { enabled: false },
      playReminder: { enabled: true, weekday: 7, hour: 10 },
      streakAtRisk: { enabled: false },
      practiceReminder: { enabled: false, weekday: 2, hour: 18 },
    };

    expect(sanitizeNotificationSettings(settings)).toEqual(settings);
  });

  it('falls back field by field instead of dropping everything', () => {
    const result = sanitizeNotificationSettings({
      enabled: true,
      weeklyPlan: { enabled: 'yes' },
      playReminder: { enabled: false, weekday: 9, hour: 8.5 },
      streakAtRisk: null,
      practiceReminder: { weekday: 5, hour: 24 },
    });

    expect(result).toEqual({
      enabled: true,
      weeklyPlan: { enabled: true },
      playReminder: { enabled: false, weekday: 6, hour: 8 },
      streakAtRisk: { enabled: true },
      practiceReminder: { enabled: true, weekday: 5, hour: 12 },
    });
  });

  it('returns the defaults for anything that is not an object', () => {
    [null, undefined, 3, 'text', []].forEach((value) => {
      expect(sanitizeNotificationSettings(value)).toEqual(defaultNotificationSettings());
    });
  });

  it('drops unknown fields', () => {
    const result = sanitizeNotificationSettings({ enabled: true, pushToken: 'secret' });

    expect(result).not.toHaveProperty('pushToken');
  });
});

describe('isWeekday', () => {
  it('accepts 1 to 7 only', () => {
    [1, 2, 3, 4, 5, 6, 7].forEach((value) => expect(isWeekday(value)).toBe(true));
    [0, 8, 1.5, '3', null, undefined].forEach((value) => expect(isWeekday(value)).toBe(false));
  });
});

describe('labels', () => {
  it('formats times on two digits', () => {
    expect(formatReminderTime(8)).toBe('08:00');
    expect(formatReminderTime(18, 30)).toBe('18:30');
    expect(formatReminderTime(0)).toBe('00:00');
  });

  it('names the days in lowercase French', () => {
    expect(getWeekdayLong(1)).toBe('lundi');
    expect(getWeekdayLong(3)).toBe('mercredi');
    expect(getWeekdayLong(7)).toBe('dimanche');
  });
});

describe('parseNotificationSettings', () => {
  it('returns the defaults for missing or corrupt JSON', () => {
    expect(parseNotificationSettings(null)).toEqual(defaultNotificationSettings());
    expect(parseNotificationSettings('')).toEqual(defaultNotificationSettings());
    expect(parseNotificationSettings('{not json')).toEqual(defaultNotificationSettings());
  });

  it('reads stored JSON', () => {
    const stored = { ...defaultNotificationSettings(), enabled: true };

    expect(parseNotificationSettings(JSON.stringify(stored))).toEqual(stored);
  });
});

describe('storage', () => {
  it('uses a versioned, per-user key', () => {
    expect(getNotificationSettingsKey('user-1')).toBe('fairwayiq:notification-settings:v1:user-1');
  });

  it('round-trips the settings', async () => {
    const settings = {
      ...defaultNotificationSettings(),
      enabled: true,
      playReminder: { enabled: true, weekday: 7 as const, hour: 9 },
    };

    await saveNotificationSettings('user-1', settings);

    expect(await loadNotificationSettings('user-1')).toEqual(settings);
  });

  it('keeps users apart', async () => {
    await saveNotificationSettings('user-1', { ...defaultNotificationSettings(), enabled: true });

    expect((await loadNotificationSettings('user-2')).enabled).toBe(false);
  });

  it('returns the defaults when nothing was stored', async () => {
    expect(await loadNotificationSettings('user-1')).toEqual(defaultNotificationSettings());
  });

  it('returns the defaults when the stored value is corrupt', async () => {
    await AsyncStorage.setItem(getNotificationSettingsKey('user-1'), '{broken');

    expect(await loadNotificationSettings('user-1')).toEqual(defaultNotificationSettings());
  });

  it('returns the defaults when reading throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));

    expect(await loadNotificationSettings('user-1')).toEqual(defaultNotificationSettings());
  });

  it('does not throw when writing fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(saveNotificationSettings('user-1', defaultNotificationSettings())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
