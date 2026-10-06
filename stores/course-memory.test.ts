import AsyncStorage from '@react-native-async-storage/async-storage';
import { COURSE_MEMORY_LIMIT, getCourseMemoryStorageKey } from '../lib/course-memory';
import { useCourseMemoryStore } from './course-memory';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const store = () => useCourseMemoryStore.getState();

async function stored(userId = 'user-1') {
  const raw = await AsyncStorage.getItem(getCourseMemoryStorageKey(userId));
  return raw ? JSON.parse(raw) : null;
}

async function seed(value: Record<string, unknown>, userId = 'user-1') {
  await AsyncStorage.setItem(getCourseMemoryStorageKey(userId), JSON.stringify(value));
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
    await store().load('user-1');

    expect(store()).toMatchObject({ userId: 'user-1', entries: {}, loaded: true });
  });

  it('restores the stored choices', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 9, usedAt: 1 } });

    await store().load('user-1');

    expect(store().entries).toEqual({ 'id:a': { teeKey: 'white', holes: 9, usedAt: 1 } });
  });

  it('reads the choices of the signed-in user only', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 9, usedAt: 1 } }, 'user-2');

    await store().load('user-1');

    expect(store().entries).toEqual({});
  });

  it('starts empty when the stored value is corrupted or unreadable', async () => {
    await AsyncStorage.setItem(getCourseMemoryStorageKey('user-1'), '{broken');
    await store().load('user-1');
    expect(store()).toMatchObject({ entries: {}, loaded: true });

    store().reset();
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    await store().load('user-1');
    expect(store()).toMatchObject({ entries: {}, loaded: true });
  });

  it('reads the storage once for the same user', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    getItem.mockClear();

    await Promise.all([store().load('user-1'), store().load('user-1')]);
    await store().load('user-1');

    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('switches to the choices of another user', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 9, usedAt: 1 } }, 'user-1');
    await store().load('user-1');

    await store().load('user-2');

    expect(store()).toMatchObject({ userId: 'user-2', entries: {}, loaded: true });
  });

  it('drops a read that lands after a reset', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 9, usedAt: 1 } });

    const loading = store().load('user-1');
    store().reset();
    await loading;

    expect(store()).toMatchObject({ userId: null, entries: {}, loaded: false });
  });

  it('drops a read that lands after another user took over', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 9, usedAt: 1 } }, 'user-1');

    const first = store().load('user-1');
    const second = store().load('user-2');
    await Promise.all([first, second]);

    expect(store()).toMatchObject({ userId: 'user-2', entries: {}, loaded: true });
  });
});

describe('remember', () => {
  it('keeps the choice in memory and in storage for the user', async () => {
    await store().load('user-1');

    store().remember('id:a', { teeKey: 'white', holes: 9 });
    await flush();

    expect(store().entries['id:a']).toMatchObject({ teeKey: 'white', holes: 9 });
    await expect(stored()).resolves.toMatchObject({ 'id:a': { teeKey: 'white', holes: 9 } });
    await expect(stored('user-2')).resolves.toBeNull();
  });

  it('keeps the latest choice of a course', async () => {
    await store().load('user-1');

    store().remember('id:a', { teeKey: 'white', holes: 18 });
    store().remember('id:a', { teeKey: 'red', holes: 9 });
    await flush();

    await expect(stored()).resolves.toMatchObject({ 'id:a': { teeKey: 'red', holes: 9 } });
  });

  it('adds to what was stored instead of replacing it', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 18, usedAt: 1 } });
    await store().load('user-1');

    store().remember('id:b', { teeKey: 'red', holes: 9 });
    await flush();

    const saved = await stored();
    expect(Object.keys(saved).sort()).toEqual(['id:a', 'id:b']);
  });

  it('does nothing before the stored choices are read, so it cannot overwrite them', async () => {
    await seed({ 'id:a': { teeKey: 'white', holes: 18, usedAt: 1 } });

    store().remember('id:b', { teeKey: 'red', holes: 9 });
    await flush();

    expect(store().entries).toEqual({});
    await expect(stored()).resolves.toEqual({ 'id:a': { teeKey: 'white', holes: 18, usedAt: 1 } });
  });

  it('stays within the cap, forgetting the courses used the longest ago', async () => {
    let now = 1_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now++);
    await store().load('user-1');

    for (let index = 0; index < COURSE_MEMORY_LIMIT + 5; index += 1) {
      store().remember(`id:course-${index}`, { teeKey: 'yellow', holes: 18 });
    }
    await flush();

    const saved = await stored();
    expect(Object.keys(store().entries)).toHaveLength(COURSE_MEMORY_LIMIT);
    expect(Object.keys(saved)).toHaveLength(COURSE_MEMORY_LIMIT);
    expect(saved['id:course-0']).toBeUndefined();
    expect(saved['id:course-4']).toBeUndefined();
    expect(saved['id:course-5']).toBeDefined();
    expect(saved[`id:course-${COURSE_MEMORY_LIMIT + 4}`]).toBeDefined();
  });

  it('still remembers in memory when the storage refuses the write', async () => {
    await store().load('user-1');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage full'));

    store().remember('id:a', { teeKey: 'white', holes: 9 });
    await flush();

    expect(store().entries['id:a']).toMatchObject({ teeKey: 'white', holes: 9 });
  });
});

describe('reset', () => {
  it('forgets the user in memory but keeps the choices stored for their owner', async () => {
    await store().load('user-1');
    store().remember('id:a', { teeKey: 'white', holes: 9 });
    await flush();

    store().reset();

    expect(store()).toMatchObject({ userId: null, entries: {}, loaded: false });
    await store().load('user-1');
    expect(store().entries['id:a']).toMatchObject({ teeKey: 'white', holes: 9 });
  });
});
