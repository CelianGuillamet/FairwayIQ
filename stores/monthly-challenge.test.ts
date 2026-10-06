import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMonthlyChallengeStorageKey } from '../lib/monthly-challenge-storage';
import { useMonthlyChallengeStore } from './monthly-challenge';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const store = () => useMonthlyChallengeStore.getState();

async function stored(userId = 'user-1') {
  const raw = await AsyncStorage.getItem(getMonthlyChallengeStorageKey(userId));
  return raw ? JSON.parse(raw) : null;
}

async function seed(value: Record<string, unknown>, userId = 'user-1') {
  await AsyncStorage.setItem(getMonthlyChallengeStorageKey(userId), JSON.stringify(value));
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  store().reset();
});

describe('load', () => {
  it('starts empty when nothing was stored', async () => {
    await store().load('user-1', '2026-10');

    expect(store()).toMatchObject({ userId: 'user-1', month: '2026-10', challengeId: null, changeUsed: false, loaded: true });
  });

  it('restores the challenge and the change of the same month', async () => {
    await seed({ month: '2026-10', challengeId: 'drills_putting', changeUsed: true });

    await store().load('user-1', '2026-10');

    expect(store()).toMatchObject({ challengeId: 'drills_putting', changeUsed: true, loaded: true });
  });

  it('forgets the challenge of an earlier month', async () => {
    await seed({ month: '2026-09', challengeId: 'drills_putting', changeUsed: true });

    await store().load('user-1', '2026-10');

    expect(store()).toMatchObject({ month: '2026-10', challengeId: null, changeUsed: false, loaded: true });
  });

  it('reads the challenge of the signed-in user only', async () => {
    await seed({ month: '2026-10', challengeId: 'rounds_three', changeUsed: false }, 'user-2');

    await store().load('user-1', '2026-10');

    expect(store().challengeId).toBeNull();
  });

  it('still works when the storage is unreadable', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await store().load('user-1', '2026-10');

    expect(store()).toMatchObject({ challengeId: null, loaded: true });
  });

  it('reads the storage once for the same user and month', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    getItem.mockClear();

    await Promise.all([store().load('user-1', '2026-10'), store().load('user-1', '2026-10')]);
    await store().load('user-1', '2026-10');

    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('reloads when the month rolls over', async () => {
    await store().load('user-1', '2026-10');
    store().choose('drills_putting');
    await flush();

    await store().load('user-1', '2026-11');

    expect(store()).toMatchObject({ month: '2026-11', challengeId: null, changeUsed: false });
  });

  it('drops a read that lands after a reset', async () => {
    await seed({ month: '2026-10', challengeId: 'rounds_three', changeUsed: false });

    const loading = store().load('user-1', '2026-10');
    store().reset();
    await loading;

    expect(store()).toMatchObject({ userId: null, challengeId: null, loaded: false });
  });
});

describe('choose', () => {
  it('keeps the first choice of the month, in memory and in storage', async () => {
    await store().load('user-1', '2026-10');

    store().choose('drills_putting');
    store().choose('rounds_three');
    await flush();

    expect(store().challengeId).toBe('drills_putting');
    await expect(stored()).resolves.toEqual({ month: '2026-10', challengeId: 'drills_putting', changeUsed: false });
  });

  it('keeps the challenge for the whole month across sessions', async () => {
    await store().load('user-1', '2026-10');
    store().choose('drills_putting');
    await flush();
    store().reset();

    await store().load('user-1', '2026-10');

    expect(store().challengeId).toBe('drills_putting');
  });

  it('chooses a new one at month rollover', async () => {
    await store().load('user-1', '2026-10');
    store().choose('drills_putting');
    await flush();
    store().reset();

    await store().load('user-1', '2026-11');
    store().choose('rounds_three');
    await flush();

    expect(store().challengeId).toBe('rounds_three');
    await expect(stored()).resolves.toEqual({ month: '2026-11', challengeId: 'rounds_three', changeUsed: false });
  });

  it('does nothing before the state is loaded', async () => {
    store().choose('drills_putting');
    await flush();

    expect(store().challengeId).toBeNull();
    await expect(stored()).resolves.toBeNull();
  });

  it('keeps the choice in memory when the storage is full', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await store().load('user-1', '2026-10');

    store().choose('drills_putting');
    await flush();

    expect(store().challengeId).toBe('drills_putting');
  });
});

describe('change', () => {
  async function chosen(id: Parameters<ReturnType<typeof store>['choose']>[0] = 'drills_putting') {
    await store().load('user-1', '2026-10');
    store().choose(id);
    await flush();
  }

  it('swaps the challenge once, and remembers that the change was used', async () => {
    await chosen();

    expect(store().change('rounds_three')).toBe(true);
    await flush();

    expect(store()).toMatchObject({ challengeId: 'rounds_three', changeUsed: true });
    await expect(stored()).resolves.toEqual({ month: '2026-10', challengeId: 'rounds_three', changeUsed: true });
  });

  it('refuses a second change in the same month', async () => {
    await chosen();
    store().change('rounds_three');

    expect(store().change('drills_approach')).toBe(false);
    expect(store().challengeId).toBe('rounds_three');
  });

  it('keeps the change used across sessions, so closing the app does not give it back', async () => {
    await chosen();
    store().change('rounds_three');
    await flush();
    store().reset();

    await store().load('user-1', '2026-10');

    expect(store().change('drills_approach')).toBe(false);
    expect(store()).toMatchObject({ challengeId: 'rounds_three', changeUsed: true });
  });

  it('gives a change back the next month', async () => {
    await chosen();
    store().change('rounds_three');
    await flush();
    store().reset();

    await store().load('user-1', '2026-11');
    store().choose('drills_putting');

    expect(store().change('rounds_three')).toBe(true);
  });

  it('refuses to change before a challenge was chosen, or to the same challenge', async () => {
    await store().load('user-1', '2026-10');
    expect(store().change('rounds_three')).toBe(false);

    store().choose('rounds_three');
    expect(store().change('rounds_three')).toBe(false);
    expect(store().changeUsed).toBe(false);
  });
});

describe('observeDone', () => {
  it('says nothing about a challenge first seen undone', () => {
    expect(store().observeDone(false)).toBeNull();
    expect(store().observeDone(false)).toBeNull();
  });

  it('celebrates the flip from undone to done, once', () => {
    store().observeDone(false);

    expect(store().observeDone(true)).toBe('celebrate');
    expect(store().observeDone(true)).toBeNull();
  });

  it('keeps a challenge first seen done silent', () => {
    expect(store().observeDone(true)).toBe('silent');
    expect(store().observeDone(true)).toBeNull();
  });

  it('celebrates again only after the challenge went back to undone', () => {
    store().observeDone(true);

    expect(store().observeDone(false)).toBeNull();
    expect(store().observeDone(true)).toBe('celebrate');
  });

  it('starts over when the challenge changes', async () => {
    await store().load('user-1', '2026-10');
    store().choose('drills_putting');
    store().observeDone(false);

    store().change('rounds_three');

    expect(store().observeDone(true)).toBe('silent');
  });
});

describe('reset', () => {
  it('forgets everything, like the other per-user caches', async () => {
    await store().load('user-1', '2026-10');
    store().choose('drills_putting');
    store().observeDone(true);

    store().reset();

    expect(store()).toMatchObject({
      userId: null,
      month: null,
      challengeId: null,
      changeUsed: false,
      loaded: false,
      doneSeen: null,
    });
  });
});
