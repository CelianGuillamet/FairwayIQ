import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COURSE_MEMORY_LIMIT,
  getCourseMemoryStorageKey,
  getRememberedTee,
  loadCourseMemory,
  parseCourseMemory,
  rememberCourseChoice,
  saveCourseMemory,
  type CourseMemory,
} from './course-memory';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const ENTRY = { teeKey: 'white', holes: 18 as const, usedAt: 1_000 };

function memoryOf(size: number): CourseMemory {
  return Object.fromEntries(
    Array.from({ length: size }, (_, index) => [`id:course-${index}`, { teeKey: 'yellow', holes: 18 as const, usedAt: index }])
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('parseCourseMemory', () => {
  it('reads what rememberCourseChoice produced', () => {
    const memory = rememberCourseChoice({}, 'id:saint-cloud', { teeKey: 'white', holes: 9 }, 5);

    expect(parseCourseMemory(JSON.stringify(memory))).toEqual({ 'id:saint-cloud': { teeKey: 'white', holes: 9, usedAt: 5 } });
  });

  it('starts empty without a stored value or with unreadable data', () => {
    expect(parseCourseMemory(null)).toEqual({});
    expect(parseCourseMemory('')).toEqual({});
    expect(parseCourseMemory('{broken')).toEqual({});
    expect(parseCourseMemory('42')).toEqual({});
    expect(parseCourseMemory('null')).toEqual({});
    expect(parseCourseMemory('[1,2]')).toEqual({});
  });

  it('drops the entries that are not well formed and keeps the others', () => {
    const raw = JSON.stringify({
      'id:ok': ENTRY,
      'id:no-tee': { ...ENTRY, teeKey: '  ' },
      'id:tee-number': { ...ENTRY, teeKey: 3 },
      'id:holes-12': { ...ENTRY, holes: 12 },
      'id:no-date': { teeKey: 'white', holes: 18 },
      'id:string-date': { ...ENTRY, usedAt: 'yesterday' },
      'id:null': null,
      'id:text': 'white',
    });

    expect(parseCourseMemory(raw)).toEqual({ 'id:ok': ENTRY });
  });

  it('keeps the most recently used courses when more than the cap are stored', () => {
    const parsed = parseCourseMemory(JSON.stringify(memoryOf(COURSE_MEMORY_LIMIT + 10)));
    const keys = Object.keys(parsed);

    expect(keys).toHaveLength(COURSE_MEMORY_LIMIT);
    expect(keys).toContain(`id:course-${COURSE_MEMORY_LIMIT + 9}`);
    expect(keys).not.toContain('id:course-0');
    expect(keys).not.toContain('id:course-9');
  });

  it('does not let a stored __proto__ key reach the prototype', () => {
    const parsed = parseCourseMemory(`{"__proto__":{"teeKey":"white","holes":18,"usedAt":1},"id:a":${JSON.stringify(ENTRY)}}`);

    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(({} as { teeKey?: string }).teeKey).toBeUndefined();
    expect(parsed['id:a']).toEqual(ENTRY);
  });
});

describe('rememberCourseChoice', () => {
  it('adds a course without touching the others', () => {
    const before: CourseMemory = { 'id:a': ENTRY };

    const after = rememberCourseChoice(before, 'name:golf du lac', { teeKey: 'red', holes: 9 }, 2_000);

    expect(after).toEqual({ 'id:a': ENTRY, 'name:golf du lac': { teeKey: 'red', holes: 9, usedAt: 2_000 } });
    expect(before).toEqual({ 'id:a': ENTRY });
  });

  it('replaces the previous choice of the same course', () => {
    const after = rememberCourseChoice({ 'id:a': ENTRY }, 'id:a', { teeKey: 'blue', holes: 9 }, 3_000);

    expect(after).toEqual({ 'id:a': { teeKey: 'blue', holes: 9, usedAt: 3_000 } });
  });

  it('drops the course used the longest ago once the cap is reached, and keeps the new one', () => {
    const full = memoryOf(COURSE_MEMORY_LIMIT);

    const after = rememberCourseChoice(full, 'id:newcomer', { teeKey: 'white', holes: 18 }, 10_000);

    expect(Object.keys(after)).toHaveLength(COURSE_MEMORY_LIMIT);
    expect(after['id:newcomer']).toBeDefined();
    expect(after['id:course-0']).toBeUndefined();
    expect(after['id:course-1']).toBeDefined();
  });

  it('does not evict anything when an existing course is updated at the cap', () => {
    const full = memoryOf(COURSE_MEMORY_LIMIT);

    const after = rememberCourseChoice(full, 'id:course-0', { teeKey: 'white', holes: 9 }, 10_000);

    expect(Object.keys(after)).toHaveLength(COURSE_MEMORY_LIMIT);
    expect(after['id:course-0']).toEqual({ teeKey: 'white', holes: 9, usedAt: 10_000 });
    expect(after['id:course-1']).toBeDefined();
  });
});

describe('getRememberedTee', () => {
  const teeOptions = [{ key: 'back' }, { key: 'white' }, { key: 'yellow' }];

  it('returns the remembered tee when the course still offers it', () => {
    expect(getRememberedTee(ENTRY, teeOptions)).toBe('white');
  });

  it('returns nothing when the tee is gone from the course, so the default applies', () => {
    expect(getRememberedTee({ ...ENTRY, teeKey: 'orange' }, teeOptions)).toBeNull();
    expect(getRememberedTee(ENTRY, [])).toBeNull();
  });

  it('returns nothing for a course that was never remembered', () => {
    expect(getRememberedTee(undefined, teeOptions)).toBeNull();
  });
});

describe('storage', () => {
  it('versions the key and keeps one entry per user', () => {
    expect(getCourseMemoryStorageKey('user-1')).toBe('fairwayiq:course-memory:v1:user-1');
    expect(getCourseMemoryStorageKey('user-2')).not.toBe(getCourseMemoryStorageKey('user-1'));
  });

  it('round-trips the memory per user', async () => {
    await expect(saveCourseMemory('user-1', { 'id:a': ENTRY })).resolves.toBe(true);

    await expect(loadCourseMemory('user-1')).resolves.toEqual({ 'id:a': ENTRY });
  });

  it('never shows the memory of another user', async () => {
    await saveCourseMemory('user-1', { 'id:a': ENTRY });
    await saveCourseMemory('user-2', { 'id:b': { ...ENTRY, teeKey: 'red' } });

    await expect(loadCourseMemory('user-2')).resolves.toEqual({ 'id:b': { ...ENTRY, teeKey: 'red' } });
    await expect(loadCourseMemory('user-3')).resolves.toEqual({});
  });

  it('ignores a corrupted value', async () => {
    await AsyncStorage.setItem(getCourseMemoryStorageKey('user-1'), '{broken');

    await expect(loadCourseMemory('user-1')).resolves.toEqual({});
  });

  it('never throws when the storage is unavailable', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(loadCourseMemory('user-1')).resolves.toEqual({});
    await expect(saveCourseMemory('user-1', { 'id:a': ENTRY })).resolves.toBe(false);
  });
});
