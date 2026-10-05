import { subDays } from 'date-fns';

const mockFrom = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { useDrillsStore } from './drills';

type Completion = {
  id: string;
  drill_id: string;
  completed_at: string;
  result_made?: number | null;
  result_attempts?: number | null;
};

const NOW = new Date('2026-01-10T12:00:00.000Z');

function setCompletions(completions: Completion[]) {
  useDrillsStore.setState({ completions });
}

function completionAt(daysAgo: number, drillId = 'drill-1', result?: { made: number; attempts: number }): Completion {
  return {
    id: `completion-${daysAgo}-${drillId}`,
    drill_id: drillId,
    completed_at: subDays(NOW, daysAgo).toISOString(),
    ...(result ? { result_made: result.made, result_attempts: result.attempts } : {}),
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

  it('keeps the original insert payload when no result is given', async () => {
    const insert = mockInsertReturning({ data: completionAt(0, 'putting'), error: null });

    await useDrillsStore.getState().markDone('putting', 'user-1');

    expect(insert).toHaveBeenCalledWith({ drill_id: 'putting', user_id: 'user-1' });
  });

  it('keeps the original insert payload when the result is skipped', async () => {
    const insert = mockInsertReturning({ data: completionAt(0, 'putting'), error: null });

    await useDrillsStore.getState().markDone('putting', 'user-1', null);

    expect(insert).toHaveBeenCalledWith({ drill_id: 'putting', user_id: 'user-1' });
  });

  it('stores the result with the completion', async () => {
    const result = { made: 7, attempts: 10 };
    const insert = mockInsertReturning({ data: completionAt(0, 'putting', result), error: null });

    await useDrillsStore.getState().markDone('putting', 'user-1', result);

    expect(insert).toHaveBeenCalledWith({
      drill_id: 'putting',
      user_id: 'user-1',
      result_made: 7,
      result_attempts: 10,
    });
    expect(useDrillsStore.getState().completions[0]).toMatchObject({ result_made: 7, result_attempts: 10 });
    expect(useDrillsStore.getState().getLastResult('putting')).toEqual(result);
  });

  it('rejects an invalid result without calling the database, and can be retried', async () => {
    const insert = mockInsertReturning({ data: completionAt(0, 'putting'), error: null });

    await expect(useDrillsStore.getState().markDone('putting', 'user-1', { made: 11, attempts: 10 })).rejects.toThrow(
      'Résultat invalide.'
    );
    await expect(useDrillsStore.getState().markDone('putting', 'user-1', { made: 1, attempts: 0 })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();

    await useDrillsStore.getState().markDone('putting', 'user-1');

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('inserts only once when the result is saved twice while the request is pending', async () => {
    const pending = deferred<Result>();
    const insert = mockInsertReturning(pending.promise);
    const result = { made: 7, attempts: 10 };

    const first = useDrillsStore.getState().markDone('putting', 'user-1', result);
    const second = useDrillsStore.getState().markDone('putting', 'user-1', result);
    pending.resolve({ data: completionAt(0, 'putting', result), error: null });
    await Promise.all([first, second]);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(useDrillsStore.getState().completions).toHaveLength(1);
  });

  it('does not add a result to the store of the next user after a reset', async () => {
    const pending = deferred<Result>();
    mockInsertReturning(pending.promise);
    const result = { made: 7, attempts: 10 };

    const marking = useDrillsStore.getState().markDone('putting', 'user-1', result);
    useDrillsStore.getState().reset();
    pending.resolve({ data: completionAt(0, 'putting', result), error: null });
    await marking;

    expect(useDrillsStore.getState().completions).toEqual([]);
    expect(useDrillsStore.getState().getLastResult('putting')).toBeNull();
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

describe('results', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    useDrillsStore.getState().reset();
  });

  it('loads the results stored with the completions', async () => {
    const range = jest.fn().mockResolvedValueOnce({
      data: [completionAt(0, 'putting', { made: 7, attempts: 10 }), completionAt(2, 'putting')],
      error: null,
    });
    mockFrom.mockReturnValue({ select: () => ({ order: () => ({ range }) }) });

    await useDrillsStore.getState().fetchCompletions();

    expect(useDrillsStore.getState().getLastResult('putting')).toEqual({ made: 7, attempts: 10 });
  });

  it('exposes the last result, the best result and the success rate of a drill', () => {
    setCompletions([
      completionAt(0, 'putting', { made: 7, attempts: 10 }),
      completionAt(1, 'putting'),
      completionAt(3, 'putting', { made: 9, attempts: 10 }),
      completionAt(5, 'putting', { made: 4, attempts: 10 }),
      completionAt(0, 'chipping', { made: 1, attempts: 2 }),
    ]);
    const { getLastResult, getBestResult, getSuccessRate } = useDrillsStore.getState();

    expect(getLastResult('putting')).toEqual({ made: 7, attempts: 10 });
    expect(getBestResult('putting')).toEqual({ made: 9, attempts: 10 });
    expect(getSuccessRate('putting')).toBeCloseTo(20 / 30);
  });

  it('has nothing to show for a drill without result', () => {
    setCompletions([completionAt(0, 'putting')]);
    const { getLastResult, getBestResult, getSuccessRate } = useDrillsStore.getState();

    expect(getLastResult('putting')).toBeNull();
    expect(getBestResult('putting')).toBeNull();
    expect(getSuccessRate('putting')).toBeNull();
    expect(getLastResult('unknown')).toBeNull();
  });

  it('keeps the streak and the total unaffected by results', () => {
    setCompletions([
      completionAt(0, 'putting', { made: 7, attempts: 10 }),
      completionAt(1, 'putting'),
      completionAt(2, 'chipping', { made: 3, attempts: 10 }),
    ]);

    expect(useDrillsStore.getState().getStreak()).toBe(3);
    expect(useDrillsStore.getState().getTotalDone()).toBe(2);
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
