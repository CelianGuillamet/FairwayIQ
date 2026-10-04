jest.mock('expo-secure-store', () => {
  const data = new Map<string, string>();
  return {
    __data: data,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      __data: data,
      getItem: jest.fn(async (key: string) => data.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        data.delete(key);
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage, splitByBytes } from './secure-session-storage';

const secureData = (SecureStore as unknown as { __data: Map<string, string> }).__data;
const legacyData = (AsyncStorage as unknown as { __data: Map<string, string> }).__data;

const KEY = 'sb-test-auth-token';

function sessionJson(extraLength = 0) {
  return JSON.stringify({
    access_token: 'a'.repeat(1100),
    refresh_token: 'r'.repeat(20),
    user: { id: 'user-1', user_metadata: { name: 'Célian ⛳ 🏌️'.repeat(80 + extraLength) } },
  });
}

beforeEach(() => {
  secureData.clear();
  legacyData.clear();
  jest.clearAllMocks();
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
    secureData.set(key, value);
  });
});

describe('splitByBytes', () => {
  it('returns no chunks for an empty string', () => {
    expect(splitByBytes('')).toEqual([]);
  });

  it('splits ASCII on the byte limit', () => {
    expect(splitByBytes('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('never exceeds the byte limit or splits a multi-byte character', () => {
    const value = sessionJson();
    const chunks = splitByBytes(value, 100);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(value);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(100);
    }
  });
});

describe('secureSessionStorage', () => {
  it('round-trips a session larger than the SecureStore value limit', async () => {
    const value = sessionJson();
    expect(Buffer.byteLength(value, 'utf8')).toBeGreaterThan(2048);

    await secureSessionStorage.setItem(KEY, value);

    expect(await secureSessionStorage.getItem(KEY)).toBe(value);
    for (const stored of secureData.values()) {
      expect(Buffer.byteLength(stored, 'utf8')).toBeLessThanOrEqual(2048);
    }
    expect(legacyData.size).toBe(0);
  });

  it('returns null for a key that was never stored', async () => {
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('drops the chunks of the previous value when overwriting', async () => {
    await secureSessionStorage.setItem(KEY, sessionJson(20));
    const keysAfterLargeWrite = secureData.size;

    await secureSessionStorage.setItem(KEY, 'short');

    expect(await secureSessionStorage.getItem(KEY)).toBe('short');
    expect(secureData.size).toBe(2);
    expect(keysAfterLargeWrite).toBeGreaterThan(2);
  });

  it('keeps the previous value readable if a write fails before the manifest swap', async () => {
    const original = sessionJson();
    await secureSessionStorage.setItem(KEY, original);

    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain unavailable'));
    await expect(secureSessionStorage.setItem(KEY, sessionJson(5))).rejects.toThrow('keychain unavailable');

    expect(await secureSessionStorage.getItem(KEY)).toBe(original);
  });

  it('removes the value, its chunks and any legacy copy', async () => {
    await secureSessionStorage.setItem(KEY, sessionJson());
    legacyData.set(KEY, 'legacy');

    await secureSessionStorage.removeItem(KEY);

    expect(secureData.size).toBe(0);
    expect(legacyData.size).toBe(0);
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('treats a session with a missing chunk as absent', async () => {
    await secureSessionStorage.setItem(KEY, sessionJson());
    const chunkKey = Array.from(secureData.keys()).find((key) => key !== KEY)!;
    secureData.delete(chunkKey);

    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('treats an unreadable manifest as absent', async () => {
    secureData.set(KEY, '{not json');

    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  describe('migration from plaintext AsyncStorage', () => {
    it('moves an existing session into SecureStore on first read', async () => {
      const legacySession = sessionJson();
      legacyData.set(KEY, legacySession);

      expect(await secureSessionStorage.getItem(KEY)).toBe(legacySession);

      expect(legacyData.has(KEY)).toBe(false);
      expect(secureData.has(KEY)).toBe(true);
      expect(await secureSessionStorage.getItem(KEY)).toBe(legacySession);
      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    });

    it('still returns the legacy session, and keeps it, when SecureStore cannot be written', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      legacyData.set(KEY, 'legacy-session');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('keychain unavailable'));

      expect(await secureSessionStorage.getItem(KEY)).toBe('legacy-session');

      expect(legacyData.get(KEY)).toBe('legacy-session');
      warn.mockRestore();
    });

    it('does not keep a plaintext copy after a new write', async () => {
      legacyData.set(KEY, 'old-plaintext');

      await secureSessionStorage.setItem(KEY, 'new-value');

      expect(legacyData.has(KEY)).toBe(false);
      expect(await secureSessionStorage.getItem(KEY)).toBe('new-value');
    });
  });
});
