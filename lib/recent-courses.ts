import type { Round } from '../types';

export const RECENT_COURSES_LIMIT = 5;

const CUSTOM_COURSE_PREFIX = 'custom-';

export type RecentCourse = {
  key: string;
  courseId: string | null;
  name: string;
  roundCount: number;
};

type CourseRound = Pick<Round, 'course_id' | 'course_name' | 'played_at'>;

type Group = {
  key: string;
  courseId: string | null;
  name: string | null;
  nameAt: number;
  lastAt: number;
  roundCount: number;
};

function normalizeName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCourseKey(courseId: string | null | undefined, name: string | null | undefined) {
  const id = courseId?.trim();

  if (id && !id.startsWith(CUSTOM_COURSE_PREFIX)) {
    return `id:${id}`;
  }

  const normalizedName = normalizeName(name ?? '');
  return normalizedName ? `name:${normalizedName}` : null;
}

export function buildRecentCourses(rounds: readonly CourseRound[], limit = RECENT_COURSES_LIMIT): RecentCourse[] {
  const groups = new Map<string, Group>();

  for (const round of rounds) {
    const key = getCourseKey(round.course_id, round.course_name);

    if (!key) {
      continue;
    }

    const parsedAt = Date.parse(round.played_at);
    const playedAt = Number.isNaN(parsedAt) ? 0 : parsedAt;
    const name = round.course_name?.trim() || null;
    const group = groups.get(key) ?? {
      key,
      courseId: key.startsWith('id:') ? key.slice(3) : null,
      name: null,
      nameAt: -1,
      lastAt: -1,
      roundCount: 0,
    };

    group.roundCount += 1;
    group.lastAt = Math.max(group.lastAt, playedAt);

    if (name && playedAt > group.nameAt) {
      group.name = name;
      group.nameAt = playedAt;
    }

    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group): group is Group & { name: string } => group.name !== null)
    .sort((left, right) => (
      right.lastAt - left.lastAt
      || right.roundCount - left.roundCount
      || left.name.localeCompare(right.name, 'fr')
    ))
    .slice(0, Math.max(0, limit))
    .map(({ key, courseId, name, roundCount }) => ({ key, courseId, name, roundCount }));
}

export function formatRecentCourseMeta(city: string | null | undefined, roundCount: number) {
  const rounds = `${roundCount} ${roundCount > 1 ? 'rounds' : 'round'}`;
  const place = city?.trim();

  return place ? `${place} · ${rounds}` : rounds;
}
