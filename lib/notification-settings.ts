export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReminderToggle = { enabled: boolean };
export type ScheduledReminder = ReminderToggle & { weekday: Weekday; hour: number };

export type NotificationSettings = {
  enabled: boolean;
  weeklyPlan: ReminderToggle;
  playReminder: ScheduledReminder;
  streakAtRisk: ReminderToggle;
  practiceReminder: ScheduledReminder;
};

export type ReminderKey = Exclude<keyof NotificationSettings, 'enabled'>;

export const REMINDER_KEYS: readonly ReminderKey[] = [
  'weeklyPlan',
  'playReminder',
  'streakAtRisk',
  'practiceReminder',
];

export const WEEKDAYS: readonly { value: Weekday; short: string; long: string }[] = [
  { value: 1, short: 'Lun', long: 'lundi' },
  { value: 2, short: 'Mar', long: 'mardi' },
  { value: 3, short: 'Mer', long: 'mercredi' },
  { value: 4, short: 'Jeu', long: 'jeudi' },
  { value: 5, short: 'Ven', long: 'vendredi' },
  { value: 6, short: 'Sam', long: 'samedi' },
  { value: 7, short: 'Dim', long: 'dimanche' },
];

export const PLAY_HOUR_OPTIONS: readonly number[] = [7, 8, 9, 10];
export const PRACTICE_HOUR_OPTIONS: readonly number[] = [12, 18, 20];

export function defaultNotificationSettings(): NotificationSettings {
  return {
    enabled: false,
    weeklyPlan: { enabled: true },
    playReminder: { enabled: true, weekday: 6, hour: 8 },
    streakAtRisk: { enabled: true },
    practiceReminder: { enabled: true, weekday: 3, hour: 12 },
  };
}

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function isHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readToggle(value: unknown, fallback: ReminderToggle): ReminderToggle {
  const { enabled } = asRecord(value);
  return { enabled: typeof enabled === 'boolean' ? enabled : fallback.enabled };
}

function readScheduled(value: unknown, fallback: ScheduledReminder): ScheduledReminder {
  const { weekday, hour } = asRecord(value);
  return {
    ...readToggle(value, fallback),
    weekday: isWeekday(weekday) ? weekday : fallback.weekday,
    hour: isHour(hour) ? hour : fallback.hour,
  };
}

export function sanitizeNotificationSettings(value: unknown): NotificationSettings {
  const defaults = defaultNotificationSettings();
  const source = asRecord(value);

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled,
    weeklyPlan: readToggle(source.weeklyPlan, defaults.weeklyPlan),
    playReminder: readScheduled(source.playReminder, defaults.playReminder),
    streakAtRisk: readToggle(source.streakAtRisk, defaults.streakAtRisk),
    practiceReminder: readScheduled(source.practiceReminder, defaults.practiceReminder),
  };
}

export function parseNotificationSettings(raw: string | null | undefined): NotificationSettings {
  if (!raw) return defaultNotificationSettings();

  try {
    return sanitizeNotificationSettings(JSON.parse(raw));
  } catch {
    return defaultNotificationSettings();
  }
}

export function formatReminderTime(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getWeekdayLong(weekday: Weekday): string {
  return WEEKDAYS.find((item) => item.value === weekday)?.long ?? '';
}
