import { subDays } from 'date-fns';

const mockFrom = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
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

type Result = { data: unknown; error: { message: string } | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockInsertReturning(...results: Array<Result | Promise<Result>>) {
  const insert = jest.fn();
  const single = jest.fn();
  for (const result of results) {
    single.mockReturnValueOnce(Promise.resolve(result));
  }
  insert.mockReturnValue({ select: () => ({ single }) });
  mockFrom.mockReturnValue({ insert });
  return insert;
}

describe('markDone', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    useDrillsStore.getState().reset();
  });

  it('records a completion and puts it first', async () => {
    mockInsertReturning({ data: completionAt(0, 'putting'), error: null });

    await useDrillsStore.getState().markDone('putting', 'user-1');

    expect(mockFrom).toHaveBeenCalledWith('drill_completions');
    expect(useDrillsStore.getState().completions).toHaveLength(1);
  });

  it('inserts only once when the same drill is tapped twice while the request is pending', async () => {
    const pending = deferred<Result>();
    const insert = mockInsertReturning(pending.promise);

    const first = useDrillsStore.getState().markDone('putting', 'user-1');
    const second = useDrillsStore.getState().markDone('putting', 'user-1');
    pending.resolve({ data: completionAt(0, 'putting'), error: null });
    await Promise.all([first, second]);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(useDrillsStore.getState().completions).toHaveLength(1);
  });

  it('does not block a different drill', async () => {
    const insert = mockInsertReturning(
      { data: completionAt(0, 'putting'), error: null },
      { data: completionAt(0, 'chipping'), error: null }
    );

    await Promise.all([
      useDrillsStore.getState().markDone('putting', 'user-1'),
      useDrillsStore.getState().markDone('chipping', 'user-1'),
    ]);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(useDrillsStore.getState().completions).toHaveLength(2);
  });

  it('accepts a new completion once the previous request has finished', async () => {
    const insert = mockInsertReturning(
      { data: completionAt(1, 'putting'), error: null },
      { data: completionAt(0, 'putting'), error: null }
    );

    await useDrillsStore.getState().markDone('putting', 'user-1');
    await useDrillsStore.getState().markDone('putting', 'user-1');

    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('rejects every caller on failure and can be retried afterwards', async () => {
    const pending = deferred<Result>();
    const insert = mockInsertReturning(pending.promise, { data: completionAt(0, 'putting'), error: null });

    const first = useDrillsStore.getState().markDone('putting', 'user-1');
    const second = useDrillsStore.getState().markDone('putting', 'user-1');
    pending.resolve({ data: null, error: { message: 'rls' } });

    await expect(first).rejects.toEqual({ message: 'rls' });
    await expect(second).rejects.toEqual({ message: 'rls' });
    await useDrillsStore.getState().markDone('putting', 'user-1');

    expect(insert).toHaveBeenCalledTimes(2);
    expect(useDrillsStore.getState().completions).toHaveLength(1);
  });

  it('does not add the completion to the store of the next user after a reset', async () => {
    const pending = deferred<Result>();
    mockInsertReturning(pending.promise);

    const marking = useDrillsStore.getState().markDone('putting', 'user-1');
    useDrillsStore.getState().reset();
    pending.resolve({ data: completionAt(0, 'putting'), error: null });
    await marking;

    expect(useDrillsStore.getState().completions).toEqual([]);
  });
});

describe('fetchCompletions', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    useDrillsStore.getState().reset();
  });

  function mockPages(...pages: Array<Result | Promise<Result>>) {
    const range = jest.fn();
    for (const page of pages) {
      range.mockReturnValueOnce(Promise.resolve(page));
    }
    mockFrom.mockReturnValue({ select: () => ({ order: () => ({ range }) }) });
    return range;
  }

  it('loads the completions', async () => {
    mockPages({ data: [completionAt(0)], error: null });

    await useDrillsStore.getState().fetchCompletions();

    expect(useDrillsStore.getState().completions).toHaveLength(1);
  });

  it('drops a response that lands after a reset', async () => {
    const pending = deferred<Result>();
    mockPages(pending.promise);

    const fetching = useDrillsStore.getState().fetchCompletions();
    useDrillsStore.getState().reset();
    pending.resolve({ data: [completionAt(0)], error: null });
    await fetching;

    expect(useDrillsStore.getState().completions).toEqual([]);
  });
});

describe('reset', () => {
  it('clears completions and recommended categories', () => {
    useDrillsStore.setState({ completions: [completionAt(0)], recommendedCategories: ['putting'] });

    useDrillsStore.getState().reset();

    expect(useDrillsStore.getState().completions).toEqual([]);
    expect(useDrillsStore.getState().recommendedCategories).toEqual([]);
  });
});
