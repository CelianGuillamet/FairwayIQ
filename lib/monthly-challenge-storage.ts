import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseStoredChallenge, type StoredChallenge } from './monthly-challenge';

const STORAGE_KEY_PREFIX = 'fairwayiq:monthly-challenge:v1:';

export function getMonthlyChallengeStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export async function loadStoredChallenge(userId: string) {
  try {
    return parseStoredChallenge(await AsyncStorage.getItem(getMonthlyChallengeStorageKey(userId)));
  } catch {
    return null;
  }
}

export async function saveStoredChallenge(userId: string, stored: StoredChallenge) {
  try {
    await AsyncStorage.setItem(getMonthlyChallengeStorageKey(userId), JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}
