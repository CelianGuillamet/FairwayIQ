import { defaultNotificationSettings, REMINDER_KEYS, type NotificationSettings } from './notification-settings';
import {
  NOTIFICATION_IDS,
  NOTIFICATION_ID_PREFIX,
  planNotifications,
  type NotificationPlan,
  type PlanContext,
  type PlannedNotification,
} from './notification-plan';

const PARIS = 'Europe/Paris';
const NEW_YORK = 'America/New_York';

function settingsWith(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return { ...defaultNotificationSettings(), enabled: true, ...overrides };
}

function context(overrides: Partial<PlanContext> = {}): PlanContext {
  return {
    streak: 0,
    lastDrillAt: null,
    now: new Date('2026-10-05T05:00:00Z'),
    timeZone: PARIS,
    ...overrides,
  };
}

function find(plan: NotificationPlan, id: string): PlannedNotification | undefined {
  return plan.schedule.find((item) => item.identifier === id);
}

function dateOf(item: PlannedNotification | undefined): string | null {
  return item && item.trigger.type === 'date' ? item.trigger.date.toISOString() : null;
}

function streakDate(settings: NotificationSettings, ctx: Partial<PlanContext>) {
  return dateOf(find(planNotifications(settings, context(ctx)), NOTIFICATION_IDS.streakAtRisk));
}

function practiceDate(settings: NotificationSettings, ctx: Partial<PlanContext>) {
  return dateOf(find(planNotifications(settings, context(ctx)), NOTIFICATION_IDS.practiceReminder));
}

describe('identifiers', () => {
  it('gives every reminder its own namespaced identifier', () => {
    const ids = REMINDER_KEYS.map((key) => NOTIFICATION_IDS[key]);

    expect(new Set(ids).size).toBe(REMINDER_KEYS.length);
    ids.forEach((id) => expect(id.startsWith(NOTIFICATION_ID_PREFIX)).toBe(true));
  });
});

describe('master switch and toggles', () => {
  it('cancels every reminder and schedules nothing while the master switch is off', () => {
    const plan = planNotifications(
      { ...settingsWith(), enabled: false },
      context({ streak: 5, lastDrillAt: '2026-10-04T10:00:00Z' }),
    );

    expect(plan.schedule).toEqual([]);
    expect(plan.cancel).toEqual(REMINDER_KEYS.map((key) => NOTIFICATION_IDS[key]));
  });

  it('schedules all four reminders once the master switch is on', () => {
    const plan = planNotifications(settingsWith(), context({ streak: 3, lastDrillAt: '2026-10-04T10:00:00Z' }));

    expect(plan.schedule.map((item) => item.kind)).toEqual([
      'weeklyPlan',
      'playReminder',
      'streakAtRisk',
      'practiceReminder',
    ]);
    expect(plan.cancel).toEqual([]);
  });

  it.each(REMINDER_KEYS)('turning off %s cancels only that reminder', (key) => {
    const settings = settingsWith();
    const disabled = { ...settings, [key]: { ...settings[key], enabled: false } } as NotificationSettings;

    const plan = planNotifications(disabled, context({ streak: 3, lastDrillAt: '2026-10-04T10:00:00Z' }));

    expect(plan.cancel).toEqual([NOTIFICATION_IDS[key]]);
    expect(plan.schedule.map((item) => item.kind)).toEqual(REMINDER_KEYS.filter((other) => other !== key));
  });

  it('accounts for every reminder exactly once', () => {
    const plan = planNotifications(settingsWith(), context({ streak: 0 }));
    const accounted = [...plan.schedule.map((item) => item.identifier), ...plan.cancel].sort();

    expect(accounted).toEqual(REMINDER_KEYS.map((key) => NOTIFICATION_IDS[key]).sort());
  });
});

describe('weekly plan', () => {
  it('repeats on Monday at 08:00', () => {
    const plan = planNotifications(settingsWith(), context());

    expect(find(plan, NOTIFICATION_IDS.weeklyPlan)).toMatchObject({
      title: 'Ton plan de la semaine est prêt',
      data: { type: 'weekly_plan' },
      trigger: { type: 'weekly', weekday: 1, hour: 8, minute: 0 },
    });
  });

  it('does not depend on the current time', () => {
    const early = find(planNotifications(settingsWith(), context({ now: new Date('2026-10-05T04:00:00Z') })), NOTIFICATION_IDS.weeklyPlan);
    const late = find(planNotifications(settingsWith(), context({ now: new Date('2026-10-09T20:00:00Z') })), NOTIFICATION_IDS.weeklyPlan);

    expect(late?.trigger).toEqual(early?.trigger);
  });
});

