import { subDays } from 'date-fns';

const mockApplyNotificationPlan = jest.fn();
const mockCancelAllReminders = jest.fn();
const mockGetNotificationPermission = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('./supabase', () => ({ supabase: {}, clearStoredAuthSession: jest.fn() }));
jest.mock('./purchases', () => ({ resetPurchasesUser: jest.fn() }));
jest.mock('./round-draft', () => ({ clearRoundDraft: jest.fn() }));
jest.mock('./notifications', () => ({
  applyNotificationPlan: (plan: unknown) => mockApplyNotificationPlan(plan),
  cancelAllReminders: () => mockCancelAllReminders(),
  getNotificationPermission: () => mockGetNotificationPermission(),
}));

import { useAuthStore } from '../stores/auth';
import { useDrillsStore } from '../stores/drills';
import { useNotificationSettingsStore } from '../stores/notification-settings';
import { defaultNotificationSettings } from './notification-settings';
import { NOTIFICATION_IDS, type NotificationPlan } from './notification-plan';
import { createCoalescedRunner, latestCompletionAt, syncNotifications } from './notification-sync';

const NOW = new Date('2026-10-05T10:00:00.000Z');

function completionAt(daysAgo: number, id = `c-${daysAgo}`) {
  return { id, drill_id: 'putting-1', completed_at: subDays(NOW, daysAgo).toISOString() };
}

function signIn(userId: string | null, loading = false) {
  useAuthStore.setState({ user: userId ? ({ id: userId } as never) : null, loading });
}

function hydrate(userId: string, overrides: Partial<ReturnType<typeof defaultNotificationSettings>> = {}) {
  useNotificationSettingsStore.setState({
    userId,
    hydrated: true,
    settings: { ...defaultNotificationSettings(), enabled: true, ...overrides },
  });
}

function appliedPlan(): NotificationPlan {
  return mockApplyNotificationPlan.mock.calls[0][0];
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  mockApplyNotificationPlan.mockResolvedValue(undefined);
  mockCancelAllReminders.mockResolvedValue(undefined);
  mockGetNotificationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  signIn('user-1');
  hydrate('user-1');
  useDrillsStore.setState({ completions: [completionAt(1), completionAt(2)] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('latestCompletionAt', () => {
  it('returns null when there are no completions', () => {
    expect(latestCompletionAt([])).toBeNull();
  });

  it('finds the newest completion whatever the order', () => {
    const newest = completionAt(0);

    expect(latestCompletionAt([completionAt(3), newest, completionAt(1)])).toBe(newest.completed_at);
  });

  it('ignores unreadable dates', () => {
    expect(latestCompletionAt([{ completed_at: 'oops' }, { completed_at: '2026-10-04T10:00:00Z' }])).toBe(
      '2026-10-04T10:00:00Z',
    );
  });
});

describe('syncNotifications', () => {
  it('waits for the session before doing anything', async () => {
    signIn(null, true);

    await syncNotifications();

    expect(mockCancelAllReminders).not.toHaveBeenCalled();
    expect(mockApplyNotificationPlan).not.toHaveBeenCalled();
  });

  it('cancels everything when nobody is signed in', async () => {
    signIn(null);

    await syncNotifications();

    expect(mockCancelAllReminders).toHaveBeenCalledTimes(1);
    expect(mockApplyNotificationPlan).not.toHaveBeenCalled();
  });

  it('waits until the settings of the signed-in user are loaded', async () => {
    useNotificationSettingsStore.setState({ hydrated: false });
    await syncNotifications();

    useNotificationSettingsStore.setState({ hydrated: true, userId: 'someone-else' });
    await syncNotifications();

    expect(mockApplyNotificationPlan).not.toHaveBeenCalled();
    expect(mockCancelAllReminders).not.toHaveBeenCalled();
  });

  it('plans from the streak and the latest completion in the drills store', async () => {
    await syncNotifications();

    const streak = appliedPlan().schedule.find((item) => item.identifier === NOTIFICATION_IDS.streakAtRisk);
    expect(streak?.title).toBe('Série de 2 jours en cours');
    expect(appliedPlan().schedule).toHaveLength(4);
  });

  it('drops the streak reminder for today once a drill is completed', async () => {
    useDrillsStore.setState({ completions: [completionAt(0), completionAt(1), completionAt(2)] });

    await syncNotifications();

    const streak = appliedPlan().schedule.find((item) => item.identifier === NOTIFICATION_IDS.streakAtRisk);
    expect(streak?.trigger.type === 'date' && streak.trigger.date.getTime()).toBeGreaterThan(
      NOW.getTime() + 12 * 60 * 60 * 1000,
    );
  });

  it('cancels every reminder while the master switch is off', async () => {
    hydrate('user-1', { enabled: false });

    await syncNotifications();

    expect(appliedPlan().schedule).toEqual([]);
    expect(appliedPlan().cancel).toHaveLength(4);
  });

  it('cancels every reminder when the system permission was withdrawn', async () => {
    mockGetNotificationPermission.mockResolvedValue({ granted: false, canAskAgain: false });

    await syncNotifications();

    expect(appliedPlan().schedule).toEqual([]);
    expect(appliedPlan().cancel).toHaveLength(4);
  });

  it('does not change the stored settings when the permission is withdrawn', async () => {
    mockGetNotificationPermission.mockResolvedValue({ granted: false, canAskAgain: false });

    await syncNotifications();

    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(true);
  });
});

describe('createCoalescedRunner', () => {
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('runs the task once for a single request', async () => {
    const task = jest.fn().mockResolvedValue(undefined);

    createCoalescedRunner(task)();
    await jest.advanceTimersByTimeAsync(0);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('never overlaps runs and folds requests made meanwhile into one more run', async () => {
    const gates = [deferred(), deferred(), deferred()];
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const task = jest.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gates[calls++].promise;
      active--;
    });
    const request = createCoalescedRunner(task);

    request();
    request();
    request();
    expect(task).toHaveBeenCalledTimes(1);

    gates[0].resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(2);

    gates[1].resolve();
    await jest.advanceTimersByTimeAsync(0);

    expect(task).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it('can run again after it settled', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    const request = createCoalescedRunner(task);

    request();
    await jest.advanceTimersByTimeAsync(0);
    request();
    await jest.advanceTimersByTimeAsync(0);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('logs a failing run and keeps working', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const task = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const request = createCoalescedRunner(task);

    request();
    await jest.advanceTimersByTimeAsync(0);
    request();
    await jest.advanceTimersByTimeAsync(0);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
