const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockIn = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (columns: string) => {
          mockSelect(columns);
          return { in: (column: string, ids: string[]) => mockIn(column, ids) };
        },
      };
    },
  },
}));

import { HOLES_LOAD_ERROR, getCachedHoles, getHolesFingerprint, loadHolesForRounds, resetHolesData, type HolesRound } from './holes-data';

type Result = { data: unknown; error: { message: string } | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeRound(id: string, overrides: Partial<HolesRound> = {}): HolesRound {
  return { id, holes: 18, par: 72, total_score: 90, putts: 34, gir: 4, fairways_hit: 6, penalties: 1, ...overrides };
}

function row(roundId: string, holeNumber: number) {
  return { round_id: roundId, hole_number: holeNumber, par: 4, score: 5, putts: 2, gir: false, fairway_hit: true, penalty: 0 };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockFrom.mockReset();
  mockSelect.mockReset();
  mockIn.mockReset();
  mockIn.mockResolvedValue({ data: [], error: null });
  resetHolesData();
});

describe('loadHolesForRounds', () => {
  it('fetches every round in one batched query on round_holes', async () => {
    mockIn.mockResolvedValue({ data: [row('a', 1), row('b', 1), row('a', 2)], error: null });

    const result = await loadHolesForRounds([makeRound('a'), makeRound('b'), makeRound('c')]);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('round_holes');
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('hole_number'));
    expect(mockIn).toHaveBeenCalledTimes(1);
    expect(mockIn).toHaveBeenCalledWith('round_id', ['a', 'b', 'c']);
    expect(result?.a).toHaveLength(2);
    expect(result?.b).toHaveLength(1);
  });

  it('strips the round id from the rows and keeps rounds without rows as empty', async () => {
    mockIn.mockResolvedValue({ data: [row('a', 1)], error: null });

    const result = await loadHolesForRounds([makeRound('a'), makeRound('legacy')]);

    expect(result?.a?.[0]).toEqual({ hole_number: 1, par: 4, score: 5, putts: 2, gir: false, fairway_hit: true, penalty: 0 });
    expect(result?.legacy).toEqual([]);
  });

  it('does not query when there is no round', async () => {
    await expect(loadHolesForRounds([])).resolves.toEqual({});
    expect(mockIn).not.toHaveBeenCalled();
  });

  it('serves a second call from memory, legacy rounds included', async () => {
    mockIn.mockResolvedValue({ data: [row('a', 1)], error: null });
    const rounds = [makeRound('a'), makeRound('legacy')];

    await loadHolesForRounds(rounds);
    await loadHolesForRounds(rounds);

    expect(mockIn).toHaveBeenCalledTimes(1);
    expect(getCachedHoles(rounds)).not.toBeNull();
  });

  it('only fetches the rounds that are not cached yet', async () => {
    mockIn.mockResolvedValue({ data: [row('a', 1)], error: null });
    await loadHolesForRounds([makeRound('a')]);

    mockIn.mockResolvedValue({ data: [row('b', 1)], error: null });
    const result = await loadHolesForRounds([makeRound('a'), makeRound('b')]);

    expect(mockIn).toHaveBeenLastCalledWith('round_id', ['b']);
    expect(Object.keys(result ?? {})).toEqual(['a', 'b']);
  });

  it('refetches a round whose aggregates changed since it was cached', async () => {
    mockIn.mockResolvedValue({ data: [row('a', 1)], error: null });
    await loadHolesForRounds([makeRound('a')]);

    expect(getCachedHoles([makeRound('a', { total_score: 85 })])).toBeNull();

    mockIn.mockResolvedValue({ data: [row('a', 1), row('a', 2)], error: null });
    const result = await loadHolesForRounds([makeRound('a', { total_score: 85 })]);

    expect(mockIn).toHaveBeenCalledTimes(2);
    expect(result?.a).toHaveLength(2);
  });

  it('shares one request between identical concurrent calls', async () => {
    const response = deferred<Result>();
    mockIn.mockReturnValue(response.promise);

    const first = loadHolesForRounds([makeRound('a')]);
    const second = loadHolesForRounds([makeRound('a')]);
    response.resolve({ data: [row('a', 1)], error: null });

    expect((await first)?.a).toHaveLength(1);
    expect((await second)?.a).toHaveLength(1);
    expect(mockIn).toHaveBeenCalledTimes(1);
  });

  it('throws a French message on a query error, caches nothing and retries next time', async () => {
    mockIn.mockResolvedValueOnce({ data: null, error: { message: 'permission denied for table round_holes' } });

    await expect(loadHolesForRounds([makeRound('a')])).rejects.toThrow(HOLES_LOAD_ERROR);
    expect(getCachedHoles([makeRound('a')])).toBeNull();
    expect(console.warn).toHaveBeenCalled();

    mockIn.mockResolvedValueOnce({ data: [row('a', 1)], error: null });
    const result = await loadHolesForRounds([makeRound('a')]);

    expect(result?.a).toHaveLength(1);
    expect(mockIn).toHaveBeenCalledTimes(2);
  });

  it('drops a response that lands after a reset and does not cache it for the next user', async () => {
    const response = deferred<Result>();
    mockIn.mockReturnValueOnce(response.promise);

    const loading = loadHolesForRounds([makeRound('a')]);
    resetHolesData();
    response.resolve({ data: [row('a', 1)], error: null });

    await expect(loading).resolves.toBeNull();
    expect(getCachedHoles([makeRound('a')])).toBeNull();
  });
});

describe('resetHolesData', () => {
  it('forgets everything that was cached', async () => {
    mockIn.mockResolvedValue({ data: [row('a', 1)], error: null });
    await loadHolesForRounds([makeRound('a')]);

    resetHolesData();

    expect(getCachedHoles([makeRound('a')])).toBeNull();
  });
});

describe('getHolesFingerprint', () => {
  it('changes with any aggregate a hole edit rewrites', () => {
    const base = getHolesFingerprint(makeRound('a'));

    for (const change of [{ total_score: 91 }, { putts: 33 }, { gir: 5 }, { fairways_hit: 7 }, { penalties: 2 }, { par: 71 }, { holes: 9 as const }]) {
      expect(getHolesFingerprint(makeRound('a', change))).not.toBe(base);
    }
  });
});
