import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRemindersHintStorageKey,
  loadRemindersHintDismissed,
  saveRemindersHintDismissed,
  shouldShowRemindersHint,
} from './reminders-hint';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('reminders hint storage', () => {
  it('versions the key and keeps one entry per user', () => {
    expect(getRemindersHintStorageKey('user-1')).toBe('fairwayiq:reminders-hint-dismissed:v1:user-1');
    expect(getRemindersHintStorageKey('user-2')).not.toBe(getRemindersHintStorageKey('user-1'));
  });

  it('is not dismissed until saved, and only for that user', async () => {
    await expect(loadRemindersHintDismissed('user-1')).resolves.toBe(false);

    await expect(saveRemindersHintDismissed('user-1')).resolves.toBe(true);

    await expect(loadRemindersHintDismissed('user-1')).resolves.toBe(true);
    await expect(loadRemindersHintDismissed('user-2')).resolves.toBe(false);
  });

  it('treats an unreadable storage as dismissed', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('boom'));

    await expect(loadRemindersHintDismissed('user-1')).resolves.toBe(true);
  });

  it('reports a failed save without throwing', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('boom'));

    await expect(saveRemindersHintDismissed('user-1')).resolves.toBe(false);
  });
});

describe('shouldShowRemindersHint', () => {
  const ready = { roundCount: 1, dismissed: false, remindersReady: true, remindersOn: false };

  it('shows after the first saved round', () => {
    expect(shouldShowRemindersHint(ready)).toBe(true);
  });

  it('stays hidden before any round', () => {
    expect(shouldShowRemindersHint({ ...ready, roundCount: 0 })).toBe(false);
  });

  it('stays hidden once dismissed or while the dismissal is unknown', () => {
    expect(shouldShowRemindersHint({ ...ready, dismissed: true })).toBe(false);
    expect(shouldShowRemindersHint({ ...ready, dismissed: null })).toBe(false);
  });

  it('stays hidden until the reminder settings are loaded, and when reminders are already on', () => {
    expect(shouldShowRemindersHint({ ...ready, remindersReady: false })).toBe(false);
    expect(shouldShowRemindersHint({ ...ready, remindersOn: true })).toBe(false);
  });
});
