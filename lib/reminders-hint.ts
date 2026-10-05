import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'fairwayiq:reminders-hint-dismissed:v1:';

export function getRemindersHintStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export async function loadRemindersHintDismissed(userId: string) {
  try {
    return (await AsyncStorage.getItem(getRemindersHintStorageKey(userId))) === '1';
  } catch {
    // Can't remember a dismissal either, so don't nag on every launch.
    return true;
  }
}

export async function saveRemindersHintDismissed(userId: string) {
  try {
    await AsyncStorage.setItem(getRemindersHintStorageKey(userId), '1');
    return true;
  } catch {
    return false;
  }
}

type VisibilityInput = {
  roundCount: number;
  dismissed: boolean | null;
  remindersReady: boolean;
  remindersOn: boolean;
};

export function shouldShowRemindersHint({ roundCount, dismissed, remindersReady, remindersOn }: VisibilityInput) {
  return roundCount > 0 && dismissed === false && remindersReady && !remindersOn;
}
