const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockInsert = jest.fn();
const mockInsertResult = jest.fn();
const mockTeeSets = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'course_tee_sets') {
        return { select: () => ({ in: (_column: string, ids: string[]) => mockTeeSets(ids) }) };
      }

      const selectChain = {
        order: (...args: unknown[]) => {
          mockOrder(...args);
          return selectChain;
        },
        range: (from: number, to: number) => mockRange(from, to),
      };

      return {
        select: () => selectChain,
        insert: (row: unknown) => {
          mockInsert(row);
          return { select: () => ({ single: () => mockInsertResult() }) };
        },
      };
    },
  },
}));

import { compareRounds, mergeRounds, useRoundsStore } from './rounds';

type Result = { data: unknown; error: { message: string } | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeRound(id: string, playedAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    user_id: 'user-1',
    played_at: playedAt,
    tee_set_id: null,
    total_score: 90,
    par: 72,
    holes: 18,
    ...extra,
  } as any;
}

const ids = () => useRoundsStore.getState().rounds.map((round) => round.id);

beforeEach(() => {
  mockOrder.mockReset();
  mockRange.mockReset();
  mockInsert.mockReset();
  mockInsertResult.mockReset();
  mockTeeSets.mockReset();
  mockTeeSets.mockResolvedValue({ data: [], error: null });
  useRoundsStore.getState().reset();
});

describe('compareRounds / mergeRounds', () => {
  it('sorts newest first and breaks played_at ties by id, descending', () => {
    const sorted = [
      makeRound('a', '2026-03-01T10:00:00Z'),
      makeRound('c', '2026-03-02T10:00:00Z'),
      makeRound('b', '2026-03-02T10:00:00Z'),
    ].sort(compareRounds);

    expect(sorted.map((round) => round.id)).toEqual(['c', 'b', 'a']);
  });

  it('merges by id, letting incoming rows replace current ones', () => {
    const merged = mergeRounds(
      [makeRound('a', '2026-03-01T10:00:00Z', { notes: 'old' }), makeRound('b', '2026-03-02T10:00:00Z')],
      [makeRound('a', '2026-03-01T10:00:00Z', { notes: 'new' })]
    );

    expect(merged.map((round) => round.id)).toEqual(['b', 'a']);
    expect(merged[1].notes).toBe('new');
  });
});

describe('fetchRounds', () => {
  it('orders by played_at then id so pagination is stable', async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await useRoundsStore.getState().fetchRounds();

    expect(mockOrder).toHaveBeenNthCalledWith(1, 'played_at', { ascending: false });
    expect(mockOrder).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(0, 49);
  });

  it('loads the first page, hydrates tee ratings and marks the store initialized', async () => {
    mockRange.mockResolvedValue({
      data: [makeRound('a', '2026-03-01T10:00:00Z', { tee_set_id: 'tee-1' })],
      error: null,
    });
    mockTeeSets.mockResolvedValue({
      data: [{ id: 'tee-1', course_rating: 71.4, slope_rating: 128 }],
      error: null,
    });

    await useRoundsStore.getState().fetchRounds();

    const state = useRoundsStore.getState();
    expect(state.rounds[0]).toMatchObject({ id: 'a', course_rating: 71.4, slope_rating: 128 });
    expect(state.initialized).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.hasMore).toBe(false);
  });

  it('flags the error but still marks the store initialized when the query fails', async () => {
    mockRange.mockResolvedValue({ data: null, error: { message: 'offline' } });

    await useRoundsStore.getState().fetchRounds();

    expect(useRoundsStore.getState()).toMatchObject({ error: 'offline', initialized: true, loading: false });
  });

  it('drops a response that lands after the store was reset for another user', async () => {
    const pending = deferred<Result>();
    mockRange.mockReturnValueOnce(pending.promise);

    const fetching = useRoundsStore.getState().fetchRounds();
    useRoundsStore.getState().reset();
    pending.resolve({ data: [makeRound('old-user-round', '2026-03-01T10:00:00Z')], error: null });
    await fetching;

    const state = useRoundsStore.getState();
    expect(state.rounds).toEqual([]);
    expect(state.initialized).toBe(false);
    expect(state.loading).toBe(true);
  });

  it('drops a response that is stale once the tee-rating lookup finishes after a reset', async () => {
    const teeSets = deferred<Result>();
    mockRange.mockResolvedValue({ data: [makeRound('a', '2026-03-01T10:00:00Z', { tee_set_id: 'tee-1' })], error: null });
    mockTeeSets.mockReturnValueOnce(teeSets.promise);

    const fetching = useRoundsStore.getState().fetchRounds();
    while (mockTeeSets.mock.calls.length === 0) {
      await Promise.resolve();
    }
    useRoundsStore.getState().reset();
    teeSets.resolve({ data: [], error: null });
    await fetching;

    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(useRoundsStore.getState().initialized).toBe(false);
  });

  it('lets the newest request win when an older one resolves last', async () => {
    const older = deferred<Result>();
    const newer = deferred<Result>();
    mockRange.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const first = useRoundsStore.getState().fetchRounds();
    const second = useRoundsStore.getState().fetchRounds();
    newer.resolve({ data: [makeRound('new', '2026-03-02T10:00:00Z')], error: null });
    await second;
    older.resolve({ data: [makeRound('old', '2026-03-01T10:00:00Z')], error: null });
    await first;

    expect(ids()).toEqual(['new']);
  });

  it('keeps a round that was added while the fetch was in flight', async () => {
    const pending = deferred<Result>();
    mockRange.mockReturnValueOnce(pending.promise);
    mockInsertResult.mockResolvedValue({ data: makeRound('added', '2026-03-05T10:00:00Z'), error: null });

    const fetching = useRoundsStore.getState().fetchRounds();
    await useRoundsStore.getState().addRound({} as any);
    pending.resolve({ data: [makeRound('a', '2026-03-01T10:00:00Z')], error: null });
    await fetching;

    expect(ids()).toEqual(['added', 'a']);
  });
});

