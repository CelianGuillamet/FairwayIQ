import {
  ExportFetchError,
  PAGE_SIZE,
  classifyFetchFailure,
  fetchAllRows,
  fetchExportSource,
  fetchRounds,
  prepareExport,
  type ExportClient,
} from './data-export';
import { CSV_BOM } from './export-csv';

type Row = Record<string, unknown>;

type Call = {
  table: string;
  columns: string;
  filters: [string, unknown][];
  orders: string[];
  range: [number, number] | null;
  single: boolean;
};

type FakeOptions = {
  cap?: number;
  failOn?: (call: Call) => unknown;
  visible?: (table: string, row: Row) => boolean;
};

function compare(left: unknown, right: unknown) {
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

function createFakeClient(tables: Record<string, Row[]>, { cap = 1000, failOn, visible }: FakeOptions = {}) {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const call: Call = { table, columns: '', filters: [], orders: [], range: null, single: false };
      calls.push(call);

      const run = () => {
        const error = failOn?.(call);
        if (error) return Promise.resolve({ data: null, error });

        const rows = (tables[table] ?? [])
          .filter((row) => !visible || visible(table, row))
          .filter((row) => call.filters.every(([column, value]) => row[column] === value))
          .sort((left, right) => {
            for (const column of call.orders) {
              const delta = compare(left[column], right[column]);
              if (delta !== 0) return delta;
            }
            return 0;
          });

        if (call.single) return Promise.resolve({ data: rows[0] ?? null, error: null });

        const [from, to] = call.range ?? [0, rows.length - 1];
        return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null });
      };

      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        order(column: string) {
          call.orders.push(column);
          return builder;
        },
        range(from: number, to: number) {
          call.range = [from, to];
          return run();
        },
        maybeSingle() {
          call.single = true;
          return run();
        },
      };

      return builder;
    },
  };

  return { client: client as unknown as ExportClient, calls };
}

const USER = { id: 'user-1', email: 'camille@example.com' };
const OTHER = 'user-2';

function numbered(count: number, make: (index: number) => Row) {
  return Array.from({ length: count }, (_, index) => make(index));
}

function roundRow(index: number, userId = USER.id): Row {
  return {
    id: `round-${String(index).padStart(5, '0')}`,
    user_id: userId,
    played_at: new Date(2026, 0, 1 + (index % 300), 10).toISOString(),
    course_name: `Parcours ${index}`,
    tee_key: 'yellow',
    tee_name: 'Jaune',
    total_score: 90,
    par: 72,
    holes: 18,
    created_at: new Date(2025, 0, 1, 0, 0, index).toISOString(),
  };
}

describe('fetchAllRows', () => {
  const pages = (data: number[], cap = Number.POSITIVE_INFINITY) =>
    jest.fn((from: number, to: number) =>
      Promise.resolve({ data: data.slice(from, Math.min(to + 1, from + cap)), error: null }),
    );

  it('returns an empty list for an empty table after a single request', async () => {
    const query = pages([]);

    await expect(fetchAllRows('rounds', query)).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it('reads a short table in one page then confirms the end', async () => {
    const query = pages([1, 2, 3]);

    await expect(fetchAllRows('rounds', query, { pageSize: 5 })).resolves.toEqual([1, 2, 3]);
    expect(query.mock.calls).toEqual([
      [0, 4],
      [3, 7],
    ]);
  });

  it('reads past 1000 rows with consecutive ranges', async () => {
    const data = Array.from({ length: 2500 }, (_, index) => index);
    const query = pages(data, 1000);

    const rows = await fetchAllRows('rounds', query);

    expect(rows).toHaveLength(2500);
    expect(rows).toEqual(data);
    expect(query.mock.calls.map(([from, to]) => [from, to])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2500, 3499],
    ]);
  });

  it('handles a row count that is an exact multiple of the page size', async () => {
    const data = Array.from({ length: 6 }, (_, index) => index);
    const query = pages(data);

    await expect(fetchAllRows('rounds', query, { pageSize: 3 })).resolves.toEqual(data);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('skips nothing when the server returns fewer rows than asked', async () => {
    const data = Array.from({ length: 11 }, (_, index) => index);

    await expect(fetchAllRows('rounds', pages(data, 4), { pageSize: 10 })).resolves.toEqual(data);
  });

  it('fails with a network error when a request reports one', async () => {
    const query = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Network request failed', code: '' },
    });

    await expect(fetchAllRows('rounds', query)).rejects.toMatchObject({
      name: 'ExportFetchError',
      kind: 'network',
      table: 'rounds',
    });
  });

  it('fails the whole read when a later page fails instead of returning a partial list', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } });

    await expect(fetchAllRows('rounds', query, { pageSize: 2 })).rejects.toMatchObject({
      kind: 'session',
      table: 'rounds',
    });
  });

  it('wraps a rejected request in the same error', async () => {
    const query = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchAllRows('diagnostics', query)).rejects.toBeInstanceOf(ExportFetchError);
    await expect(fetchAllRows('diagnostics', query)).rejects.toMatchObject({ kind: 'network', table: 'diagnostics' });
  });

  it('gives up instead of looping forever on a server that never ends', async () => {
    const query = jest.fn().mockResolvedValue({ data: [1], error: null });

    await expect(fetchAllRows('rounds', query, { pageSize: 1, maxPages: 5 })).rejects.toMatchObject({ kind: 'unknown' });
    expect(query).toHaveBeenCalledTimes(5);
  });

  it('does not put the raw error in the thrown message', async () => {
    const query = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table secrets', code: '42501', details: 'secret detail' },
    });

    const error = await fetchAllRows('rounds', query).catch((caught: Error) => caught);

    expect((error as Error).message).not.toMatch(/secret|permission denied/);
  });
});

