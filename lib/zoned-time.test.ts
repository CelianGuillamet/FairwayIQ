import {
  DEFAULT_TIME_ZONE,
  addCalendarDays,
  getDeviceTimeZone,
  getZonedDay,
  getZonedParts,
  isoWeekday,
  mondayEpochDay,
  toEpochDay,
  zonedTimeToDate,
} from './zoned-time';

const PARIS = 'Europe/Paris';

describe('getZonedParts', () => {
  it('reads the wall clock in the requested zone', () => {
    expect(getZonedParts(new Date('2026-10-05T10:00:00Z'), PARIS)).toEqual({
      year: 2026,
      month: 10,
      day: 5,
      hour: 12,
      minute: 0,
      second: 0,
    });
    expect(getZonedParts(new Date('2026-01-15T10:00:00Z'), PARIS).hour).toBe(11);
  });

  it('prints midnight as hour 0 and rolls the date over', () => {
    const parts = getZonedParts(new Date('2026-10-04T22:00:00Z'), PARIS);

    expect(parts).toMatchObject({ year: 2026, month: 10, day: 5, hour: 0, minute: 0 });
  });

  it('gives a different calendar day in another zone', () => {
    const instant = new Date('2026-10-05T22:30:00Z');

    expect(getZonedDay(instant, PARIS)).toEqual({ year: 2026, month: 10, day: 6 });
    expect(getZonedDay(instant, 'America/New_York')).toEqual({ year: 2026, month: 10, day: 5 });
  });
});

describe('zonedTimeToDate', () => {
  it('converts summer time (UTC+2)', () => {
    const date = zonedTimeToDate({ year: 2026, month: 10, day: 7 }, { hour: 12, minute: 0 }, PARIS);

    expect(date.toISOString()).toBe('2026-10-07T10:00:00.000Z');
  });

  it('converts winter time (UTC+1)', () => {
    const date = zonedTimeToDate({ year: 2026, month: 1, day: 14 }, { hour: 18, minute: 30 }, PARIS);

    expect(date.toISOString()).toBe('2026-01-14T17:30:00.000Z');
  });

  it('uses the offset of the target day when the clocks change in between', () => {
    const afterFallBack = zonedTimeToDate({ year: 2026, month: 10, day: 25 }, { hour: 18, minute: 30 }, PARIS);
    const afterSpringForward = zonedTimeToDate({ year: 2026, month: 3, day: 29 }, { hour: 18, minute: 30 }, PARIS);

    expect(afterFallBack.toISOString()).toBe('2026-10-25T17:30:00.000Z');
    expect(afterSpringForward.toISOString()).toBe('2026-03-29T16:30:00.000Z');
  });

  it('round-trips through getZonedParts', () => {
    const date = zonedTimeToDate({ year: 2026, month: 12, day: 31 }, { hour: 23, minute: 45 }, PARIS);

    expect(getZonedParts(date, PARIS)).toMatchObject({ year: 2026, month: 12, day: 31, hour: 23, minute: 45 });
  });

  it('works for zones west of UTC', () => {
    const date = zonedTimeToDate({ year: 2026, month: 10, day: 6 }, { hour: 18, minute: 30 }, 'America/New_York');

    expect(date.toISOString()).toBe('2026-10-06T22:30:00.000Z');
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addCalendarDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
    expect(addCalendarDays({ year: 2026, month: 3, day: 3 }, -3)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(addCalendarDays({ year: 2026, month: 10, day: 5 }, 7)).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('numbers weekdays from Monday = 1 to Sunday = 7', () => {
    expect(isoWeekday({ year: 2026, month: 10, day: 5 })).toBe(1);
    expect(isoWeekday({ year: 2026, month: 10, day: 7 })).toBe(3);
    expect(isoWeekday({ year: 2026, month: 10, day: 10 })).toBe(6);
    expect(isoWeekday({ year: 2026, month: 10, day: 11 })).toBe(7);
  });

  it('puts Sunday in the week that started on the previous Monday', () => {
    const sunday = { year: 2026, month: 10, day: 4 };
    const monday = { year: 2026, month: 10, day: 5 };
    const nextSunday = { year: 2026, month: 10, day: 11 };

    expect(mondayEpochDay(sunday)).toBe(toEpochDay({ year: 2026, month: 9, day: 28 }));
    expect(mondayEpochDay(monday)).toBe(toEpochDay(monday));
    expect(mondayEpochDay(nextSunday)).toBe(mondayEpochDay(monday));
    expect(mondayEpochDay(sunday)).not.toBe(mondayEpochDay(monday));
  });

  it('counts epoch days consistently across a DST change', () => {
    expect(toEpochDay({ year: 2026, month: 10, day: 26 }) - toEpochDay({ year: 2026, month: 10, day: 24 })).toBe(2);
  });
});

describe('getDeviceTimeZone', () => {
  it('returns a usable IANA zone', () => {
    const zone = getDeviceTimeZone();

    expect(zone.length).toBeGreaterThan(0);
    expect(() => getZonedParts(new Date(), zone)).not.toThrow();
  });

  it('defaults to Paris', () => {
    expect(DEFAULT_TIME_ZONE).toBe('Europe/Paris');
  });
});
