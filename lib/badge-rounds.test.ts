jest.mock('./supabase', () => ({ supabase: {} }));

import {
  BADGE_ROUNDS_CAP,
  BADGE_ROUNDS_PAGE_SIZE,
  fetchRoundsForBadges,
  type RoundsClient,
} from './badge-rounds';

type Result = { data: unknown; error: { code?: string; message: string } | null };

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    played_at: new Date(Date.UTC(2026, 0, 1) - index * 86_400_000).toISOString(),
    total_score: 90 + (index % 10),
    par: 72,
    holes: 18,
  }));
}

function createClient(rows: ReturnType<typeof makeRows>, overrides: Record<number, Result | Error> = {}) {
  const calls = { tables: [] as string[], columns: [] as string[], orders: [] as Array<[string, unknown]>, ranges: [] as Array<[number, number]> };
  let call = 0;

  const query = {
    select: (columns: string) => {
      calls.columns.push(columns);
      return query;
    },
    order: (column: string, options: unknown) => {
      calls.orders.push([column, options]);
      return query;
    },
    range: (from: number, to: number) => {
      calls.ranges.push([from, to]);
      const override = overrides[call++];

      if (override instanceof Error) return Promise.reject(override);

      return Promise.resolve(override ?? { data: rows.slice(from, to + 1), error: null });
    },
  };
  const client = {
    from: (table: string) => {
      calls.tables.push(table);
      return query;
    },
  } as unknown as RoundsClient;

  return { client, calls };
}

let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

describe('fetchRoundsForBadges', () => {
  it('reads only the columns the catch-up needs, newest first', async () => {
    const { client, calls } = createClient(makeRows(3));

    await fetchRoundsForBadges(client);

    expect(calls.tables).toEqual(['rounds']);
    expect(calls.columns).toEqual(['id, played_at, total_score, par, holes']);
    expect(calls.orders).toEqual([
      ['played_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
  });

  it('pages with range until a short page, so more than one page of rounds comes back', async () => {
    const { client, calls } = createClient(makeRows(230));

    const rounds = await fetchRoundsForBadges(client);

    expect(calls.ranges).toEqual([
      [0, 99],
      [100, 199],
      [200, 299],
    ]);
    expect(rounds).toHaveLength(230);
    expect(rounds?.[229].id).toBe('r229');
  });

  it('asks for one more page when the last one was full, and stops on the empty one', async () => {
    const { client, calls } = createClient(makeRows(BADGE_ROUNDS_PAGE_SIZE));

    await expect(fetchRoundsForBadges(client)).resolves.toHaveLength(BADGE_ROUNDS_PAGE_SIZE);

    expect(calls.ranges).toEqual([
      [0, 99],
      [100, 199],
    ]);
  });

  it('returns an empty list for a player without rounds', async () => {
    const { client, calls } = createClient([]);

    await expect(fetchRoundsForBadges(client)).resolves.toEqual([]);

    expect(calls.ranges).toEqual([[0, 99]]);
  });

  it('stops at 500 rounds', async () => {
    const { client, calls } = createClient(makeRows(1200));

    const rounds = await fetchRoundsForBadges(client);

    expect(rounds).toHaveLength(BADGE_ROUNDS_CAP);
    expect(calls.ranges).toHaveLength(5);
    expect(calls.ranges[4]).toEqual([400, 499]);
  });

  it('gives up on the whole list when a page fails, logging only the error code', async () => {
    const { client } = createClient(makeRows(230), { 1: { data: null, error: { code: 'PGRST301', message: 'JWT expired for user-1' } } });

    await expect(fetchRoundsForBadges(client)).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith('[badges] rounds unavailable for the catch-up', 'PGRST301');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('user-1');
  });

  it('gives up when a request throws', async () => {
    const { client } = createClient(makeRows(10), { 0: new TypeError('Network request failed') });

    await expect(fetchRoundsForBadges(client)).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith('[badges] rounds unavailable for the catch-up', 'TypeError');
  });
});
