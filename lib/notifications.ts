import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWeeklyNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Monday 8am — weekly plan reminder
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📅 Ton plan de la semaine t\'attend',
      body: 'Consulte ton programme FairwayIQ et prépare tes séances d\'entraînement.',
      data: { type: 'weekly_plan' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 2, // Monday (1=Sunday, 2=Monday)
      hour: 8,
      minute: 0,
      repeats: true,
    },
  });

  // Friday 6pm — weekly check-in
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏌️ Check-in du vendredi',
      body: 'As-tu travaillé ton plan cette semaine ? Enregistre ton prochain round sur FairwayIQ.',
      data: { type: 'friday_checkin' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 6, // Friday
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });

  // Wednesday 12pm — mid-week drill reminder
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⛳ Mi-semaine : as-tu pratiqué ?',
      body: 'Un drill de 15 minutes peut changer ton prochain round. On y va ?',
      data: { type: 'midweek_drill' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 4, // Wednesday
      hour: 12,
      minute: 0,
      repeats: true,
    },
  });
}

export async function schedulePreRoundReminder(roundDateTime: Date): Promise<void> {
  const reminderTime = new Date(roundDateTime.getTime() - 60 * 60 * 1000); // 1h before
  if (reminderTime <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏌️ Ton round approche !',
      body: 'Rappel : tu joues dans 1 heure. Pense à ton échauffement et à ta routine.',
      data: { type: 'pre_round' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderTime,
    },
  });
}

export function setupNotificationResponseListener(
  onPress: (data: Record<string, unknown>) => void
) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    onPress(data);
  });
}