describe('classifyFetchFailure', () => {
  it('recognises an expired or missing session', () => {
    for (const code of ['PGRST301', 'PGRST302', '28000', '42501']) {
      expect(classifyFetchFailure({ code, message: 'x' })).toBe('session');
    }
  });

  it('recognises a network failure only when the error has no database code', () => {
    expect(classifyFetchFailure({ message: 'TypeError: Network request failed', code: '' })).toBe('network');
    expect(classifyFetchFailure(new Error('The request timed out'))).toBe('network');
    expect(classifyFetchFailure({ message: 'network error', code: '23505' })).toBe('unknown');
  });

  it('falls back to unknown', () => {
    expect(classifyFetchFailure({ message: 'boom', code: 'XX000' })).toBe('unknown');
    expect(classifyFetchFailure(null)).toBe('unknown');
    expect(classifyFetchFailure('Network request failed')).toBe('unknown');
  });
});

describe('fetchExportSource', () => {
  function fixtures(): Record<string, Row[]> {
    return {
      profiles: [
        { id: 'p1', user_id: USER.id, display_name: 'Camille', handicap: 18 },
        { id: 'p2', user_id: OTHER, display_name: 'Autre', handicap: 4 },
      ],
      subscriptions: [
        { user_id: USER.id, is_premium: true, plan: 'annual', expires_at: null, updated_at: 'x', last_event_at: 'internal' },
        { user_id: OTHER, is_premium: false, plan: null, expires_at: null, updated_at: 'y' },
      ],
      rounds: [...numbered(3, (index) => roundRow(index)), roundRow(99, OTHER)],
      round_holes: [
        { id: 'h1', round_id: 'round-00000', user_id: USER.id, hole_number: 1, created_at: '2026-01-01' },
        { id: 'h2', round_id: 'round-00099', user_id: OTHER, hole_number: 1, created_at: '2026-01-01' },
      ],
      diagnostics: [
        { id: 'd1', user_id: USER.id, round_id: 'round-00000', created_at: '2026-01-02' },
        { id: 'd2', user_id: OTHER, round_id: 'round-00099', created_at: '2026-01-02' },
      ],
      drill_completions: [
        { id: 'c1', user_id: USER.id, drill_id: '1', completed_at: '2026-01-03', result_made: 4, result_attempts: 10 },
        { id: 'c2', user_id: OTHER, drill_id: '1', completed_at: '2026-01-03', result_made: null, result_attempts: null },
      ],
      user_badges: [
        { id: 'b1', user_id: USER.id, badge_id: 'first_round', earned_at: '2026-01-04' },
        { id: 'b2', user_id: OTHER, badge_id: 'first_round', earned_at: '2026-01-04' },
      ],
      club_distances: [
        { id: 'k1', user_id: USER.id, club: 'driver', carry_m: 220, updated_at: '2026-01-05' },
        { id: 'k2', user_id: OTHER, club: 'driver', carry_m: 250, updated_at: '2026-01-05' },
      ],
      debrief_sessions: [
        { id: 's1', user_id: USER.id, round_id: 'round-00000', created_at: '2026-01-06' },
        { id: 's2', user_id: OTHER, round_id: 'round-00099', created_at: '2026-01-06' },
      ],
      debrief_messages: [
        { id: 'm1', session_id: 's1', role: 'user', content: 'Bonjour', created_at: '2026-01-06' },
        { id: 'm2', session_id: 's2', role: 'user', content: 'Secret', created_at: '2026-01-06' },
      ],
    };
  }

  const ownRowsOnly = (table: string, row: Row) =>
    table === 'debrief_messages' ? row.session_id === 's1' : row.user_id === undefined || row.user_id === USER.id;

  it('reads every table of the user', async () => {
    const { client, calls } = createFakeClient(fixtures(), { visible: ownRowsOnly });

    const source = await fetchExportSource(client, USER);

    expect(source.user).toEqual(USER);
    expect(source.profile).toMatchObject({ id: 'p1', display_name: 'Camille' });
    expect(source.subscription).toMatchObject({ is_premium: true, plan: 'annual' });
    expect(source.rounds).toHaveLength(3);
    expect(source.roundHoles.map((row) => row.id)).toEqual(['h1']);
    expect(source.diagnostics.map((row) => row.id)).toEqual(['d1']);
    expect(source.drillCompletions.map((row) => [row.id, row.result_made, row.result_attempts])).toEqual([['c1', 4, 10]]);
    expect(source.badges.map((row) => row.badge_id)).toEqual(['first_round']);
    expect(source.clubDistances.map((row) => [row.club, row.carry_m])).toEqual([['driver', 220]]);
    expect(source.debriefSessions.map((row) => row.id)).toEqual(['s1']);
    expect(source.debriefMessages.map((row) => row.content)).toEqual(['Bonjour']);
    expect(new Set(calls.map((call) => call.table))).toEqual(
      new Set([
        'profiles',
        'subscriptions',
        'rounds',
        'round_holes',
        'diagnostics',
        'drill_completions',
        'user_badges',
        'club_distances',
        'debrief_sessions',
        'debrief_messages',
      ]),
    );
  });

  it('filters every table that has a user column on the signed-in user', async () => {
    const { client, calls } = createFakeClient(fixtures(), { visible: ownRowsOnly });

    await fetchExportSource(client, USER);

    for (const call of calls) {
      if (call.table === 'debrief_messages') {
        expect(call.filters).toEqual([]);
      } else {
        expect(call.filters).toEqual([['user_id', USER.id]]);
      }
    }
  });

  it('pages lists in a total, ascending order and reads the subscription status columns only', async () => {
    const { client, calls } = createFakeClient(fixtures(), { visible: ownRowsOnly });

    await fetchExportSource(client, USER);

    for (const call of calls.filter((entry) => entry.range)) {
      expect(call.orders.length).toBeGreaterThan(0);
      expect(call.orders[call.orders.length - 1]).toMatch(/^(id|badge_id|club)$/);
    }

    const subscription = calls.find((call) => call.table === 'subscriptions');
    expect(subscription?.columns).toBe('is_premium, plan, expires_at, updated_at');
    expect(subscription?.single).toBe(true);
    expect(calls.find((call) => call.table === 'profiles')?.single).toBe(true);
  });

  it('never writes: only reads are exposed by the client it uses', async () => {
    const { client } = createFakeClient(fixtures(), { visible: ownRowsOnly });
    const builder = client.from('rounds') as unknown as Record<string, unknown>;

    expect(Object.keys(builder).sort()).toEqual(['eq', 'maybeSingle', 'order', 'range', 'select']);
    await expect(fetchExportSource(client, USER)).resolves.toBeDefined();
  });

  it('collects more than 1000 rows per table across pages', async () => {
    const tables = fixtures();
    tables.rounds = numbered(2300, (index) => roundRow(index));
    tables.round_holes = numbered(2100, (index) => ({
      id: `hole-${String(index).padStart(5, '0')}`,
      round_id: 'round-00000',
      user_id: USER.id,
      hole_number: (index % 18) + 1,
      created_at: '2026-01-01',
    }));
    const { client, calls } = createFakeClient(tables, { visible: ownRowsOnly });

    const source = await fetchExportSource(client, USER);

    expect(source.rounds).toHaveLength(2300);
    expect(new Set(source.rounds.map((row) => row.id)).size).toBe(2300);
    expect(source.roundHoles).toHaveLength(2100);
    expect(new Set(source.roundHoles.map((row) => row.id)).size).toBe(2100);
    expect(calls.filter((call) => call.table === 'rounds').map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2300, 3299],
    ]);
  });

  it('returns a null profile and subscription for an account that has none', async () => {
    const tables = fixtures();
    tables.profiles = [];
    tables.subscriptions = [];
    const { client } = createFakeClient(tables, { visible: ownRowsOnly });

    const source = await fetchExportSource(client, USER);

    expect(source.profile).toBeNull();
    expect(source.subscription).toBeNull();
  });

  it('fails as a whole when one table cannot be read', async () => {
    const { client } = createFakeClient(fixtures(), {
      visible: ownRowsOnly,
      failOn: (call) => (call.table === 'diagnostics' ? { message: 'TypeError: Network request failed', code: '' } : null),
    });

    await expect(fetchExportSource(client, USER)).rejects.toMatchObject({
      name: 'ExportFetchError',
      kind: 'network',
      table: 'diagnostics',
    });
  });

  it('reports an expired session', async () => {
    const { client } = createFakeClient(fixtures(), {
      failOn: (call) => (call.table === 'profiles' ? { message: 'JWT expired', code: 'PGRST301' } : null),
    });

    await expect(fetchExportSource(client, USER)).rejects.toMatchObject({ kind: 'session', table: 'profiles' });
  });
});