describe('fetchMoreRounds', () => {
  function seedFirstPage(count = 2) {
    useRoundsStore.setState({
      rounds: Array.from({ length: count }, (_, index) =>
        makeRound(`r${index}`, `2026-03-${String(20 - index).padStart(2, '0')}T10:00:00Z`)
      ),
      loading: false,
      initialized: true,
      hasMore: true,
    });
  }

  it('requests the next page after the rounds already loaded, in stable order', async () => {
    seedFirstPage(2);
    mockRange.mockResolvedValue({ data: [], error: null });

    await useRoundsStore.getState().fetchMoreRounds();

    expect(mockOrder).toHaveBeenNthCalledWith(1, 'played_at', { ascending: false });
    expect(mockOrder).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(2, 51);
    expect(useRoundsStore.getState().hasMore).toBe(false);
    expect(useRoundsStore.getState().loadingMore).toBe(false);
  });

  it('merges by id into the current list instead of writing back a stale snapshot', async () => {
    seedFirstPage(2);
    const pending = deferred<Result>();
    mockRange.mockReturnValueOnce(pending.promise);
    mockInsertResult.mockResolvedValue({ data: makeRound('added', '2026-03-25T10:00:00Z'), error: null });

    const loadingMore = useRoundsStore.getState().fetchMoreRounds();
    await useRoundsStore.getState().addRound({} as any);
    pending.resolve({
      data: [makeRound('r1', '2026-03-19T10:00:00Z'), makeRound('older', '2026-03-10T10:00:00Z')],
      error: null,
    });
    await loadingMore;

    expect(ids()).toEqual(['added', 'r0', 'r1', 'older']);
  });

  it('does nothing when there is nothing more to load', async () => {
    seedFirstPage(2);
    useRoundsStore.setState({ hasMore: false });

    await useRoundsStore.getState().fetchMoreRounds();

    expect(mockRange).not.toHaveBeenCalled();
  });

  it('drops a response that lands after the store was reset for another user', async () => {
    seedFirstPage(2);
    const pending = deferred<Result>();
    mockRange.mockReturnValueOnce(pending.promise);

    const loadingMore = useRoundsStore.getState().fetchMoreRounds();
    useRoundsStore.getState().reset();
    pending.resolve({ data: [makeRound('old-user-round', '2026-03-01T10:00:00Z')], error: null });
    await loadingMore;

    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(useRoundsStore.getState().loadingMore).toBe(false);
  });

  it('discards a page requested against a list that fetchRounds has since replaced', async () => {
    seedFirstPage(2);
    const pendingMore = deferred<Result>();
    mockRange
      .mockReturnValueOnce(pendingMore.promise)
      .mockResolvedValueOnce({ data: [makeRound('fresh', '2026-03-30T10:00:00Z')], error: null });

    const loadingMore = useRoundsStore.getState().fetchMoreRounds();
    await useRoundsStore.getState().fetchRounds();
    pendingMore.resolve({ data: [makeRound('misaligned', '2026-03-01T10:00:00Z')], error: null });
    await loadingMore;

    expect(ids()).toEqual(['fresh']);
    expect(useRoundsStore.getState().loadingMore).toBe(false);
  });
});