describe('play reminder', () => {
  it('repeats on Saturday at 08:00 by default', () => {
    const plan = planNotifications(settingsWith(), context());

    expect(find(plan, NOTIFICATION_IDS.playReminder)).toMatchObject({
      data: { type: 'play_reminder' },
      trigger: { type: 'weekly', weekday: 6, hour: 8, minute: 0 },
    });
  });

  it('follows the chosen day and hour', () => {
    const settings = settingsWith({ playReminder: { enabled: true, weekday: 7, hour: 9 } });

    expect(find(planNotifications(settings, context()), NOTIFICATION_IDS.playReminder)?.trigger).toEqual({
      type: 'weekly',
      weekday: 7,
      hour: 9,
      minute: 0,
    });
  });
});

describe('streak at risk', () => {
  const settings = settingsWith();

  it.each([
    [0, false],
    [1, false],
    [2, true],
    [3, true],
    [30, true],
    [-1, false],
    [Number.NaN, false],
  ])('with a streak of %s the reminder is planned: %s', (streak, planned) => {
    const plan = planNotifications(settings, context({ streak, now: new Date('2026-10-05T10:00:00Z') }));

    expect(Boolean(find(plan, NOTIFICATION_IDS.streakAtRisk))).toBe(planned);
    expect(plan.cancel.includes(NOTIFICATION_IDS.streakAtRisk)).toBe(!planned);
  });

  it('fires today at 18:30 when nothing was done yet today', () => {
    expect(
      streakDate(settings, {
        streak: 3,
        lastDrillAt: '2026-10-04T10:00:00Z',
        now: new Date('2026-10-05T10:00:00Z'),
      }),
    ).toBe('2026-10-05T16:30:00.000Z');
  });

  it('still plans today when there is no completion date at all', () => {
    expect(streakDate(settings, { streak: 2, lastDrillAt: null, now: new Date('2026-10-05T10:00:00Z') })).toBe(
      '2026-10-05T16:30:00.000Z',
    );
  });

  it('never schedules in the past: 18:30 already gone means no reminder', () => {
    const plan = planNotifications(
      settings,
      context({ streak: 3, lastDrillAt: '2026-10-04T10:00:00Z', now: new Date('2026-10-05T17:00:00Z') }),
    );

    expect(find(plan, NOTIFICATION_IDS.streakAtRisk)).toBeUndefined();
    expect(plan.cancel).toContain(NOTIFICATION_IDS.streakAtRisk);
  });

  it('treats 18:30:00.000 itself as past and the millisecond before as future', () => {
    const base = { streak: 3, lastDrillAt: '2026-10-04T10:00:00Z' };

    expect(streakDate(settings, { ...base, now: new Date('2026-10-05T16:30:00.000Z') })).toBeNull();
    expect(streakDate(settings, { ...base, now: new Date('2026-10-05T16:29:59.999Z') })).toBe(
      '2026-10-05T16:30:00.000Z',
    );
  });

  it('moves to tomorrow 18:30 once a drill is done today, replacing today’s reminder', () => {
    const plan = planNotifications(
      settings,
      context({ streak: 3, lastDrillAt: '2026-10-05T09:00:00Z', now: new Date('2026-10-05T09:05:00Z') }),
    );

    expect(dateOf(find(plan, NOTIFICATION_IDS.streakAtRisk))).toBe('2026-10-06T16:30:00.000Z');
  });

  it('plans tomorrow even when the drill is done after 18:30', () => {
    expect(
      streakDate(settings, {
        streak: 4,
        lastDrillAt: '2026-10-05T19:00:00Z',
        now: new Date('2026-10-05T19:05:00Z'),
      }),
    ).toBe('2026-10-06T16:30:00.000Z');
  });

  it('does not plan tomorrow when completing a drill left the streak below 2', () => {
    const plan = planNotifications(
      settings,
      context({ streak: 1, lastDrillAt: '2026-10-05T09:00:00Z', now: new Date('2026-10-05T09:05:00Z') }),
    );

    expect(find(plan, NOTIFICATION_IDS.streakAtRisk)).toBeUndefined();
  });

  it('accepts the completion date as a Date', () => {
    expect(
      streakDate(settings, {
        streak: 3,
        lastDrillAt: new Date('2026-10-05T09:00:00Z'),
        now: new Date('2026-10-05T10:00:00Z'),
      }),
    ).toBe('2026-10-06T16:30:00.000Z');
  });

  it('ignores an unreadable completion date', () => {
    expect(
      streakDate(settings, { streak: 3, lastDrillAt: 'not-a-date', now: new Date('2026-10-05T10:00:00Z') }),
    ).toBe('2026-10-05T16:30:00.000Z');
  });

  it('counts a drill done just after midnight Paris time as today, not yesterday', () => {
    expect(
      streakDate(settings, {
        streak: 3,
        lastDrillAt: '2026-10-04T22:10:00Z',
        now: new Date('2026-10-05T08:00:00Z'),
      }),
    ).toBe('2026-10-06T16:30:00.000Z');
  });

  it('counts a drill done just before midnight Paris time as yesterday', () => {
    expect(
      streakDate(settings, {
        streak: 3,
        lastDrillAt: '2026-10-05T21:50:00Z',
        now: new Date('2026-10-05T22:30:00Z'),
      }),
    ).toBe('2026-10-06T16:30:00.000Z');
  });

  it('uses the time zone it is given to decide what today is', () => {
    const input = {
      streak: 3,
      lastDrillAt: '2026-10-05T21:00:00Z',
      now: new Date('2026-10-05T22:30:00Z'),
    };

    expect(streakDate(settings, { ...input, timeZone: PARIS })).toBe('2026-10-06T16:30:00.000Z');
    expect(streakDate(settings, { ...input, timeZone: NEW_YORK })).toBe('2026-10-06T22:30:00.000Z');
  });

  it('keeps 18:30 local time across the end of daylight saving time', () => {
    expect(
      streakDate(settings, {
        streak: 3,
        lastDrillAt: '2026-10-24T09:00:00Z',
        now: new Date('2026-10-24T10:00:00Z'),
      }),
    ).toBe('2026-10-25T17:30:00.000Z');
  });

  it('keeps 18:30 local time across the start of daylight saving time', () => {
    expect(
      streakDate(settings, {
        streak: 3,
        lastDrillAt: '2026-03-28T10:00:00Z',
        now: new Date('2026-03-28T11:00:00Z'),
      }),
    ).toBe('2026-03-29T16:30:00.000Z');
  });

  it('carries the streak length in the copy', () => {
    const plan = planNotifications(
      settings,
      context({ streak: 7, now: new Date('2026-10-05T10:00:00Z') }),
    );

    expect(find(plan, NOTIFICATION_IDS.streakAtRisk)).toMatchObject({
      title: 'Série de 7 jours en cours',
      data: { type: 'streak_at_risk' },
    });
  });
});

