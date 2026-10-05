import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

function run(trigger: () => Promise<unknown>) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  try {
    Promise.resolve(trigger()).catch(() => undefined);
  } catch {
    return;
  }
}

export function hapticLight() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticSuccess() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
