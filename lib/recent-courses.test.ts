import { RECENT_COURSES_LIMIT, buildRecentCourses, formatRecentCourseMeta, getCourseKey } from './recent-courses';

type Row = Parameters<typeof buildRecentCourses>[0][number];

function round(day: number, courseId: string | null, courseName: string | null): Row {
  return {
    course_id: courseId,
    course_name: courseName,
    played_at: new Date(Date.UTC(2026, 8, day, 10)).toISOString(),
  };
}

describe('getCourseKey', () => {
  it('keys a catalog course by its id, whatever its name', () => {
    expect(getCourseKey('saint-cloud', 'Golf de Saint-Cloud')).toBe('id:saint-cloud');
    expect(getCourseKey(' saint-cloud ', null)).toBe('id:saint-cloud');
  });

  it('keys a custom course by its normalized name', () => {
    expect(getCourseKey(null, 'Golf  de l’Été')).toBe('name:golf de l’ete');
    expect(getCourseKey('custom-mon-golf', 'Mon Golf')).toBe('name:mon golf');
  });

  it('has no key without an id or a name', () => {
    expect(getCourseKey(null, null)).toBeNull();
    expect(getCourseKey('', '   ')).toBeNull();
    expect(getCourseKey(undefined, undefined)).toBeNull();
  });
});

describe('buildRecentCourses', () => {
  it('returns nothing without rounds', () => {
    expect(buildRecentCourses([])).toEqual([]);
  });

  it('groups the rounds of a catalog course by id and counts them', () => {
    const courses = buildRecentCourses([
      round(20, 'saint-cloud', 'Golf de Saint-Cloud'),
      round(10, 'saint-cloud', 'Golf de Saint-Cloud'),
      round(5, 'saint-cloud', 'Golf de Saint-Cloud'),
    ]);

    expect(courses).toEqual([
      { key: 'id:saint-cloud', courseId: 'saint-cloud', name: 'Golf de Saint-Cloud', roundCount: 3 },
    ]);
  });

  it('lists the most recently played course first', () => {
    const courses = buildRecentCourses([
      round(2, 'a', 'Golf A'),
      round(25, 'b', 'Golf B'),
      round(9, 'c', 'Golf C'),
      round(1, 'a', 'Golf A'),
    ]);

    expect(courses.map((course) => course.courseId)).toEqual(['b', 'c', 'a']);
  });

  it('does not depend on the order of the rounds', () => {
    const rounds = [round(2, 'a', 'Golf A'), round(25, 'b', 'Golf B'), round(9, 'c', 'Golf C')];

    expect(buildRecentCourses([...rounds].reverse())).toEqual(buildRecentCourses(rounds));
  });

  it('uses the name of the latest round when a course was renamed', () => {
    const courses = buildRecentCourses([
      round(3, 'a', 'Ancien nom'),
      round(20, 'a', 'Nouveau nom'),
    ]);

    expect(courses).toEqual([{ key: 'id:a', courseId: 'a', name: 'Nouveau nom', roundCount: 2 }]);
  });

  it('falls back to the name for custom courses and merges spelling variants', () => {
    const courses = buildRecentCourses([
      round(20, null, 'Golf du Lac'),
      round(12, null, ' golf  du lac '),
      round(8, null, 'Golf du Lac'),
    ]);

    expect(courses).toEqual([{ key: 'name:golf du lac', courseId: null, name: 'Golf du Lac', roundCount: 3 }]);
  });

  it('treats a custom- id as a custom course', () => {
    const courses = buildRecentCourses([round(20, 'custom-golf-du-lac', 'Golf du Lac'), round(10, null, 'Golf du Lac')]);

    expect(courses).toEqual([{ key: 'name:golf du lac', courseId: null, name: 'Golf du Lac', roundCount: 2 }]);
  });

  it('keeps a catalog course and a custom course of the same name apart', () => {
    const courses = buildRecentCourses([round(20, 'saint-cloud', 'Golf de Saint-Cloud'), round(10, null, 'Golf de Saint-Cloud')]);

    expect(courses.map((course) => course.key)).toEqual(['id:saint-cloud', 'name:golf de saint-cloud']);
  });

  it('ignores rounds played without a course', () => {
    const courses = buildRecentCourses([round(20, null, null), round(19, null, '   '), round(18, 'a', 'Golf A')]);

    expect(courses.map((course) => course.courseId)).toEqual(['a']);
  });

  it('counts a round saved without a name under its course and takes the name from another one', () => {
    const courses = buildRecentCourses([round(20, 'a', null), round(10, 'a', 'Golf A')]);

    expect(courses).toEqual([{ key: 'id:a', courseId: 'a', name: 'Golf A', roundCount: 2 }]);
  });

  it('skips a course that never had a name', () => {
    expect(buildRecentCourses([round(20, 'a', null), round(10, 'a', ' ')])).toEqual([]);
  });

  it('keeps the 5 most recent courses by default', () => {
    const rounds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, index) => round(index + 1, id, `Golf ${id}`));

    const courses = buildRecentCourses(rounds);

    expect(RECENT_COURSES_LIMIT).toBe(5);
    expect(courses.map((course) => course.courseId)).toEqual(['g', 'f', 'e', 'd', 'c']);
  });

  it('honours a custom limit', () => {
    const rounds = ['a', 'b', 'c'].map((id, index) => round(index + 1, id, `Golf ${id}`));

    expect(buildRecentCourses(rounds, 2).map((course) => course.courseId)).toEqual(['c', 'b']);
    expect(buildRecentCourses(rounds, 0)).toEqual([]);
  });

  it('breaks a tie on the day by round count, then by name', () => {
    const courses = buildRecentCourses([
      round(10, 'b', 'Golf B'),
      round(10, 'a', 'Golf A'),
      round(10, 'c', 'Golf C'),
      round(10, 'c', 'Golf C'),
    ]);

    expect(courses.map((course) => course.courseId)).toEqual(['c', 'a', 'b']);
  });

  it('puts a round with an unreadable date last instead of failing', () => {
    const courses = buildRecentCourses([
      { course_id: 'broken', course_name: 'Golf Broken', played_at: 'not a date' },
      round(3, 'a', 'Golf A'),
    ]);

    expect(courses.map((course) => course.courseId)).toEqual(['a', 'broken']);
  });
});

describe('formatRecentCourseMeta', () => {
  it('counts the rounds in French, singular and plural', () => {
    expect(formatRecentCourseMeta(null, 1)).toBe('1 round');
    expect(formatRecentCourseMeta(null, 3)).toBe('3 rounds');
  });

  it('puts the city first when it is known', () => {
    expect(formatRecentCourseMeta('Saint-Cloud', 3)).toBe('Saint-Cloud · 3 rounds');
    expect(formatRecentCourseMeta('  ', 2)).toBe('2 rounds');
    expect(formatRecentCourseMeta(undefined, 2)).toBe('2 rounds');
  });
});