describe('practice reminder', () => {
  const settings = settingsWith();

  it('targets Wednesday 12:00 of the current week by default', () => {
    expect(practiceDate(settings, { now: new Date('2026-10-05T05:00:00Z') })).toBe('2026-10-07T10:00:00.000Z');
  });

  it('plans the same day when the hour has not come yet', () => {
    expect(practiceDate(settings, { now: new Date('2026-10-07T09:59:00Z') })).toBe('2026-10-07T10:00:00.000Z');
  });

  it('never schedules in the past: the hour just passed rolls to next week', () => {
    expect(practiceDate(settings, { now: new Date('2026-10-07T10:00:00.000Z') })).toBe('2026-10-14T10:00:00.000Z');
    expect(practiceDate(settings, { now: new Date('2026-10-07T10:01:00Z') })).toBe('2026-10-14T10:00:00.000Z');
    expect(practiceDate(settings, { now: new Date('2026-10-09T08:00:00Z') })).toBe('2026-10-14T10:00:00.000Z');
  });

  it('skips this week when a drill was already done this week', () => {
    expect(
      practiceDate(settings, {
        now: new Date('2026-10-05T18:00:00Z'),
        lastDrillAt: '2026-10-05T16:00:00Z',
      }),
    ).toBe('2026-10-14T10:00:00.000Z');
  });

  it('skips this week when the drill was done on the reminder day itself', () => {
    expect(
      practiceDate(settings, {
        now: new Date('2026-10-07T07:00:00Z'),
        lastDrillAt: '2026-10-07T06:00:00Z',
      }),
    ).toBe('2026-10-14T10:00:00.000Z');
  });

  it('does not skip when the last drill was in a previous week', () => {
    expect(
      practiceDate(settings, {
        now: new Date('2026-10-05T05:00:00Z'),
        lastDrillAt: '2026-10-02T10:00:00Z',
      }),
    ).toBe('2026-10-07T10:00:00.000Z');
  });

  it('starts a new week on Monday 00:00 Paris time, not on Monday 00:00 UTC', () => {
    const now = new Date('2026-10-05T05:00:00Z');

    expect(practiceDate(settings, { now, lastDrillAt: '2026-10-04T21:30:00Z' })).toBe('2026-10-07T10:00:00.000Z');
    expect(practiceDate(settings, { now, lastDrillAt: '2026-10-04T22:30:00Z' })).toBe('2026-10-14T10:00:00.000Z');
  });

  it('keeps Sunday evening in the old week', () => {
    expect(
      practiceDate(settings, {
        now: new Date('2026-10-11T21:30:00Z'),
        lastDrillAt: '2026-10-11T20:00:00Z',
      }),
    ).toBe('2026-10-14T10:00:00.000Z');
  });

  it('does not skip next week’s reminder because of a drill done this week', () => {
    expect(
      practiceDate(settings, {
        now: new Date('2026-10-08T10:00:00Z'),
        lastDrillAt: '2026-10-06T10:00:00Z',
      }),
    ).toBe('2026-10-14T10:00:00.000Z');
  });

  it('follows the chosen day and hour', () => {
    const custom = settingsWith({ practiceReminder: { enabled: true, weekday: 5, hour: 18 } });

    expect(practiceDate(custom, { now: new Date('2026-10-05T05:00:00Z') })).toBe('2026-10-09T16:00:00.000Z');
  });

  it('skips a Monday reminder when a drill was already done earlier on Monday', () => {
    const monday = settingsWith({ practiceReminder: { enabled: true, weekday: 1, hour: 20 } });

    expect(
      practiceDate(monday, { now: new Date('2026-10-05T12:00:00Z'), lastDrillAt: '2026-10-05T08:00:00Z' }),
    ).toBe('2026-10-12T18:00:00.000Z');
  });

  it.each([
    ['before the change', '2026-10-19T05:00:00Z', '2026-10-21T10:00:00.000Z'],
    ['across the change', '2026-10-23T05:00:00Z', '2026-10-28T11:00:00.000Z'],
    ['after the change', '2026-10-26T05:00:00Z', '2026-10-28T11:00:00.000Z'],
  ])('keeps 12:00 local time %s of daylight saving time', (_label, now, expected) => {
    expect(practiceDate(settings, { now: new Date(now) })).toBe(expected);
  });

  it('works in another time zone', () => {
    expect(practiceDate(settings, { now: new Date('2026-10-05T05:00:00Z'), timeZone: NEW_YORK })).toBe(
      '2026-10-07T16:00:00.000Z',
    );
  });
});

