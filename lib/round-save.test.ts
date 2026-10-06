import {
  RoundSaveError,
  SAVE_ROUND_TIMEOUT_MS,
  buildSaveRoundArgs,
  buildUpdateRoundArgs,
  classifyRoundSaveFailure,
  createClientRequestId,
  getErrorCode,
  getRoundSaveErrorMessage,
  mapRoundSaveError,
  saveRound,
  updateRound,
} from './round-save';
import { InvokeTimeoutError } from './invoke-timeout';
import { createDefaultScorecard } from './rounds';
import { supabase } from './supabase';
import type { Round, RoundDraftHole } from '../types';

jest.mock('./supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;
const abortSignal = jest.fn();

function mockSaveRpc(result: Promise<unknown>) {
  abortSignal.mockReturnValue(result);
  rpc.mockReturnValue({ abortSignal });
}

function saveArgs() {
  return buildSaveRoundArgs({
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    playedAt: '2026-05-01T10:00:00.000Z',
    courseId: null,
    courseName: null,
    teeKey: null,
    notes: null,
    scorecard: completedScorecard(),
  });
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function completedScorecard(holes: 9 | 18 = 18): RoundDraftHole[] {
  return createDefaultScorecard(holes).map((hole) => ({ ...hole, completed: true }));
}

describe('createClientRequestId', () => {
  const originalCrypto = (globalThis as { crypto?: unknown }).crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true, writable: true });
  });

  it('returns a v4 uuid', () => {
    expect(createClientRequestId()).toMatch(UUID_V4);
  });

  it('returns a different id on every call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createClientRequestId()));
    expect(ids.size).toBe(50);
  });

  it('still returns a v4 uuid when the crypto API is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    expect(createClientRequestId()).toMatch(UUID_V4);
  });

  it('falls back to getRandomValues when randomUUID is missing', () => {
    const getRandomValues = jest.fn((bytes: Uint8Array) => {
      bytes.fill(255);
      return bytes;
    });
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues }, configurable: true, writable: true });

    expect(createClientRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });
});

