import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMonthlyChallengeStorageKey,
  loadStoredChallenge,
  saveStoredChallenge,
} from './monthly-challenge-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const STORED = { month: '2026-10', challengeId: 'drills_putting', changeUsed: false } as const;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('monthly challenge storage', () => {
  it('versions the key and keeps one entry per user', () => {
    expect(getMonthlyChallengeStorageKey('user-1')).toBe('fairwayiq:monthly-challenge:v1:user-1');
    expect(getMonthlyChallengeStorageKey('user-2')).not.toBe(getMonthlyChallengeStorageKey('user-1'));
  });

  it('round-trips the challenge per user', async () => {
    await expect(saveStoredChallenge('user-1', STORED)).resolves.toBe(true);

    await expect(loadStoredChallenge('user-1')).resolves.toEqual(STORED);
    await expect(loadStoredChallenge('user-2')).resolves.toBeNull();
  });

  it('keeps the latest save only', async () => {
    await saveStoredChallenge('user-1', STORED);
    await saveStoredChallenge('user-1', { month: '2026-10', challengeId: 'rounds_three', changeUsed: true });

    await expect(loadStoredChallenge('user-1')).resolves.toEqual({
      month: '2026-10',
      challengeId: 'rounds_three',
      changeUsed: true,
    });
  });

  it('ignores a corrupted or unknown value', async () => {
    await AsyncStorage.setItem(getMonthlyChallengeStorageKey('user-1'), '{broken');
    await expect(loadStoredChallenge('user-1')).resolves.toBeNull();

    await AsyncStorage.setItem(getMonthlyChallengeStorageKey('user-1'), JSON.stringify({ ...STORED, challengeId: 'retired' }));
    await expect(loadStoredChallenge('user-1')).resolves.toBeNull();
  });

  it('never throws when the storage is unavailable', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(loadStoredChallenge('user-1')).resolves.toBeNull();
    await expect(saveStoredChallenge('user-1', STORED)).resolves.toBe(false);
  });
});
