export const DEFAULT_TIME_ZONE = 'Europe/Paris';

export type CalendarDay = { year: number; month: number; day: number };
export type ZonedParts = CalendarDay & { hour: number; minute: number; second: number };

const MS_PER_DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    // Some engines print midnight as 24 with hour12: false.
    hour: values.hour % 24,
    minute: values.minute,
    second: values.second,
  };
}

function offsetAt(timestamp: number, timeZone: string) {
  const whole = Math.floor(timestamp / 1000) * 1000;
  const parts = getZonedParts(new Date(whole), timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - whole;
}

export function zonedTimeToDate(
  day: CalendarDay,
  time: { hour: number; minute: number },
  timeZone: string,
): Date {
  const wallClock = Date.UTC(day.year, day.month - 1, day.day, time.hour, time.minute);
  const firstGuess = wallClock - offsetAt(wallClock, timeZone);
  return new Date(wallClock - offsetAt(firstGuess, timeZone));
}

export function getZonedDay(date: Date, timeZone: string): CalendarDay {
  const { year, month, day } = getZonedParts(date, timeZone);
  return { year, month, day };
}

export function toEpochDay({ year, month, day }: CalendarDay): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function addCalendarDays(day: CalendarDay, amount: number): CalendarDay {
  const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day + amount));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function isoWeekday(day: CalendarDay): number {
  return ((new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay() + 6) % 7) + 1;
}

export function mondayEpochDay(day: CalendarDay): number {
  return toEpochDay(day) - (isoWeekday(day) - 1);
}
