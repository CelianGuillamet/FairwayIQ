import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearStoredWeeklyGoal,
  getWeeklyGoalStorageKey,
  loadStoredWeeklyGoal,
  saveStoredWeeklyGoal,
} from './weekly-goal-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('weekly goal storage', () => {
  it('round-trips a goal per user', async () => {
    await expect(saveStoredWeeklyGoal('user-1', 5)).resolves.toBe(true);

    await expect(loadStoredWeeklyGoal('user-1')).resolves.toBe(5);
    await expect(loadStoredWeeklyGoal('user-2')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(getWeeklyGoalStorageKey('user-1'))).resolves.toBe('5');
  });

  it('stores a clamped value', async () => {
    await saveStoredWeeklyGoal('user-1', 12);

    await expect(loadStoredWeeklyGoal('user-1')).resolves.toBe(7);
  });

  it('ignores a corrupted value', async () => {
    await AsyncStorage.setItem(getWeeklyGoalStorageKey('user-1'), 'banana');

    await expect(loadStoredWeeklyGoal('user-1')).resolves.toBeNull();
  });

  it('clears the saved goal', async () => {
    await saveStoredWeeklyGoal('user-1', 2);

    await expect(clearStoredWeeklyGoal('user-1')).resolves.toBe(true);
    await expect(loadStoredWeeklyGoal('user-1')).resolves.toBeNull();
  });

  it('never throws when the storage is unavailable', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('storage unavailable'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('storage unavailable'));
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(new Error('storage unavailable'));

    await expect(loadStoredWeeklyGoal('user-1')).resolves.toBeNull();
    await expect(saveStoredWeeklyGoal('user-1', 3)).resolves.toBe(false);
    await expect(clearStoredWeeklyGoal('user-1')).resolves.toBe(false);
  });
});
