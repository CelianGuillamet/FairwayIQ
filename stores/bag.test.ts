const mockSelectEq = jest.fn();
const mockUpsert = jest.fn();
const mockDeleteEq = jest.fn();
const mockFrom = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (columns: string) => ({
          eq: (column: string, value: string) => mockSelectEq(columns, column, value),
        }),
        upsert: (row: unknown, options: unknown) => mockUpsert(row, options),
        delete: () => ({
          eq: (column: string, value: string) => ({
            eq: (column2: string, value2: string) => mockDeleteEq([column, value], [column2, value2]),
          }),
        }),
      };
    },
  },
}));

import { BagError } from '../lib/bag';
import { useBagStore } from './bag';

type Result = { data: unknown; error: { code?: string; message: string } | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const ok: Result = { data: null, error: null };
const state = () => useBagStore.getState();

async function loadWith(rows: unknown, userId = 'user-1') {
  mockSelectEq.mockResolvedValueOnce({ data: rows, error: null });
  await state().load(userId);
}

beforeEach(() => {
  mockSelectEq.mockReset();
  mockUpsert.mockReset();
  mockDeleteEq.mockReset();
  mockFrom.mockReset();
  mockUpsert.mockResolvedValue(ok);
  mockDeleteEq.mockResolvedValue(ok);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  state().reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('load', () => {
  it('reads the club distances of the user and marks the bag loaded', async () => {
    await loadWith([
      { club: 'iron7', carry_m: 140 },
      { club: 'driver', carry_m: 230 },
    ]);

    expect(mockFrom).toHaveBeenCalledWith('club_distances');
    expect(mockSelectEq).toHaveBeenCalledWith('club, carry_m', 'user_id', 'user-1');
    expect(state()).toMatchObject({
      userId: 'user-1',
      distances: { iron7: 140, driver: 230 },
      loaded: true,
      loading: false,
      error: null,
    });
  });

  it('drops rows with an unknown club or an invalid carry', async () => {
    await loadWith([
      { club: 'putter', carry_m: 5 },
      { club: 'pw', carry_m: 999 },
      { club: 'sw', carry_m: 80 },
    ]);

    expect(state().distances).toEqual({ sw: 80 });
  });

  it('does not fetch again once loaded or while a load is running', async () => {
    const pending = deferred<Result>();
    mockSelectEq.mockReturnValueOnce(pending.promise);

    const first = state().load('user-1');
    await state().load('user-1');
    expect(mockSelectEq).toHaveBeenCalledTimes(1);
    expect(state().loading).toBe(true);

    pending.resolve({ data: [], error: null });
    await first;
    await state().load('user-1');

    expect(mockSelectEq).toHaveBeenCalledTimes(1);
  });

  it('shows a French message, not the backend text, when the fetch fails', async () => {
    mockSelectEq.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'relation "club_distances" does not exist' } });

    await state().load('user-1');

    expect(state().loaded).toBe(false);
    expect(state().loading).toBe(false);
    expect(state().error).toBe('Impossible de charger ton sac pour le moment. Réessaie dans un instant.');
    expect(state().error).not.toContain('relation');
  });

  it('turns a rejected request into the same French error and allows a retry', async () => {
    mockSelectEq.mockRejectedValueOnce(new Error('socket hang up'));

    await state().load('user-1');

    expect(state()).toMatchObject({ loaded: false, loading: false });
    expect(state().error).toBe('Impossible de charger ton sac pour le moment. Réessaie dans un instant.');

    await loadWith([{ club: 'iron7', carry_m: 140 }]);

    expect(state()).toMatchObject({ loaded: true, error: null });
  });

  it('retries after a failure and clears the error', async () => {
    mockSelectEq.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } });
    await state().load('user-1');

    await loadWith([{ club: 'iron7', carry_m: 140 }]);

    expect(mockSelectEq).toHaveBeenCalledTimes(2);
    expect(state()).toMatchObject({ loaded: true, error: null, distances: { iron7: 140 } });
  });

  it('starts from an empty bag when another user signs in', async () => {
    await loadWith([{ club: 'iron7', carry_m: 140 }], 'user-1');

    const pending = deferred<Result>();
    mockSelectEq.mockReturnValueOnce(pending.promise);
    const second = state().load('user-2');

    expect(state()).toMatchObject({ userId: 'user-2', distances: {}, loaded: false, loading: true });

    pending.resolve({ data: [{ club: 'pw', carry_m: 100 }], error: null });
    await second;

    expect(state().distances).toEqual({ pw: 100 });
  });

  it('drops a response that lands after reset()', async () => {
    const pending = deferred<Result>();
    mockSelectEq.mockReturnValueOnce(pending.promise);

    const request = state().load('user-1');
    state().reset();
    pending.resolve({ data: [{ club: 'iron7', carry_m: 140 }], error: null });
    await request;

    expect(state()).toMatchObject({ userId: null, distances: {}, loaded: false, loading: false });
  });

  it('keeps only the newest of two overlapping loads', async () => {
    const stale = deferred<Result>();
    mockSelectEq.mockReturnValueOnce(stale.promise);
    const first = state().load('user-1');

    await loadWith([{ club: 'pw', carry_m: 100 }], 'user-2');

    stale.resolve({ data: [{ club: 'iron7', carry_m: 140 }], error: null });
    await first;

    expect(state()).toMatchObject({ userId: 'user-2', distances: { pw: 100 }, loaded: true, loading: false });
  });
});

