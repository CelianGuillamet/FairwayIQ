import { useAuthStore } from '../stores/auth';
import { useDrillsStore } from '../stores/drills';
import { useNotificationSettingsStore } from '../stores/notification-settings';
import { planNotifications } from './notification-plan';
import { applyNotificationPlan, cancelAllReminders, getNotificationPermission } from './notifications';
import { getDeviceTimeZone } from './zoned-time';

export function latestCompletionAt(completions: readonly { completed_at: string }[]): string | null {
  let latest: string | null = null;
  let latestTime = -Infinity;

  for (const { completed_at } of completions) {
    const time = Date.parse(completed_at);
    if (!Number.isNaN(time) && time > latestTime) {
      latest = completed_at;
      latestTime = time;
    }
  }

  return latest;
}

export async function syncNotifications(): Promise<void> {
  const { loading, user } = useAuthStore.getState();
  if (loading) return;

  if (!user) {
    await cancelAllReminders();
    return;
  }

  const { hydrated, userId, settings } = useNotificationSettingsStore.getState();
  if (!hydrated || userId !== user.id) return;

  const { granted } = await getNotificationPermission();
  const { completions, getStreak } = useDrillsStore.getState();

  const plan = planNotifications(granted ? settings : { ...settings, enabled: false }, {
    streak: getStreak(),
    lastDrillAt: latestCompletionAt(completions),
    now: new Date(),
    timeZone: getDeviceTimeZone(),
  });

  await applyNotificationPlan(plan);
}

export function createCoalescedRunner(task: () => Promise<void>): () => void {
  let running = false;
  let rerun = false;

  return function request() {
    if (running) {
      rerun = true;
      return;
    }

    running = true;
    void (async () => {
      try {
        do {
          rerun = false;
          try {
            await task();
          } catch (error) {
            console.warn('[notifications] Sync failed', {
              message: error instanceof Error ? error.message : String(error),
            });
          }
        } while (rerun);
      } finally {
        running = false;
      }
    })();
  };
}

export const requestNotificationSync = createCoalescedRunner(syncNotifications);
