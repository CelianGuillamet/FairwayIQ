import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'fairwayiq:course-memory:v1:';

export const COURSE_MEMORY_LIMIT = 50;

export type CourseChoice = {
  teeKey: string;
  holes: 9 | 18;
};

export type CourseMemoryEntry = CourseChoice & {
  usedAt: number;
};

export type CourseMemory = Record<string, CourseMemoryEntry>;

export function getCourseMemoryStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isEntry(value: unknown): value is CourseMemoryEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return typeof entry.teeKey === 'string'
    && entry.teeKey.trim().length > 0
    && (entry.holes === 9 || entry.holes === 18)
    && typeof entry.usedAt === 'number'
    && Number.isFinite(entry.usedAt);
}

function newest(memory: CourseMemory, limit: number) {
  return Object.entries(memory)
    .sort(([, left], [, right]) => right.usedAt - left.usedAt)
    .slice(0, Math.max(0, limit));
}

export function parseCourseMemory(raw: string | null): CourseMemory {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const valid: CourseMemory = Object.fromEntries(
      Object.entries(parsed).filter((pair): pair is [string, CourseMemoryEntry] => isEntry(pair[1]))
    );

    return Object.fromEntries(newest(valid, COURSE_MEMORY_LIMIT));
  } catch {
    return {};
  }
}

export function rememberCourseChoice(memory: CourseMemory, key: string, choice: CourseChoice, usedAt: number): CourseMemory {
  const { [key]: _replaced, ...others } = memory;

  return Object.fromEntries([
    ...newest(others, COURSE_MEMORY_LIMIT - 1),
    [key, { teeKey: choice.teeKey, holes: choice.holes, usedAt }],
  ]);
}

export function getRememberedTee(entry: CourseMemoryEntry | undefined, teeOptions: readonly { key: string }[]) {
  return entry && teeOptions.some((teeOption) => teeOption.key === entry.teeKey) ? entry.teeKey : null;
}

export async function loadCourseMemory(userId: string): Promise<CourseMemory> {
  try {
    return parseCourseMemory(await AsyncStorage.getItem(getCourseMemoryStorageKey(userId)));
  } catch {
    return {};
  }
}

export async function saveCourseMemory(userId: string, memory: CourseMemory) {
  try {
    await AsyncStorage.setItem(getCourseMemoryStorageKey(userId), JSON.stringify(memory));
    return true;
  } catch {
    return false;
  }
}