describe('saveDistance', () => {
  it('upserts one row per user and club and stores the value', async () => {
    await loadWith([]);

    await state().saveDistance('iron7', 140);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [row, options] = mockUpsert.mock.calls[0];
    expect(row).toMatchObject({ user_id: 'user-1', club: 'iron7', carry_m: 140 });
    expect(Number.isNaN(Date.parse(row.updated_at))).toBe(false);
    expect(options).toEqual({ onConflict: 'user_id,club' });
    expect(state().distances).toEqual({ iron7: 140 });
  });

  it('replaces the value of a club that is already filled', async () => {
    await loadWith([{ club: 'iron7', carry_m: 140 }, { club: 'pw', carry_m: 100 }]);

    await state().saveDistance('iron7', 145);

    expect(state().distances).toEqual({ iron7: 145, pw: 100 });
  });

  it.each([
    ['too short', 'iron7', 9],
    ['too long', 'iron7', 401],
    ['fractional', 'iron7', 140.5],
    ['not a number', 'iron7', Number.NaN],
    ['unknown club', 'putter', 140],
  ])('rejects an invalid distance without calling the backend (%s)', async (_name, club, carry) => {
    await loadWith([]);

    await expect(state().saveDistance(club as never, carry)).rejects.toBeInstanceOf(BagError);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(state().distances).toEqual({});
  });

  it('rejects when nobody is signed in', async () => {
    await expect(state().saveDistance('iron7', 140)).rejects.toThrow('Ta session a expiré. Reconnecte-toi puis réessaie.');

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects with a French message and keeps the old value when the backend fails', async () => {
    await loadWith([{ club: 'iron7', carry_m: 140 }]);
    mockUpsert.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'permission denied for schema public' } });

    const failure = state().saveDistance('iron7', 150);

    await expect(failure).rejects.toBeInstanceOf(BagError);
    await expect(failure).rejects.toThrow('Impossible d’enregistrer cette distance pour le moment. Réessaie dans un instant.');
    expect(state().distances).toEqual({ iron7: 140 });
  });

  it('turns a rejected request into a BagError without the raw text', async () => {
    await loadWith([]);
    mockUpsert.mockRejectedValueOnce(new Error('socket hang up'));

    const failure = state().saveDistance('iron7', 140);

    await expect(failure).rejects.toBeInstanceOf(BagError);
    await expect(failure).rejects.toThrow('Impossible d’enregistrer cette distance pour le moment. Réessaie dans un instant.');
  });

  it('maps a constraint violation to the invalid distance message', async () => {
    await loadWith([]);
    mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'new row violates check constraint "club_distances_carry_m_check"' },
    });

    await expect(state().saveDistance('iron7', 140)).rejects.toThrow('Cette distance n’est pas valide. Saisis une distance entre 10 et 400 m.');
  });

  it('runs the writes of one club in order so the last one wins', async () => {
    await loadWith([]);
    const first = deferred<Result>();
    mockUpsert.mockReturnValueOnce(first.promise);

    const a = state().saveDistance('iron7', 140);
    const b = state().saveDistance('iron7', 150);
    await Promise.resolve();

    expect(mockUpsert).toHaveBeenCalledTimes(1);

    first.resolve(ok);
    await Promise.all([a, b]);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ carry_m: 140 });
    expect(mockUpsert.mock.calls[1][0]).toMatchObject({ carry_m: 150 });
    expect(state().distances).toEqual({ iron7: 150 });
  });

  it('still runs a later write after an earlier one failed', async () => {
    await loadWith([]);
    mockUpsert.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } });

    const failed = state().saveDistance('iron7', 140);
    const next = state().saveDistance('iron7', 150);

    await expect(failed).rejects.toBeInstanceOf(BagError);
    await next;

    expect(state().distances).toEqual({ iron7: 150 });
  });

  it('does not store a value that was saved for a previous user', async () => {
    await loadWith([]);
    const pending = deferred<Result>();
    mockUpsert.mockReturnValueOnce(pending.promise);

    const request = state().saveDistance('iron7', 140);
    await Promise.resolve();
    state().reset();
    pending.resolve(ok);
    await request;

    expect(state().distances).toEqual({});
  });
});

