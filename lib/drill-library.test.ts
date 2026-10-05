import {
  DRILLS,
  DRILL_CATEGORY_LABELS,
  DRILL_DIFFICULTY_LABELS,
  getDailyFocusDrill,
  getRecommendedDrills,
} from './drill-library';
import { MAX_RESULT_ATTEMPTS } from './drill-results';

const CATEGORIES = Object.keys(DRILL_CATEGORY_LABELS);
const DIFFICULTIES = Object.keys(DRILL_DIFFICULTY_LABELS);

const mentions = (text: string, value: number) => new RegExp(`(?<!\\d)${value}(?!\\d)`).test(text);

describe('drill library', () => {
  it('holds at least 40 drills', () => {
    expect(DRILLS.length).toBeGreaterThanOrEqual(40);
  });

  it('has unique ids and unique titles', () => {
    expect(new Set(DRILLS.map((drill) => drill.id)).size).toBe(DRILLS.length);
    expect(new Set(DRILLS.map((drill) => drill.title)).size).toBe(DRILLS.length);
  });

  it('keeps the ids of the original drills', () => {
    const ids = DRILLS.map((drill) => drill.id);

    for (let id = 1; id <= 15; id++) {
      expect(ids).toContain(String(id));
    }
  });

  it('only uses known categories and levels', () => {
    for (const drill of DRILLS) {
      expect(CATEGORIES).toContain(drill.category);
      expect(DIFFICULTIES).toContain(drill.difficulty);
    }
  });

  it('gives every category at least 5 drills', () => {
    for (const category of CATEGORIES) {
      expect(DRILLS.filter((drill) => drill.category === category).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('offers every level in every category', () => {
    for (const category of CATEGORIES) {
      const levels = new Set(DRILLS.filter((drill) => drill.category === category).map((drill) => drill.difficulty));

      expect(levels).toEqual(new Set(DIFFICULTIES));
    }
  });

  it('has a measurable target on every drill', () => {
    for (const drill of DRILLS) {
      expect(Number.isInteger(drill.attempts)).toBe(true);
      expect(drill.attempts).toBeGreaterThan(0);
      expect(drill.attempts).toBeLessThanOrEqual(MAX_RESULT_ATTEMPTS);
      expect(Number.isInteger(drill.success_threshold)).toBe(true);
      expect(drill.success_threshold).toBeGreaterThan(0);
      expect(drill.success_threshold).toBeLessThanOrEqual(drill.attempts);
    }
  });

  it('writes the success rule with the same numbers as the target', () => {
    for (const drill of DRILLS) {
      expect(drill.success_rule.trim()).not.toBe('');
      expect(mentions(drill.success_rule, drill.success_threshold)).toBe(true);
      expect(mentions(drill.success_rule, drill.attempts)).toBe(true);
    }
  });

  it('has a duration, a title and a description on every drill', () => {
    for (const drill of DRILLS) {
      expect(drill.duration_minutes).toBeGreaterThan(0);
      expect(drill.title.trim()).not.toBe('');
      expect(drill.description.trim()).not.toBe('');
    }
  });

  it('explains every drill in 3 to 5 steps', () => {
    for (const drill of DRILLS) {
      expect(drill.steps.length).toBeGreaterThanOrEqual(3);
      expect(drill.steps.length).toBeLessThanOrEqual(5);
      expect(drill.steps.every((step) => step.trim() !== '')).toBe(true);
    }
  });

  it('lists the equipment of every drill', () => {
    for (const drill of DRILLS) {
      expect(drill.equipment.length).toBeGreaterThan(0);
      expect(drill.equipment.every((item) => item.trim() !== '')).toBe(true);
    }
  });

  it('only links to YouTube or nothing', () => {
    for (const drill of DRILLS) {
      expect(drill.youtube_url === null || drill.youtube_url.startsWith('https://www.youtube.com/watch?v=')).toBe(true);
    }
  });
});

describe('recommendations with the full library', () => {
  it('returns every drill without categories and only the matching ones otherwise', () => {
    expect(getRecommendedDrills([])).toHaveLength(DRILLS.length);
    expect(getRecommendedDrills(['putting']).every((drill) => drill.category === 'putting')).toBe(true);
    expect(getRecommendedDrills(['putting', 'mental']).length).toBeGreaterThan(getRecommendedDrills(['putting']).length);
  });

  it('rotates the daily focus drill over the whole recommended pool', () => {
    const picked = new Set<string>();

    for (let day = 1; day <= 28; day++) {
      const drill = getDailyFocusDrill({ categories: ['putting'], completions: [], now: new Date(2026, 9, day, 9, 0) });

      expect(drill?.category).toBe('putting');
      picked.add(drill!.id);
    }

    expect(picked.size).toBe(getRecommendedDrills(['putting']).length);
  });

  it('skips a drill already done today', () => {
    const now = new Date(2026, 9, 7, 9, 0);
    const first = getDailyFocusDrill({ categories: ['driving'], completions: [], now })!;
    const next = getDailyFocusDrill({
      categories: ['driving'],
      completions: [{ drill_id: first.id, completed_at: now.toISOString() }],
      now,
    })!;

    expect(next.id).not.toBe(first.id);
    expect(next.category).toBe('driving');
  });
});
