import { subDays } from 'date-fns';

jest.mock('../lib/supabase', () => ({
  supabase: {},
}));

import { useDrillsStore } from './drills';

type Completion = { id: string; drill_id: string; completed_at: string };

const NOW = new Date('2026-01-10T12:00:00.000Z');

function setCompletions(completions: Completion[]) {
  useDrillsStore.setState({ completions });
}

function completionAt(daysAgo: number, drillId = 'drill-1'): Completion {
  return {
    id: `completion-${daysAgo}-${drillId}`,
    drill_id: drillId,
    completed_at: subDays(NOW, daysAgo).toISOString(),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  setCompletions([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getStreak', () => {
  it('returns 0 when there are no completions', () => {
    expect(useDrillsStore.getState().getStreak()).toBe(0);
  });

  it('returns 1 when only today has a completion', () => {
    setCompletions([completionAt(0)]);

    expect(useDrillsStore.getState().getStreak()).toBe(1);
  });

  it('counts an ongoing streak that has not yet been done today', () => {
    setCompletions([completionAt(1)]);

    expect(useDrillsStore.getState().getStreak()).toBe(1);
  });

  it('counts consecutive days including today', () => {
    setCompletions([completionAt(0), completionAt(1), completionAt(2)]);

    expect(useDrillsStore.getState().getStreak()).toBe(3);
  });

  it('stops counting at the first gap in the streak', () => {
    setCompletions([completionAt(0), completionAt(3)]);

    expect(useDrillsStore.getState().getStreak()).toBe(1);
  });

  it('returns 0 when the only completion is older than yesterday', () => {
    setCompletions([completionAt(2)]);

    expect(useDrillsStore.getState().getStreak()).toBe(0);
  });
});

describe('getTotalDone', () => {
  it('returns 0 when there are no completions', () => {
    expect(useDrillsStore.getState().getTotalDone()).toBe(0);
  });

  it('counts distinct drills, ignoring repeated completions of the same drill', () => {
    setCompletions([
      completionAt(0, 'putting'),
      completionAt(1, 'putting'),
      completionAt(0, 'chipping'),
    ]);

    expect(useDrillsStore.getState().getTotalDone()).toBe(2);
  });
});

describe('isDoneToday', () => {
  it('is true for a drill completed earlier today', () => {
    setCompletions([completionAt(0, 'putting')]);

    expect(useDrillsStore.getState().isDoneToday('putting')).toBe(true);
  });

  it('is false when the drill was last done yesterday', () => {
    setCompletions([completionAt(1, 'putting')]);

    expect(useDrillsStore.getState().isDoneToday('putting')).toBe(false);
  });
});