describe('never schedules in the past', () => {
  it('holds for every instant over two months, with and without a drill today', () => {
    const settings = settingsWith();
    const start = Date.parse('2026-10-01T00:00:00Z');
    const step = 37 * 60 * 1000;

    for (let offset = 0; offset < 60 * 24 * 60 * 60 * 1000; offset += step) {
      const now = new Date(start + offset);
      const withDrill = planNotifications(settings, context({ streak: 5, lastDrillAt: now, now }));
      const withoutDrill = planNotifications(settings, context({ streak: 5, lastDrillAt: null, now }));

      for (const item of [...withDrill.schedule, ...withoutDrill.schedule]) {
        if (item.trigger.type === 'date') {
          expect(item.trigger.date.getTime()).toBeGreaterThan(now.getTime());
          expect(item.trigger.date.getTime() - now.getTime()).toBeLessThanOrEqual(14 * 24 * 60 * 60 * 1000);
        }
      }
    }
  });
});

describe('copy', () => {
  const plan = planNotifications(settingsWith(), context({ streak: 4, now: new Date('2026-10-05T10:00:00Z') }));

  it('plans all four notifications to check the copy of', () => {
    expect(plan.schedule).toHaveLength(4);
  });

  it.each(plan.schedule.map((item) => [item.kind, item] as const))('%s is short, plain French', (_kind, item) => {
    const text = `${item.title} ${item.body}`;

    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text).not.toMatch(/\b[A-ZÀ-ÖØ-Þ]{2,}\b/);
    expect(text).not.toContain('!');
    expect(item.title.length).toBeLessThanOrEqual(40);
    expect(item.body.length).toBeLessThanOrEqual(90);
    expect(item.title.charAt(0)).toBe(item.title.charAt(0).toUpperCase());
  });
});
