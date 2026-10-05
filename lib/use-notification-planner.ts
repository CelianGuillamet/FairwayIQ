import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/auth';
import { useDrillsStore } from '../stores/drills';
import { useNotificationSettingsStore } from '../stores/notification-settings';
import { requestNotificationSync } from './notification-sync';

export function useNotificationPlanner() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authLoading = useAuthStore((state) => state.loading);

  useEffect(() => {
    if (authLoading) return;

    const settingsStore = useNotificationSettingsStore.getState();
    if (userId) {
      void settingsStore.load(userId);
    } else {
      settingsStore.reset();
    }
    requestNotificationSync();
  }, [userId, authLoading]);

  useEffect(() => {
    const unsubscribeSettings = useNotificationSettingsStore.subscribe((state, previous) => {
      if (state.settings !== previous.settings || state.hydrated !== previous.hydrated) {
        requestNotificationSync();
      }
    });

    const unsubscribeDrills = useDrillsStore.subscribe((state, previous) => {
      if (state.completions !== previous.completions) {
        requestNotificationSync();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        requestNotificationSync();
      }
    });

    requestNotificationSync();

    return () => {
      unsubscribeSettings();
      unsubscribeDrills();
      appStateSubscription.remove();
    };
  }, []);
}
