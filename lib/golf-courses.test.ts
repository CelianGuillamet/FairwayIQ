import {
  COURSE_CATALOG_TIMEOUT_MS,
  COURSE_SEARCH_UNAVAILABLE_MESSAGE,
  getCourseById,
  searchCourses,
  searchCoursesWithStatus,
} from './golf-courses';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;

const remoteCourse = {
  id: 'golfapi:course:42',
  name: 'Golf de Test Remote',
  city: 'Testville',
  region: 'Occitanie',
  par18: 71,
  par9: 36,
  holes: 18,
};

describe('searchCoursesWithStatus', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns nothing without calling the catalog for queries under 2 characters', async () => {
    await expect(searchCoursesWithStatus(' a ')).resolves.toEqual({ courses: [], remoteUnavailable: false });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('merges remote courses with the local catalog when the catalog answers', async () => {
    invoke.mockResolvedValue({ data: { courses: [remoteCourse] }, error: null });

    const outcome = await searchCoursesWithStatus('golf de test');

    expect(outcome.remoteUnavailable).toBe(false);
    expect(outcome.courses.map((course) => course.id)).toContain('golfapi:course:42');
  });

  it('falls back to the local catalog and flags the search as unavailable on an edge function error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } });

    const outcome = await searchCoursesWithStatus('golf national');

    expect(outcome.remoteUnavailable).toBe(true);
    expect(outcome.courses.map((course) => course.id)).toContain('golf-national');
  });

  it('falls back to the local catalog when the call rejects', async () => {
    invoke.mockRejectedValue(new Error('Network request failed'));

    const outcome = await searchCoursesWithStatus('deauville');

    expect(outcome.remoteUnavailable).toBe(true);
    expect(outcome.courses.some((course) => course.id === 'deauville')).toBe(true);
  });

  it('falls back to the local catalog when the call hangs past the timeout', async () => {
    jest.useFakeTimers();
    invoke.mockImplementation(() => new Promise(() => {}));

    const promise = searchCoursesWithStatus('saint-cloud');

    await jest.advanceTimersByTimeAsync(COURSE_CATALOG_TIMEOUT_MS);
    const outcome = await promise;

    expect(outcome.remoteUnavailable).toBe(true);
    expect(outcome.courses.some((course) => course.id === 'saint-cloud')).toBe(true);
  });

  it('keeps searchCourses returning the plain list', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'down' } });

    const courses = await searchCourses('golf national');

    expect(Array.isArray(courses)).toBe(true);
    expect(courses.some((course) => course.id === 'golf-national')).toBe(true);
  });

  it('exposes a French unavailable message', () => {
    expect(COURSE_SEARCH_UNAVAILABLE_MESSAGE).toMatch(/indisponible/);
  });
});

describe('getCourseById', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a bundled course without calling the catalog', async () => {
    const course = await getCourseById('golf-national');

    expect(course?.id).toBe('golf-national');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('returns null instead of hanging when the catalog does not answer in time', async () => {
    jest.useFakeTimers();
    invoke.mockImplementation(() => new Promise(() => {}));

    const promise = getCourseById('golfapi:course:never-answers');

    await jest.advanceTimersByTimeAsync(COURSE_CATALOG_TIMEOUT_MS);

    await expect(promise).resolves.toBeNull();
  });

  it('returns null when the catalog errors for an unknown course', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'invalid id' } });

    await expect(getCourseById('golfapi:course:missing')).resolves.toBeNull();
  });
});
