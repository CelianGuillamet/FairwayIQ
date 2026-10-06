import * as Notifications from 'expo-notifications';
import { defaultNotificationSettings, type NotificationSettings } from './notification-settings';
import { NOTIFICATION_IDS, planNotifications } from './notification-plan';
import {
  TEST_NOTIFICATION_ID,
  applyNotificationPlan,
  cancelAllReminders,
  getNotificationPermission,
  requestNotificationPermissions,
  routeForNotificationType,
  scheduleTestNotification,
} from './notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;

function enabled(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return { ...defaultNotificationSettings(), enabled: true, ...overrides };
}

const context = {
  streak: 3,
  lastDrillAt: '2026-10-04T10:00:00Z',
  now: new Date('2026-10-05T10:00:00Z'),
  timeZone: 'Europe/Paris',
};

function cancelledIds() {
  return mocked.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id);
}

function scheduledRequests() {
  return mocked.scheduleNotificationAsync.mock.calls.map(([request]) => request);
}

beforeEach(() => {
  jest.resetAllMocks();
  mocked.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  mocked.scheduleNotificationAsync.mockResolvedValue('id');
  mocked.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
});

describe('applyNotificationPlan', () => {
  it('schedules each reminder under its explicit identifier', async () => {
    await applyNotificationPlan(planNotifications(enabled(), context));

    expect(scheduledRequests().map((request) => request.identifier).sort()).toEqual(
      Object.values(NOTIFICATION_IDS).sort(),
    );
    expect(cancelledIds()).toEqual([]);
  });

  it('turning one reminder off cancels only that identifier and leaves the others scheduled', async () => {
    const settings = enabled({ playReminder: { enabled: false, weekday: 6, hour: 8 } });

    await applyNotificationPlan(planNotifications(settings, context));

    expect(cancelledIds()).toEqual([NOTIFICATION_IDS.playReminder]);
    expect(scheduledRequests().map((request) => request.identifier)).not.toContain(NOTIFICATION_IDS.playReminder);
    expect(scheduledRequests()).toHaveLength(3);
  });

  it('cancels all four reminders when the master switch is off, without a global wipe', async () => {
    await applyNotificationPlan(planNotifications({ ...enabled(), enabled: false }, context));

    expect(cancelledIds().sort()).toEqual(Object.values(NOTIFICATION_IDS).sort());
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocked.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('maps weekdays from Monday = 1 to Expo’s Sunday = 1', async () => {
    const settings = enabled({ playReminder: { enabled: true, weekday: 7, hour: 9 } });

    await applyNotificationPlan(planNotifications(settings, context));

    const byId = Object.fromEntries(scheduledRequests().map((request) => [request.identifier, request]));
    expect(byId[NOTIFICATION_IDS.weeklyPlan].trigger).toEqual({ type: 'weekly', weekday: 2, hour: 8, minute: 0 });
    expect(byId[NOTIFICATION_IDS.playReminder].trigger).toEqual({ type: 'weekly', weekday: 1, hour: 9, minute: 0 });
  });

  it('passes one-shot reminders as date triggers', async () => {
    await applyNotificationPlan(planNotifications(enabled(), context));

    const byId = Object.fromEntries(scheduledRequests().map((request) => [request.identifier, request]));
    expect(byId[NOTIFICATION_IDS.streakAtRisk].trigger).toEqual({
      type: 'date',
      date: new Date('2026-10-05T16:30:00.000Z'),
    });
    expect(byId[NOTIFICATION_IDS.practiceReminder].trigger).toEqual({
      type: 'date',
      date: new Date('2026-10-07T10:00:00.000Z'),
    });
  });

  it('sends the notification type as data and no emoji in the content', async () => {
    await applyNotificationPlan(planNotifications(enabled(), context));

    for (const request of scheduledRequests()) {
      expect(request.content.data).toEqual({ type: expect.any(String) });
      expect(`${request.content.title}${request.content.body}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('keeps going when one notification fails to schedule', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));

    await expect(applyNotificationPlan(planNotifications(enabled(), context))).resolves.toBeUndefined();

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('legacy notifications', () => {
  const legacy = (identifier: string, type: string) => ({
    identifier,
    content: { title: 'old', body: 'old', data: { type } },
    trigger: null,
  });

  it('cancels the repeating notifications scheduled at onboarding by the first version', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      legacy('0f1e2d3c-uuid-1', 'weekly_plan'),
      legacy('0f1e2d3c-uuid-2', 'friday_checkin'),
      legacy('0f1e2d3c-uuid-3', 'midweek_drill'),
      legacy('0f1e2d3c-uuid-4', 'pre_round'),
    ] as never);

    await applyNotificationPlan(planNotifications(enabled(), context));

    expect(cancelledIds()).toEqual(['0f1e2d3c-uuid-1', '0f1e2d3c-uuid-2', '0f1e2d3c-uuid-3', '0f1e2d3c-uuid-4']);
  });

  it('never touches the new reminders, which reuse the weekly_plan type, nor unrelated notifications', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      legacy(NOTIFICATION_IDS.weeklyPlan, 'weekly_plan'),
      legacy('someone-else', 'other'),
      { identifier: 'no-data', content: { title: 'x', body: 'x', data: null }, trigger: null },
    ] as never);

    await applyNotificationPlan(planNotifications(enabled(), context));

    expect(cancelledIds()).toEqual([]);
  });

  it('survives a failing lookup', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('nope'));

    await applyNotificationPlan(planNotifications(enabled(), context));

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });
});

describe('cancelAllReminders', () => {
  it('cancels the four reminders, the test notification and legacy ones by identifier', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'legacy-1', content: { title: 'x', body: 'x', data: { type: 'friday_checkin' } }, trigger: null },
    ] as never);

    await cancelAllReminders();

    expect(cancelledIds().sort()).toEqual(
      ['legacy-1', TEST_NOTIFICATION_ID, ...Object.values(NOTIFICATION_IDS)].sort(),
    );
    expect(mocked.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleTestNotification', () => {
  it('fires one notification in 3 seconds under its own identifier', async () => {
    await scheduleTestNotification();

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduledRequests()[0]).toMatchObject({
      identifier: TEST_NOTIFICATION_ID,
      trigger: { type: 'timeInterval', seconds: 3 },
      content: { data: { type: 'test' } },
    });
    expect(TEST_NOTIFICATION_ID).not.toBe(NOTIFICATION_IDS.weeklyPlan);
  });
});

describe('permissions', () => {
  it('reports granted without asking again', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true } as never);

    expect(await getNotificationPermission()).toEqual({ granted: true, canAskAgain: true });
    expect(await requestNotificationPermissions()).toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows the system prompt only while it can still be shown', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
    mocked.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);

    expect(await requestNotificationPermissions()).toBe(true);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns false when the user refuses the prompt', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
    mocked.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    expect(await requestNotificationPermissions()).toBe(false);
  });

  it('does not prompt again once the permission was denied', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);

    expect(await getNotificationPermission()).toEqual({ granted: false, canAskAgain: false });
    expect(await requestNotificationPermissions()).toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('routeForNotificationType', () => {
  it('opens the drills tab for plan and practice notifications', () => {
    expect(routeForNotificationType('weekly_plan')).toBe('/(tabs)/drills');
    expect(routeForNotificationType('streak_at_risk')).toBe('/(tabs)/drills');
    expect(routeForNotificationType('practice_reminder')).toBe('/(tabs)/drills');
  });

  it('opens the round tab for the play reminder', () => {
    expect(routeForNotificationType('play_reminder')).toBe('/(tabs)/round');
  });

  it('stays where it is for the test notification and unknown types', () => {
    expect(routeForNotificationType('test')).toBeNull();
    expect(routeForNotificationType(undefined)).toBeNull();
    expect(routeForNotificationType(42)).toBeNull();
  });
});
