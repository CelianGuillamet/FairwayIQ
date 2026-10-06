import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultNotificationSettings } from '../lib/notification-settings';
import { getNotificationSettingsKey } from '../lib/notification-settings-storage';
import { useNotificationSettingsStore } from './notification-settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function storedSettings(userId: string) {
  const raw = await AsyncStorage.getItem(getNotificationSettingsKey(userId));
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  useNotificationSettingsStore.getState().reset();
});

describe('load', () => {
  it('starts with the master switch off for a user who never opted in', async () => {
    await useNotificationSettingsStore.getState().load('user-1');

    const state = useNotificationSettingsStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.userId).toBe('user-1');
    expect(state.settings).toEqual(defaultNotificationSettings());
    expect(state.settings.enabled).toBe(false);
  });

  it('restores what the user saved', async () => {
    await AsyncStorage.setItem(
      getNotificationSettingsKey('user-1'),
      JSON.stringify({ ...defaultNotificationSettings(), enabled: true }),
    );

    await useNotificationSettingsStore.getState().load('user-1');

    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(true);
  });

  it('does not reload when the same user is already loaded', async () => {
    await useNotificationSettingsStore.getState().load('user-1');
    useNotificationSettingsStore.getState().setEnabled(true);
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    getItem.mockClear();

    await useNotificationSettingsStore.getState().load('user-1');

    expect(getItem).not.toHaveBeenCalled();
    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(true);
  });

  it('drops a slow load that belongs to a user who has since signed out', async () => {
    const slow = deferred<string | null>();
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(slow.promise);

    const pending = useNotificationSettingsStore.getState().load('user-1');
    useNotificationSettingsStore.getState().reset();
    slow.resolve(JSON.stringify({ ...defaultNotificationSettings(), enabled: true }));
    await pending;

    const state = useNotificationSettingsStore.getState();
    expect(state.userId).toBeNull();
    expect(state.hydrated).toBe(false);
    expect(state.settings.enabled).toBe(false);
  });

  it('keeps each user’s settings apart', async () => {
    await useNotificationSettingsStore.getState().load('user-1');
    useNotificationSettingsStore.getState().setEnabled(true);
    await useNotificationSettingsStore.getState().load('user-2');

    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(false);
    expect((await storedSettings('user-1')).enabled).toBe(true);
  });
});

describe('updates', () => {
  beforeEach(async () => {
    await useNotificationSettingsStore.getState().load('user-1');
  });

  it('persists the master switch', async () => {
    useNotificationSettingsStore.getState().setEnabled(true);

    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(true);
    expect((await storedSettings('user-1')).enabled).toBe(true);
  });

  it('changes one reminder without touching the others', async () => {
    useNotificationSettingsStore.getState().setReminder('playReminder', { weekday: 7, hour: 9 });

    const { settings } = useNotificationSettingsStore.getState();
    expect(settings.playReminder).toEqual({ enabled: true, weekday: 7, hour: 9 });
    expect(settings.practiceReminder).toEqual(defaultNotificationSettings().practiceReminder);
    expect(settings.weeklyPlan).toEqual({ enabled: true });
    expect(await storedSettings('user-1')).toEqual(settings);
  });

  it('toggles a reminder off and back on', () => {
    useNotificationSettingsStore.getState().setReminder('streakAtRisk', { enabled: false });
    expect(useNotificationSettingsStore.getState().settings.streakAtRisk.enabled).toBe(false);

    useNotificationSettingsStore.getState().setReminder('streakAtRisk', { enabled: true });
    expect(useNotificationSettingsStore.getState().settings.streakAtRisk.enabled).toBe(true);
  });

  it('replaces the settings object on every change so subscribers notice', () => {
    const before = useNotificationSettingsStore.getState().settings;

    useNotificationSettingsStore.getState().setReminder('weeklyPlan', { enabled: false });

    expect(useNotificationSettingsStore.getState().settings).not.toBe(before);
  });

  it('ignores changes while nobody is signed in', async () => {
    useNotificationSettingsStore.getState().reset();

    useNotificationSettingsStore.getState().setEnabled(true);

    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(false);
    expect(await storedSettings('user-1')).toBeNull();
  });

  it('keeps the change in memory when saving fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    useNotificationSettingsStore.getState().setEnabled(true);
    await Promise.resolve();

    expect(useNotificationSettingsStore.getState().settings.enabled).toBe(true);
  });
});
