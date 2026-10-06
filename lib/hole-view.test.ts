import type { RoundDraftHole } from '../types';
import type { CourseHoleDetail, GolfCourse } from './golf-courses';
import {
  HANDICAP_PLACEHOLDER,
  buildHoleViewData,
  describeHoleHandicap,
  resolveStrokeIndexes,
} from './hole-view';

jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const REAL_INDEXES = [7, 11, 3, 15, 1, 17, 9, 13, 5, 8, 12, 4, 16, 2, 18, 10, 14, 6];
const ALL_TEES = { back: 410, white: 390, yellow: 370, blue: 340, red: 310 };

function holes(handicapIndexes: Array<number | null>) {
  return handicapIndexes.map((handicapIndex, index) => ({ holeNumber: index + 1, handicapIndex }));
}

function catalogDetails(handicapIndexes: number[], distanceByTee: CourseHoleDetail['distanceByTee'] = ALL_TEES) {
  return handicapIndexes.map(
    (handicapIndex, index): CourseHoleDetail => ({
      holeNumber: index + 1,
      par: 4,
      handicapIndex,
      distanceByTee,
      unit: 'm',
    }),
  );
}

function makeCourse(holeDetails?: CourseHoleDetail[]): GolfCourse {
  return {
    id: 'test:course:1',
    name: 'Golf de Test',
    city: 'Testville',
    region: 'Occitanie',
    par18: 72,
    par9: 36,
    holes: 18,
    holeDetails,
  };
}

function makeScorecard(count: 9 | 18): RoundDraftHole[] {
  return Array.from({ length: count }, (_, index) => ({
    hole_number: index + 1,
    par: 4,
    score: 0,
    putts: 0,
    gir: false,
    fairway_hit: null,
    penalty: 0,
    completed: false,
  }));
}

describe('resolveStrokeIndexes', () => {
  it('keeps the stroke index of every hole when the catalog provides them', () => {
    const resolved = resolveStrokeIndexes(holes(REAL_INDEXES));

    expect(resolved.size).toBe(18);
    expect(resolved.get(1)).toBe(7);
    expect(resolved.get(5)).toBe(1);
  });

  it('keeps an index that happens to equal its hole number when no other hole shares it', () => {
    expect(REAL_INDEXES[2]).toBe(3);
    expect(resolveStrokeIndexes(holes(REAL_INDEXES)).get(3)).toBe(3);
  });

  it('treats a course whose indexes all equal the hole numbers as having none', () => {
    const filled = Array.from({ length: 18 }, (_, index) => index + 1);

    expect(resolveStrokeIndexes(holes(filled)).size).toBe(0);
  });

  it.each([
    ['null', null],
    ['zero', 0],
    ['negative', -2],
    ['above the maximum', 19],
    ['not an integer', 4.5],
    ['NaN', Number.NaN],
  ])('rejects an index that is %s', (_label, value) => {
    const resolved = resolveStrokeIndexes(holes([7, 11, 3, value, 1]));

    expect(resolved.has(4)).toBe(false);
    expect(resolved.get(1)).toBe(7);
  });

  it('drops a hole that carries its own number while another hole really has that index', () => {
    const indexes = [...REAL_INDEXES];
    indexes[1] = 2;
    const resolved = resolveStrokeIndexes(holes(indexes));

    expect(resolved.has(2)).toBe(false);
    expect(resolved.get(14)).toBe(2);
    expect(resolved.size).toBe(17);
  });

  it('keeps shared indexes that are not the hole number', () => {
    const indexes = [...REAL_INDEXES];
    indexes[2] = 7;
    const resolved = resolveStrokeIndexes(holes(indexes));

    expect(resolved.get(1)).toBe(7);
    expect(resolved.get(3)).toBe(7);
  });

  it('returns nothing for a course without holes', () => {
    expect(resolveStrokeIndexes([]).size).toBe(0);
  });
});

describe('describeHoleHandicap', () => {
  it('shows and speaks the stroke index', () => {
    expect(describeHoleHandicap(4)).toEqual({ text: '4', spoken: 'handicap 4' });
  });

  it('shows a dash and says it is missing when there is no stroke index', () => {
    expect(describeHoleHandicap(null)).toEqual({ text: HANDICAP_PLACEHOLDER, spoken: 'handicap non renseigné' });
    expect(HANDICAP_PLACEHOLDER).toBe('—');
  });
});

describe('buildHoleViewData handicap', () => {
  it('uses the catalog stroke index when the course provides it', () => {
    const views = buildHoleViewData({ course: makeCourse(catalogDetails(REAL_INDEXES)), scorecard: makeScorecard(18) });

    expect(views.map((view) => view.handicapIndex)).toEqual(REAL_INDEXES);
  });

  it('uses the built-in Golf National stroke indexes', () => {
    const course = { ...makeCourse(), id: 'golf-national' };
    const views = buildHoleViewData({ course, scorecard: makeScorecard(18) });

    expect(views[0].handicapIndex).toBe(4);
    expect(views[14].handicapIndex).toBe(1);
  });

  it('has no stroke index when the catalog filled the hole numbers in', () => {
    const filled = Array.from({ length: 18 }, (_, index) => index + 1);
    const views = buildHoleViewData({ course: makeCourse(catalogDetails(filled)), scorecard: makeScorecard(18) });

    expect(views.every((view) => view.handicapIndex === null)).toBe(true);
  });

  it('has no stroke index for a course without hole data, and never invents one', () => {
    const views = buildHoleViewData({ course: makeCourse(), scorecard: makeScorecard(18) });

    expect(views).toHaveLength(18);
    expect(views.every((view) => view.handicapIndex === null)).toBe(true);
    expect(views.every((view) => ['Exigeant', 'Équilibré', 'Accessible'].includes(view.difficultyLabel))).toBe(true);
  });

  it('has no stroke index without a course', () => {
    const views = buildHoleViewData({ course: null, scorecard: makeScorecard(9) });

    expect(views.every((view) => view.handicapIndex === null)).toBe(true);
  });

  it('keeps the catalog stroke indexes on a nine-hole round', () => {
    const views = buildHoleViewData({ course: makeCourse(catalogDetails(REAL_INDEXES)), scorecard: makeScorecard(9) });

    expect(views.map((view) => view.handicapIndex)).toEqual(REAL_INDEXES.slice(0, 9));
  });

  it('still flags generated distances as estimated', () => {
    const catalog = buildHoleViewData({ course: makeCourse(catalogDetails(REAL_INDEXES)), scorecard: makeScorecard(18) });
    const generated = buildHoleViewData({ course: makeCourse(), scorecard: makeScorecard(18) });

    expect(catalog.every((view) => view.distanceSource === 'catalog')).toBe(true);
    expect(generated.every((view) => view.distanceSource === 'generated')).toBe(true);
  });
});
