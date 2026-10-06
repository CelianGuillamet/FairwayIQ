import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultNotificationSettings,
  parseNotificationSettings,
  type NotificationSettings,
} from './notification-settings';

const STORAGE_KEY_PREFIX = 'fairwayiq:notification-settings:v1:';

export function getNotificationSettingsKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export async function loadNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    return parseNotificationSettings(await AsyncStorage.getItem(getNotificationSettingsKey(userId)));
  } catch {
    return defaultNotificationSettings();
  }
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(getNotificationSettingsKey(userId), JSON.stringify(settings));
  } catch (error) {
    console.warn('[notifications] Saving settings failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