describe('fetchRounds', () => {
  it('reads only the rounds of the user', async () => {
    const { client, calls } = createFakeClient({ rounds: [roundRow(1), roundRow(2, OTHER)] });

    const rounds = await fetchRounds(client, USER.id);

    expect(rounds).toHaveLength(1);
    expect(calls.every((call) => call.table === 'rounds')).toBe(true);
  });
});

describe('prepareExport', () => {
  const context = { now: new Date(2026, 9, 5, 9, 0), appVersion: '1.0.0' };

  it('builds the full JSON file', async () => {
    const { client } = createFakeClient({
      profiles: [{ id: 'p1', user_id: USER.id, display_name: 'Camille' }],
      rounds: [roundRow(1)],
    });

    const file = await prepareExport(client, 'json', USER, context);

    expect(file).not.toBeNull();
    expect(file?.name).toBe('fairwayiq-donnees-2026-10-05.json');
    expect(file?.mimeType).toBe('application/json');
    expect(file?.uti).toBe('public.json');

    const parsed = JSON.parse(file?.content ?? '');
    expect(parsed.app).toEqual({ name: 'FairwayIQ', version: '1.0.0' });
    expect(parsed.account).toEqual(USER);
    expect(parsed.profile.display_name).toBe('Camille');
    expect(parsed.rounds).toHaveLength(1);
  });

  it('builds a JSON file even for an account with no data at all', async () => {
    const { client } = createFakeClient({});

    const file = await prepareExport(client, 'json', USER, context);
    const parsed = JSON.parse(file?.content ?? '');

    expect(parsed.rounds).toEqual([]);
    expect(parsed.profile).toBeNull();
  });

  it('builds the rounds CSV from the rounds table only', async () => {
    const { client, calls } = createFakeClient({ rounds: [roundRow(1), roundRow(2)] });

    const file = await prepareExport(client, 'csv', USER, context);

    expect(file?.name).toBe('fairwayiq-rounds-2026-10-05.csv');
    expect(file?.mimeType).toBe('text/csv');
    expect(file?.uti).toBe('public.comma-separated-values-text');
    expect(file?.content.startsWith(CSV_BOM)).toBe(true);
    expect(file?.content.split('\r\n')).toHaveLength(4);
    expect(new Set(calls.map((call) => call.table))).toEqual(new Set(['rounds']));
  });

  it('has nothing to export for a CSV when there is no round', async () => {
    const { client } = createFakeClient({ rounds: [roundRow(1, OTHER)] });

    await expect(prepareExport(client, 'csv', USER, context)).resolves.toBeNull();
  });

  it('propagates a fetch failure', async () => {
    const { client } = createFakeClient(
      { rounds: [roundRow(1)] },
      { failOn: () => ({ message: 'Network request failed', code: '' }) },
    );

    await expect(prepareExport(client, 'csv', USER, context)).rejects.toMatchObject({ kind: 'network' });
  });
});