describe('addRound', () => {
  it('hydrates the tee rating like fetchRounds does', async () => {
    mockInsertResult.mockResolvedValue({
      data: makeRound('new', '2026-03-05T10:00:00Z', { tee_set_id: 'tee-1' }),
      error: null,
    });
    mockTeeSets.mockResolvedValue({
      data: [{ id: 'tee-1', course_rating: 70.2, slope_rating: 121 }],
      error: null,
    });

    const added = await useRoundsStore.getState().addRound({ tee_set_id: 'tee-1' } as any);

    expect(added).toMatchObject({ id: 'new', course_rating: 70.2, slope_rating: 121 });
    expect(useRoundsStore.getState().rounds[0]).toMatchObject({ course_rating: 70.2, slope_rating: 121 });
    expect(useRoundsStore.getState().initialized).toBe(true);
  });

  it('places the new round by played_at instead of always on top', async () => {
    useRoundsStore.setState({
      rounds: [makeRound('recent', '2026-03-10T10:00:00Z'), makeRound('oldest', '2026-01-01T10:00:00Z')],
    });
    mockInsertResult.mockResolvedValue({ data: makeRound('backfilled', '2026-02-01T10:00:00Z'), error: null });

    await useRoundsStore.getState().addRound({} as any);

    expect(ids()).toEqual(['recent', 'backfilled', 'oldest']);
  });

  it('still succeeds when the tee rating lookup throws, since the row is already saved', async () => {
    mockInsertResult.mockResolvedValue({
      data: makeRound('new', '2026-03-05T10:00:00Z', { tee_set_id: 'tee-1' }),
      error: null,
    });
    mockTeeSets.mockRejectedValue(new Error('network'));

    const added = await useRoundsStore.getState().addRound({ tee_set_id: 'tee-1' } as any);

    expect(added.id).toBe('new');
    expect(ids()).toEqual(['new']);
  });

  it('records the error and rethrows when the insert fails', async () => {
    mockInsertResult.mockResolvedValue({ data: null, error: { message: 'constraint' } });

    await expect(useRoundsStore.getState().addRound({} as any)).rejects.toEqual({ message: 'constraint' });

    expect(useRoundsStore.getState().error).toBe('constraint');
    expect(useRoundsStore.getState().rounds).toEqual([]);
  });

  it('does not put the row into the store of the next user after a reset', async () => {
    const pending = deferred<Result>();
    mockInsertResult.mockReturnValueOnce(pending.promise);

    const adding = useRoundsStore.getState().addRound({} as any);
    useRoundsStore.getState().reset();
    pending.resolve({ data: makeRound('late', '2026-03-05T10:00:00Z'), error: null });

    await expect(adding).resolves.toMatchObject({ id: 'late' });
    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(useRoundsStore.getState().initialized).toBe(false);
  });
});

describe('upsertRound / removeRound / reset', () => {
  it('replaces an existing round by id and keeps the list sorted', () => {
    useRoundsStore.setState({
      rounds: [makeRound('a', '2026-03-10T10:00:00Z'), makeRound('b', '2026-03-01T10:00:00Z')],
    });

    useRoundsStore.getState().upsertRound(makeRound('b', '2026-03-15T10:00:00Z', { notes: 'edited' }));

    expect(ids()).toEqual(['b', 'a']);
    expect(useRoundsStore.getState().rounds[0].notes).toBe('edited');
  });

  it('removes a round', () => {
    useRoundsStore.setState({ rounds: [makeRound('a', '2026-03-10T10:00:00Z')] });

    useRoundsStore.getState().removeRound('a');

    expect(useRoundsStore.getState().rounds).toEqual([]);
  });

  it('resets every field so the next user refetches', () => {
    useRoundsStore.setState({
      rounds: [makeRound('a', '2026-03-10T10:00:00Z')],
      initialized: true,
      loading: false,
      loadingMore: true,
      hasMore: false,
      error: 'x',
    });

    useRoundsStore.getState().reset();

    expect(useRoundsStore.getState()).toMatchObject({
      rounds: [],
      initialized: false,
      loading: true,
      loadingMore: false,
      hasMore: true,
      error: null,
    });
  });
});
