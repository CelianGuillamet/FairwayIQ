import * as Notifications from 'expo-notifications';
import {
  NOTIFICATION_IDS,
  NOTIFICATION_ID_PREFIX,
  type NotificationPlan,
  type PlannedNotification,
  type PlannedTrigger,
} from './notification-plan';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const TEST_NOTIFICATION_ID = `${NOTIFICATION_ID_PREFIX}test`;
export const TEST_NOTIFICATION_DELAY_SECONDS = 3;

// The first version scheduled repeating notifications under random identifiers; they are still
// pending on devices that onboarded with it and no setting can reach them.
const LEGACY_NOTIFICATION_TYPES = new Set(['weekly_plan', 'friday_checkin', 'midweek_drill', 'pre_round']);

export type NotificationRoute = '/(tabs)/round' | '/(tabs)/drills';

export type NotificationPermission = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted: status === 'granted', canAskAgain };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await getNotificationPermission();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === 'granted';
}

function toExpoTrigger(trigger: PlannedTrigger): Notifications.NotificationTriggerInput {
  if (trigger.type === 'date') {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.date };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    // Expo counts weekdays from Sunday = 1, the planner from Monday = 1.
    weekday: (trigger.weekday % 7) + 1,
    hour: trigger.hour,
    minute: trigger.minute,
  };
}

function warn(action: string, identifier: string, error: unknown) {
  console.warn(`[notifications] ${action} failed`, {
    identifier,
    message: error instanceof Error ? error.message : String(error),
  });
}

async function cancelOne(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    warn('Cancel', identifier, error);
  }
}

// Scheduling under an existing identifier replaces the pending request on iOS and Android.
async function scheduleOne(item: PlannedNotification) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: item.identifier,
      content: { title: item.title, body: item.body, data: item.data },
      trigger: toExpoTrigger(item.trigger),
    });
  } catch (error) {
    warn('Schedule', item.identifier, error);
  }
}

export async function cancelLegacyNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const legacy = scheduled.filter(({ identifier, content }) => {
      const type = (content.data as { type?: unknown } | null | undefined)?.type;
      return !identifier.startsWith(NOTIFICATION_ID_PREFIX) && typeof type === 'string' && LEGACY_NOTIFICATION_TYPES.has(type);
    });
    for (const { identifier } of legacy) await cancelOne(identifier);
  } catch (error) {
    warn('Legacy cleanup', 'legacy', error);
  }
}

export async function applyNotificationPlan(plan: NotificationPlan): Promise<void> {
  await cancelLegacyNotifications();
  for (const identifier of plan.cancel) await cancelOne(identifier);
  for (const item of plan.schedule) await scheduleOne(item);
}

export async function cancelAllReminders(): Promise<void> {
  await cancelLegacyNotifications();
  for (const identifier of [...Object.values(NOTIFICATION_IDS), TEST_NOTIFICATION_ID]) {
    await cancelOne(identifier);
  }
}

export async function scheduleTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: TEST_NOTIFICATION_ID,
    content: {
      title: 'Notification de test',
      body: 'Tes rappels FairwayIQ s’afficheront comme ceci.',
      data: { type: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_NOTIFICATION_DELAY_SECONDS,
    },
  });
}

export function routeForNotificationType(type: unknown): NotificationRoute | null {
  switch (type) {
    case 'weekly_plan':
    case 'streak_at_risk':
    case 'practice_reminder':
      return '/(tabs)/drills';
    case 'play_reminder':
      return '/(tabs)/round';
    default:
      return null;
  }
}

export function setupNotificationResponseListener(
  onPress: (data: Record<string, unknown>) => void
) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    onPress(data);
  });
}