describe('buildSaveRoundArgs', () => {
  const baseInput = {
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    playedAt: '2026-05-01T10:00:00.000Z',
    courseId: 'course-1',
    courseName: 'Golf de Test',
    courseProvider: 'catalog',
    providerCourseId: 'ext-1',
    teeKey: 'yellow',
    teeSetId: 'tee-1',
    teeName: 'Jaune',
    teeColor: '#ffd000',
    notes: 'Vent fort',
  };

  it('never sends a user_id or any server-owned column', () => {
    const args = buildSaveRoundArgs({ ...baseInput, scorecard: completedScorecard() });

    expect(Object.keys(args).sort()).toEqual(['p_holes', 'p_round']);
    for (const forbidden of ['user_id', 'id', 'created_at']) {
      expect(args.p_round).not.toHaveProperty(forbidden);
    }
    for (const hole of args.p_holes) {
      expect(hole).not.toHaveProperty('user_id');
      expect(hole).not.toHaveProperty('round_id');
    }
  });

  it('carries the idempotency key and the round metadata', () => {
    const args = buildSaveRoundArgs({ ...baseInput, scorecard: completedScorecard() });

    expect(args.p_round).toMatchObject({
      client_request_id: baseInput.clientRequestId,
      played_at: baseInput.playedAt,
      course_id: 'course-1',
      course_name: 'Golf de Test',
      course_provider: 'catalog',
      provider_course_id: 'ext-1',
      tee_key: 'yellow',
      tee_set_id: 'tee-1',
      tee_name: 'Jaune',
      tee_color: '#ffd000',
      notes: 'Vent fort',
    });
  });

  it('derives the aggregates from the scorecard', () => {
    const scorecard = completedScorecard();
    scorecard[0] = { ...scorecard[0], score: 6, putts: 3, gir: true, penalty: 1 };

    const { p_round } = buildSaveRoundArgs({ ...baseInput, scorecard });

    expect(p_round.holes).toBe(18);
    expect(p_round.par).toBe(72);
    expect(p_round.total_score).toBe(72 + 2);
    expect(p_round.putts).toBe(18 * 2 + 1);
    expect(p_round.gir).toBe(1);
    expect(p_round.penalties).toBe(1);
    expect(p_round.fairways_total).toBe(scorecard.filter((hole) => hole.par > 3).length);
  });

  it('builds one hole entry per hole and nulls the fairway on par 3s', () => {
    const scorecard = completedScorecard(9).map((hole) => ({ ...hole, fairway_hit: true }));
    const { p_round, p_holes } = buildSaveRoundArgs({ ...baseInput, scorecard });

    expect(p_round.holes).toBe(9);
    expect(p_holes).toHaveLength(9);
    expect(p_holes.map((hole) => hole.hole_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const par3 = p_holes.find((hole) => hole.par === 3);
    expect(par3?.fairway_hit).toBeNull();
    expect(p_holes.find((hole) => hole.par === 4)?.fairway_hit).toBe(true);
  });

  it('defaults the optional catalog fields to null', () => {
    const args = buildSaveRoundArgs({
      clientRequestId: baseInput.clientRequestId,
      playedAt: baseInput.playedAt,
      courseId: null,
      courseName: null,
      teeKey: null,
      notes: null,
      scorecard: completedScorecard(),
    });

    expect(args.p_round).toMatchObject({
      course_provider: null,
      provider_course_id: null,
      tee_set_id: null,
      tee_name: null,
      tee_color: null,
    });
  });
});

describe('buildUpdateRoundArgs', () => {
  it('sends only the metadata when no scorecard is given', () => {
    const args = buildUpdateRoundArgs({ roundId: 'round-1', courseName: 'Nouveau nom', notes: null });

    expect(args).toEqual({
      p_round_id: 'round-1',
      p_round: { course_name: 'Nouveau nom', notes: null },
    });
    expect(args).not.toHaveProperty('p_holes');
  });

  it('sends the aggregates and every hole when a scorecard is given', () => {
    const scorecard = completedScorecard(9);
    const args = buildUpdateRoundArgs({ roundId: 'round-1', courseName: null, notes: 'n', scorecard });

    expect(args.p_round).toEqual({
      course_name: null,
      notes: 'n',
      total_score: 36,
      par: 36,
      putts: 18,
      gir: 0,
      fairways_hit: 0,
      fairways_total: scorecard.filter((hole) => hole.par > 3).length,
      penalties: 0,
    });
    expect(args.p_round).not.toHaveProperty('holes');
    expect(args.p_round).not.toHaveProperty('user_id');
    expect(args.p_holes).toHaveLength(9);
  });
});

describe('mapRoundSaveError', () => {
  const rawPostgresText = 'new row for relation "rounds" violates check constraint "rounds_score_range"';

  it.each([
    ['23514', 'Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.'],
    ['22023', 'Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.'],
    ['22P02', 'Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.'],
    ['23502', 'Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.'],
    ['28000', 'Ta session a expiré. Reconnecte-toi puis réessaie.'],
    ['PGRST301', 'Ta session a expiré. Reconnecte-toi puis réessaie.'],
    ['42501', 'Ta session a expiré. Reconnecte-toi puis réessaie.'],
    ['P0002', 'Ce round est introuvable. Il a peut-être été supprimé.'],
    ['23503', 'Ce round est introuvable. Il a peut-être été supprimé.'],
  ])('maps SQLSTATE %s to a French message', (code, message) => {
    expect(mapRoundSaveError({ code, message: rawPostgresText })).toBe(message);
  });

  it('never leaks the raw Postgres text', () => {
    for (const code of ['23514', '28000', 'P0002', '42883', 'XX000', '']) {
      expect(mapRoundSaveError({ code, message: rawPostgresText })).not.toContain('violates');
      expect(mapRoundSaveError({ code, message: rawPostgresText })).not.toContain('rounds_score_range');
    }
  });

  it('recognises network failures, which carry no SQLSTATE', () => {
    expect(mapRoundSaveError({ code: '', message: 'TypeError: Network request failed' }))
      .toBe('Connexion impossible. Vérifie ton réseau puis réessaie.');
    expect(mapRoundSaveError(new TypeError('Failed to fetch')))
      .toBe('Connexion impossible. Vérifie ton réseau puis réessaie.');
  });

  it('words a deadline that passed like any other network failure', () => {
    expect(mapRoundSaveError(new InvokeTimeoutError('Délai dépassé (15000 ms).')))
      .toBe('Connexion impossible. Vérifie ton réseau puis réessaie.');
  });

  it('falls back to an action-specific generic message', () => {
    expect(mapRoundSaveError({ code: 'XX000', message: 'boom' }, 'save'))
      .toBe('Impossible d’enregistrer ce round pour le moment. Réessaie dans un instant.');
    expect(mapRoundSaveError({ code: 'XX000', message: 'boom' }, 'update'))
      .toBe('Impossible de modifier ce round pour le moment. Réessaie dans un instant.');
    expect(mapRoundSaveError(null)).toBe('Impossible d’enregistrer ce round pour le moment. Réessaie dans un instant.');
  });

  it('keeps the message of an already mapped RoundSaveError', () => {
    const error = new RoundSaveError('Message déjà traduit', '23514');
    expect(getRoundSaveErrorMessage(error)).toBe('Message déjà traduit');
    expect(getRoundSaveErrorMessage({ code: '23514' })).toContain('invalides');
  });
});

describe('getErrorCode', () => {
  it('prefers the SQLSTATE, then the error name, and never the message', () => {
    expect(getErrorCode({ code: '23514', message: 'secret' })).toBe('23514');
    expect(getErrorCode(new TypeError('secret'))).toBe('TypeError');
    expect(getErrorCode(null)).toBe('unknown');
  });
});

describe('classifyRoundSaveFailure', () => {
  it.each([
    [{ code: '', message: 'TypeError: Network request failed' }, undefined],
    [{ code: '', message: 'TypeError: Failed to fetch' }, undefined],
    [{ code: '', message: 'AbortError: Aborted' }, undefined],
    [{ message: 'Request timed out' }, undefined],
    [new TypeError('Network request failed'), undefined],
    [Object.assign(new Error('signal'), { name: 'TimeoutError' }), undefined],
  ])('treats a failure without any answer as a network failure (%#)', (error, status) => {
    expect(classifyRoundSaveFailure(error, status)).toBe('network');
  });

  it.each([
    [{ code: '', message: '<html>Bad gateway</html>' }, 502],
    [{ code: '', message: 'upstream' }, 503],
    [{ code: '', message: 'upstream' }, 504],
    [{ code: '', message: 'slow' }, 408],
    [{ code: '', message: 'slow down' }, 429],
    [{ code: 'PGRST002', message: 'schema cache' }, undefined],
    [{ code: 'PGRST003', message: 'pool timeout' }, undefined],
    [{ code: '57014', message: 'canceling statement due to statement timeout' }, undefined],
    [{ code: '08006', message: 'connection failure' }, undefined],
    [{ code: '40P01', message: 'deadlock detected' }, undefined],
    [{ code: '53300', message: 'too many connections' }, undefined],
  ])('treats a 5xx-like answer as a server failure (%#)', (error, status) => {
    expect(classifyRoundSaveFailure(error, status)).toBe('server');
  });

  it.each([
    [{ code: '28000' }, undefined],
    [{ code: '42501' }, undefined],
    [{ code: 'PGRST301' }, undefined],
    [{ code: 'PGRST302' }, undefined],
    [{ code: '' }, 401],
    [{ code: '' }, 403],
  ])('treats a refused session as an auth failure (%#)', (error, status) => {
    expect(classifyRoundSaveFailure(error, status)).toBe('auth');
  });

  it.each(['22003', '22007', '22P02', '22001', '23502', '23503', '23505', '23514', 'P0002'])(
    'treats SQLSTATE %s as a permanent rejection of the data',
    (code) => {
      expect(classifyRoundSaveFailure({ code, message: 'violates check constraint' })).toBe('permanent');
    },
  );

  it('does not retry what it cannot recognise', () => {
    expect(classifyRoundSaveFailure({ code: 'XX000', message: 'boom' })).toBe('permanent');
    expect(classifyRoundSaveFailure({ code: 'PGRST202', message: 'function not found' }, 404)).toBe('permanent');
    expect(classifyRoundSaveFailure({ message: 'boom' })).toBe('permanent');
    expect(classifyRoundSaveFailure(null)).toBe('permanent');
    expect(classifyRoundSaveFailure(undefined)).toBe('permanent');
  });

  it('does not mistake a network-sounding message that carries a SQLSTATE for a network failure', () => {
    expect(classifyRoundSaveFailure({ code: '23514', message: 'connection check violated' })).toBe('permanent');
  });

  it('treats the client-side deadline as a network failure', () => {
    expect(classifyRoundSaveFailure(new InvokeTimeoutError('Délai dépassé (15000 ms).'))).toBe('network');
    expect(classifyRoundSaveFailure(new RoundSaveError('m', 'timeout', 'network'))).toBe('network');
    expect(classifyRoundSaveFailure({ code: '', message: 'AbortError: The user aborted a request.' }, 0)).toBe('network');
    expect(classifyRoundSaveFailure(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))).toBe('network');
  });

  it('keeps the kind of an already classified RoundSaveError', () => {
    expect(classifyRoundSaveFailure(new RoundSaveError('m', 'unknown', 'network'))).toBe('network');
    expect(classifyRoundSaveFailure(new RoundSaveError('m', '23514', 'permanent'))).toBe('permanent');
    expect(classifyRoundSaveFailure(new RoundSaveError('m', '28000'))).toBe('permanent');
  });
});

describe('saveRound / updateRound', () => {
  beforeEach(() => {
    rpc.mockReset();
    abortSignal.mockReset();
  });

  it('calls the save_round RPC and returns the saved round', async () => {
    const saved = { id: 'round-1' } as Round;
    mockSaveRpc(Promise.resolve({ data: saved, error: null }));
    const args = saveArgs();

    await expect(saveRound(args)).resolves.toBe(saved);
    expect(rpc).toHaveBeenCalledWith('save_round', args);
  });

  it('throws a French RoundSaveError instead of the raw database error', async () => {
    mockSaveRpc(Promise.resolve({
      data: null,
      error: { code: '23514', message: 'violates check constraint "rounds_par_range"' },
    }));

    const promise = saveRound(saveArgs());

    await expect(promise).rejects.toBeInstanceOf(RoundSaveError);
    await expect(promise).rejects.toMatchObject({ code: '23514' });
    await expect(promise).rejects.not.toThrow('rounds_par_range');
  });

  it.each([
    [{ code: '', message: 'TypeError: Network request failed', details: '', hint: '' }, 0, 'network'],
    [{ message: '<html>Bad gateway</html>' }, 502, 'server'],
    [{ code: '23514', message: 'violates check constraint' }, 400, 'permanent'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 401, 'auth'],
  ])('tags the thrown RoundSaveError with its failure kind (%#)', async (error, status, kind) => {
    mockSaveRpc(Promise.resolve({ data: null, error, status }));

    await expect(saveRound(saveArgs())).rejects.toMatchObject({ kind });
  });

  describe('timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('gives up after 15 seconds and reports a network failure', async () => {
      mockSaveRpc(new Promise(() => undefined));
      const promise = saveRound(saveArgs());
      const assertion = expect(promise).rejects.toMatchObject({
        name: 'RoundSaveError',
        code: 'timeout',
        kind: 'network',
        message: 'Connexion impossible. Vérifie ton réseau puis réessaie.',
      });

      expect(SAVE_ROUND_TIMEOUT_MS).toBe(15_000);
      await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS - 1);
      expect(abortSignal.mock.calls[0][0].aborted).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await assertion;
      expect(abortSignal.mock.calls[0][0].aborted).toBe(true);
    });

    it('hands the abort signal to the request so the connection is dropped', async () => {
      mockSaveRpc(new Promise(() => undefined));
      const promise = saveRound(saveArgs());
      const assertion = expect(promise).rejects.toBeInstanceOf(RoundSaveError);

      expect(abortSignal).toHaveBeenCalledTimes(1);
      expect(abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);

      await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS);
      await assertion;
    });

    it('does not wait when the answer comes in time, and leaves no timer behind', async () => {
      const saved = { id: 'round-1' } as Round;
      mockSaveRpc(Promise.resolve({ data: saved, error: null }));

      await expect(saveRound(saveArgs())).resolves.toBe(saved);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('ignores an answer that arrives after the timeout', async () => {
      let answer!: (value: unknown) => void;
      mockSaveRpc(new Promise((resolve) => {
        answer = resolve;
      }));
      const promise = saveRound(saveArgs());
      const assertion = expect(promise).rejects.toMatchObject({ kind: 'network' });

      await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS);
      await assertion;
      answer({ data: { id: 'round-late' }, error: null, status: 201 });
      await jest.advanceTimersByTimeAsync(0);

      await expect(promise).rejects.toMatchObject({ code: 'timeout' });
    });

    it('reports a request aborted by the client as a network failure', async () => {
      mockSaveRpc(Promise.resolve({
        data: null,
        error: { message: 'AbortError: The user aborted a request.', details: '', hint: 'Request was aborted (timeout or manual cancellation)', code: '' },
        status: 0,
      }));

      await expect(saveRound(saveArgs())).rejects.toMatchObject({ kind: 'network' });
    });

    it('resends the same idempotency key after a timeout, and the server returns the round it already saved', async () => {
      const args = saveArgs();
      const existing = { id: 'round-1', user_id: 'user-1' } as Round;
      mockSaveRpc(new Promise(() => undefined));
      const first = saveRound(args);
      const firstAssertion = expect(first).rejects.toMatchObject({ kind: 'network' });
      await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS);
      await firstAssertion;

      mockSaveRpc(Promise.resolve({ data: existing, error: null, status: 200 }));

      await expect(saveRound(args)).resolves.toBe(existing);
      expect(rpc.mock.calls.map(([, sent]) => sent.p_round.client_request_id)).toEqual([
        args.p_round.client_request_id,
        args.p_round.client_request_id,
      ]);
    });
  });

  it('calls the update_round RPC with the metadata-only arguments', async () => {
    const updated = { id: 'round-1' } as Round;
    rpc.mockResolvedValue({ data: updated, error: null });
    const args = buildUpdateRoundArgs({ roundId: 'round-1', courseName: 'Golf', notes: null });

    await expect(updateRound(args)).resolves.toBe(updated);
    expect(rpc).toHaveBeenCalledWith('update_round', args);
  });

  it('maps update errors with the update wording', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });

    await expect(updateRound(buildUpdateRoundArgs({ roundId: 'round-1', courseName: null, notes: null })))
      .rejects.toThrow('Impossible de modifier ce round pour le moment. Réessaie dans un instant.');
  });
});
