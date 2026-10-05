import { create } from 'zustand';
import {
  defaultNotificationSettings,
  type NotificationSettings,
  type ReminderKey,
} from '../lib/notification-settings';
import { loadNotificationSettings, saveNotificationSettings } from '../lib/notification-settings-storage';

type NotificationSettingsState = {
  userId: string | null;
  settings: NotificationSettings;
  hydrated: boolean;
  load: (userId: string) => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setReminder: <K extends ReminderKey>(key: K, patch: Partial<NotificationSettings[K]>) => void;
  reset: () => void;
};

let generation = 0;

export const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => {
  const commit = (settings: NotificationSettings) => {
    const { userId, hydrated } = get();
    if (!userId || !hydrated) return;
    set({ settings });
    void saveNotificationSettings(userId, settings);
  };

  return {
    userId: null,
    settings: defaultNotificationSettings(),
    hydrated: false,

    load: async (userId) => {
      if (get().userId === userId) return;

      const requestGeneration = ++generation;
      set({ userId, hydrated: false, settings: defaultNotificationSettings() });

      const settings = await loadNotificationSettings(userId);
      if (requestGeneration !== generation) return;

      set({ settings, hydrated: true });
    },

    setEnabled: (enabled) => commit({ ...get().settings, enabled }),

    setReminder: (key, patch) => {
      const current = get().settings;
      commit({ ...current, [key]: { ...current[key], ...patch } });
    },

    reset: () => {
      generation++;
      set({ userId: null, hydrated: false, settings: defaultNotificationSettings() });
    },
  };
});
