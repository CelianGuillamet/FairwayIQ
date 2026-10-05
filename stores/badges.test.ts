const mockFrom = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { useBadgesStore } from './badges';

type Result = { data: unknown; error: { code?: string; message: string } | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockSelect(...results: Array<Result | Promise<Result>>) {
  const select = jest.fn();
  for (const result of results) {
    select.mockReturnValueOnce(Promise.resolve(result));
  }
  mockFrom.mockReturnValue({ select });
  return select;
}

function mockUpsert(...results: Array<Result | Promise<Result>>) {
  const upsert = jest.fn();
  for (const result of results) {
    upsert.mockReturnValueOnce(Promise.resolve(result));
  }
  upsert.mockResolvedValue({ data: null, error: null });
  mockFrom.mockReturnValue({ upsert });
  return upsert;
}

function loadedStore(earned: Record<string, string> = {}, userId = 'user-1') {
  useBadgesStore.setState({ userId, earned, loaded: true });
}

const ROWS = [
  { badge_id: 'first_round', earned_at: '2026-01-02T10:00:00Z' },
  { badge_id: 'break_100', earned_at: '2026-02-03T10:00:00Z' },
  { badge_id: 'removed_badge', earned_at: '2026-02-03T10:00:00Z' },
];

let warn: jest.SpyInstance;

beforeEach(() => {
  mockFrom.mockReset();
  useBadgesStore.getState().reset();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

describe('load', () => {
  it('loads the earned badges with their dates and ignores ids missing from the catalog', async () => {
    const select = mockSelect({ data: ROWS, error: null });

    await expect(useBadgesStore.getState().load('user-1')).resolves.toBe(true);

    expect(mockFrom).toHaveBeenCalledWith('user_badges');
    expect(select).toHaveBeenCalledTimes(1);
    expect(useBadgesStore.getState()).toMatchObject({
      userId: 'user-1',
      loaded: true,
      loading: false,
      earned: { first_round: '2026-01-02T10:00:00Z', break_100: '2026-02-03T10:00:00Z' },
    });
  });

  it('loads once: a second call for the same user does not query again', async () => {
    const select = mockSelect({ data: ROWS, error: null });

    await useBadgesStore.getState().load('user-1');
    await expect(useBadgesStore.getState().load('user-1')).resolves.toBe(true);

    expect(select).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent calls', async () => {
    const pending = deferred<Result>();
    const select = jest.fn().mockReturnValue(pending.promise);
    mockFrom.mockReturnValue({ select });

    const first = useBadgesStore.getState().load('user-1');
    const second = useBadgesStore.getState().load('user-1');
    expect(useBadgesStore.getState().loading).toBe(true);
    pending.resolve({ data: [], error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load without throwing, logs only the error code, and can be retried', async () => {
    mockSelect({ data: null, error: { code: 'PGRST301', message: 'JWT expired for user-1 with secret' } });

    await expect(useBadgesStore.getState().load('user-1')).resolves.toBe(false);

    expect(useBadgesStore.getState()).toMatchObject({ loaded: false, loading: false, earned: {} });
    expect(warn).toHaveBeenCalledWith('[badges] load failed', 'PGRST301');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');

    const select = mockSelect({ data: ROWS, error: null });
    await expect(useBadgesStore.getState().load('user-1')).resolves.toBe(true);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('reports a thrown request as a failed load', async () => {
    mockFrom.mockReturnValue({ select: () => Promise.reject(new TypeError('Network request failed')) });

    await expect(useBadgesStore.getState().load('user-1')).resolves.toBe(false);

    expect(warn).toHaveBeenCalledWith('[badges] load failed', 'TypeError');
    expect(useBadgesStore.getState().loaded).toBe(false);
  });

  it('drops a response that lands after a reset', async () => {
    const pending = deferred<Result>();
    mockFrom.mockReturnValue({ select: () => pending.promise });

    const loading = useBadgesStore.getState().load('user-1');
    useBadgesStore.getState().reset();
    pending.resolve({ data: ROWS, error: null });

    await expect(loading).resolves.toBe(false);
    expect(useBadgesStore.getState()).toMatchObject({ userId: null, loaded: false, earned: {} });
  });
});

describe('award', () => {
  it('does nothing before the earned badges are loaded', async () => {
    const upsert = mockUpsert();

    await expect(useBadgesStore.getState().award(['first_round'])).resolves.toEqual([]);

    expect(upsert).not.toHaveBeenCalled();
    expect(useBadgesStore.getState().queue).toEqual([]);
  });

  it('inserts with ignore-duplicates semantics on the unique pair', async () => {
    const upsert = mockUpsert();
    loadedStore();

    await useBadgesStore.getState().award(['first_round']);

    expect(mockFrom).toHaveBeenCalledWith('user_badges');
    expect(upsert).toHaveBeenCalledWith(
      [{ user_id: 'user-1', badge_id: 'first_round', earned_at: expect.any(String) }],
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    );
  });

  it('updates the local state and queues the celebration before the insert answers', async () => {
    const pending = deferred<Result>();
    const upsert = jest.fn().mockReturnValue(pending.promise);
    mockFrom.mockReturnValue({ upsert });
    loadedStore();

    const awarding = useBadgesStore.getState().award(['first_round', 'break_100']);

    expect(useBadgesStore.getState().earned).toEqual({
      first_round: expect.any(String),
      break_100: expect.any(String),
    });
    expect(useBadgesStore.getState().queue).toEqual(['first_round', 'break_100']);

    pending.resolve({ data: null, error: null });
    await expect(awarding).resolves.toEqual(['first_round', 'break_100']);
  });

  it('skips badges already earned, unknown ids and repeated ids', async () => {
    const upsert = mockUpsert();
    loadedStore({ first_round: '2026-01-02T10:00:00Z' });

    const awarded = await useBadgesStore.getState().award(['first_round', 'rounds_5', 'rounds_5', 'nope' as any]);

    expect(awarded).toEqual(['rounds_5']);
    expect(upsert.mock.calls[0][0]).toHaveLength(1);
    expect(upsert.mock.calls[0][0][0]).toMatchObject({ badge_id: 'rounds_5' });
    expect(useBadgesStore.getState().earned.first_round).toBe('2026-01-02T10:00:00Z');
    expect(useBadgesStore.getState().queue).toEqual(['rounds_5']);
  });

  it('makes no request when everything is already earned (idempotent)', async () => {
    const upsert = mockUpsert();
    loadedStore({ first_round: '2026-01-02T10:00:00Z' });

    await expect(useBadgesStore.getState().award(['first_round'])).resolves.toEqual([]);

    expect(upsert).not.toHaveBeenCalled();
    expect(useBadgesStore.getState().queue).toEqual([]);
  });

  it('inserts an overlapping badge only once when two awards run at the same time', async () => {
    const pending = deferred<Result>();
    const upsert = jest.fn().mockReturnValue(pending.promise);
    mockFrom.mockReturnValue({ upsert });
    loadedStore();

    const first = useBadgesStore.getState().award(['first_round']);
    const second = useBadgesStore.getState().award(['first_round', 'break_100']);
    pending.resolve({ data: null, error: null });
    await Promise.all([first, second]);

    const inserted = upsert.mock.calls.flatMap(([rows]) => rows.map((row: { badge_id: string }) => row.badge_id));
    expect(inserted.sort()).toEqual(['break_100', 'first_round']);
    expect(useBadgesStore.getState().queue).toEqual(['first_round', 'break_100']);
  });

  it('does not queue a celebration for a silent award, and keeps the given dates', async () => {
    const upsert = mockUpsert();
    loadedStore();

    await useBadgesStore.getState().award(['first_round', 'rounds_5'], {
      celebrate: false,
      earnedAt: { first_round: '2025-05-01T08:00:00.000Z' },
    });

    expect(useBadgesStore.getState().queue).toEqual([]);
    expect(useBadgesStore.getState().earned.first_round).toBe('2025-05-01T08:00:00.000Z');
    expect(upsert.mock.calls[0][0]).toEqual([
      { user_id: 'user-1', badge_id: 'first_round', earned_at: '2025-05-01T08:00:00.000Z' },
      { user_id: 'user-1', badge_id: 'rounds_5', earned_at: expect.any(String) },
    ]);
  });

  it('never blocks the caller when the insert fails: keeps the local state, logs only the code', async () => {
    mockUpsert({ data: null, error: { code: '42501', message: 'new row violates row-level security for user-1' } });
    loadedStore();

    await expect(useBadgesStore.getState().award(['first_round'])).resolves.toEqual(['first_round']);

    expect(useBadgesStore.getState().earned.first_round).toEqual(expect.any(String));
    expect(useBadgesStore.getState().queue).toEqual(['first_round']);
    expect(warn).toHaveBeenCalledWith('[badges] award failed', '42501');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('user-1');
  });

  it('never blocks the caller when the request throws', async () => {
    mockFrom.mockReturnValue({ upsert: () => Promise.reject(new TypeError('Network request failed')) });
    loadedStore();

    await expect(useBadgesStore.getState().award(['first_round'])).resolves.toEqual(['first_round']);

    expect(warn).toHaveBeenCalledWith('[badges] award failed', 'TypeError');
  });

  it('treats a duplicate on the unique pair as nothing to report (ignored by the insert)', async () => {
    const upsert = mockUpsert({ data: null, error: null });
    loadedStore();

    await expect(useBadgesStore.getState().award(['first_round'])).resolves.toEqual(['first_round']);

    expect(warn).not.toHaveBeenCalled();
    expect(upsert.mock.calls[0][1]).toMatchObject({ ignoreDuplicates: true });
  });
});

describe('celebration queue', () => {
  it('shows badges one after the other as each is dismissed', () => {
    useBadgesStore.setState({ queue: ['first_round', 'break_100', 'break_90'] });

    useBadgesStore.getState().dismissCelebration();
    expect(useBadgesStore.getState().queue).toEqual(['break_100', 'break_90']);

    useBadgesStore.getState().dismissCelebration();
    useBadgesStore.getState().dismissCelebration();
    useBadgesStore.getState().dismissCelebration();
    expect(useBadgesStore.getState().queue).toEqual([]);
  });
});

describe('markBackfilled', () => {
  it('records the backfill for the loaded user only', () => {
    useBadgesStore.getState().markBackfilled('user-1');
    expect(useBadgesStore.getState().backfilled).toBe(false);

    loadedStore({}, 'user-1');
    useBadgesStore.getState().markBackfilled('user-2');
    expect(useBadgesStore.getState().backfilled).toBe(false);

    useBadgesStore.getState().markBackfilled('user-1');
    expect(useBadgesStore.getState().backfilled).toBe(true);
  });
});

describe('reset', () => {
  it('clears everything that belongs to the previous user', () => {
    useBadgesStore.setState({
      userId: 'user-1',
      earned: { first_round: '2026-01-02T10:00:00Z' },
      loaded: true,
      backfilled: true,
      queue: ['first_round'],
    });

    useBadgesStore.getState().reset();

    expect(useBadgesStore.getState()).toMatchObject({
      userId: null,
      earned: {},
      loaded: false,
      loading: false,
      backfilled: false,
      queue: [],
    });
  });
});