describe('removeDistance', () => {
  it('deletes the row of the user and club and drops the value', async () => {
    await loadWith([{ club: 'iron7', carry_m: 140 }, { club: 'pw', carry_m: 100 }]);

    await state().removeDistance('iron7');

    expect(mockDeleteEq).toHaveBeenCalledWith(['user_id', 'user-1'], ['club', 'iron7']);
    expect(state().distances).toEqual({ pw: 100 });
  });

  it('keeps the value and rejects with a French message when the backend fails', async () => {
    await loadWith([{ club: 'iron7', carry_m: 140 }]);
    mockDeleteEq.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });

    const failure = state().removeDistance('iron7');

    await expect(failure).rejects.toThrow('Connexion impossible. Vérifie ton réseau puis réessaie.');
    expect(state().distances).toEqual({ iron7: 140 });
  });

  it('turns a rejected request into a BagError', async () => {
    await loadWith([{ club: 'iron7', carry_m: 140 }]);
    mockDeleteEq.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(state().removeDistance('iron7')).rejects.toThrow(
      'Impossible d’effacer cette distance pour le moment. Réessaie dans un instant.',
    );
    expect(state().distances).toEqual({ iron7: 140 });
  });

  it('orders a removal after the save typed just before it', async () => {
    await loadWith([]);
    const pending = deferred<Result>();
    mockUpsert.mockReturnValueOnce(pending.promise);

    const save = state().saveDistance('iron7', 140);
    const removal = state().removeDistance('iron7');
    await Promise.resolve();

    expect(mockDeleteEq).not.toHaveBeenCalled();

    pending.resolve(ok);
    await Promise.all([save, removal]);

    expect(mockDeleteEq).toHaveBeenCalledTimes(1);
    expect(state().distances).toEqual({});
  });

  it('rejects an unknown club and a missing session', async () => {
    await expect(state().removeDistance('iron7')).rejects.toBeInstanceOf(BagError);
    await expect(state().removeDistance('putter' as never)).rejects.toBeInstanceOf(BagError);

    expect(mockDeleteEq).not.toHaveBeenCalled();
  });
});

describe('reset', () => {
  it('clears the bag, the user and any error', async () => {
    mockSelectEq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await state().load('user-1');
    await loadWith([{ club: 'iron7', carry_m: 140 }], 'user-2');

    state().reset();

    expect(state()).toMatchObject({ userId: null, distances: {}, loaded: false, loading: false, error: null });
  });
});
