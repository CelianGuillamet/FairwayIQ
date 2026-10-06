const mockSaveRound = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock('../lib/round-save', () => ({
  ...jest.requireActual('../lib/round-save'),
  saveRound: (args: unknown) => mockSaveRound(args),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoundSaveError, buildSaveRoundArgs, type SaveRoundArgs } from '../lib/round-save';
import {
  BACKOFF_BASE_MS,
  MAX_QUEUE_SIZE,
  getRoundQueueStorageKey,
  loadQueue,
  saveQueue,
  type QueuedRound,
} from '../lib/round-save-queue';
import { createDefaultScorecard } from '../lib/rounds';
import type { Round } from '../types';
import { MIN_AUTO_FLUSH_GAP_MS, onQueuedRoundSent, useRoundQueueStore, type QueuedRoundSent } from './round-queue';
import { useRoundsStore } from './rounds';

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);

let clock = NOW;
let sent: QueuedRoundSent[];
let stopListening: () => void;

function argsFor(id: string): SaveRoundArgs {
  return buildSaveRoundArgs({
    clientRequestId: id,
    playedAt: '2026-10-05T10:00:00.000Z',
    courseId: null,
    courseName: `Parcours ${id}`,
    teeKey: null,
    notes: null,
    scorecard: createDefaultScorecard(18).map((hole) => ({ ...hole, completed: true })),
  });
}

function entry(id: string, overrides: Partial<QueuedRound> = {}): QueuedRound {
  return {
    clientRequestId: id,
    args: argsFor(id),
    createdAt: new Date(NOW).toISOString(),
    attempts: 0,
    status: 'pending',
    ...overrides,
  };
}

function savedRound(id: string, userId = 'user-1') {
  return { id: `round-${id}`, user_id: userId, played_at: '2026-10-05T10:00:00.000Z', holes: 18, total_score: 90, par: 72 } as unknown as Round;
}

function networkError() {
  return new RoundSaveError('Connexion impossible. Vérifie ton réseau puis réessaie.', 'unknown', 'network');
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function seed(userId: string, entries: QueuedRound[]) {
  await saveQueue(userId, entries);
  await useRoundQueueStore.getState().load(userId);
}

async function stored(userId: string) {
  return (await loadQueue(userId))?.map((item) => item.clientRequestId);
}

function state() {
  return useRoundQueueStore.getState();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  clock = NOW;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockSaveRound.mockReset();
  mockSaveRound.mockImplementation(async (args: SaveRoundArgs) => savedRound(args.p_round.client_request_id));
  useRoundQueueStore.getState().reset();
  useRoundsStore.getState().reset();
  sent = [];
  stopListening = onQueuedRoundSent((event) => sent.push(event));
});

afterEach(() => {
  stopListening();
  jest.restoreAllMocks();
});

describe('load', () => {
  it('reads the queue of the user', async () => {
    await saveQueue('user-1', [entry('a'), entry('b')]);

    await state().load('user-1');

    expect(state()).toMatchObject({ userId: 'user-1', loaded: true });
    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['a', 'b']);
  });

  it('does not read the queue of another user', async () => {
    await saveQueue('user-1', [entry('a')]);

    await state().load('user-2');

    expect(state()).toMatchObject({ userId: 'user-2', loaded: true, entries: [] });
  });

  it('shares one read between simultaneous loads', async () => {
    await saveQueue('user-1', [entry('a')]);
    (AsyncStorage.getItem as jest.Mock).mockClear();

    await Promise.all([state().load('user-1'), state().load('user-1')]);

    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  });

  it('is not loaded when the storage cannot be read', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await state().load('user-1');

    expect(state()).toMatchObject({ loaded: false, entries: [] });
  });

  it('starts empty on corrupt storage', async () => {
    await AsyncStorage.setItem(getRoundQueueStorageKey('user-1'), '{broken');

    await state().load('user-1');

    expect(state()).toMatchObject({ loaded: true, entries: [] });
  });

  it('drops a load that finishes after a reset', async () => {
    await saveQueue('user-1', [entry('a')]);

    const loading = state().load('user-1');
    state().reset();
    await loading;

    expect(state()).toMatchObject({ userId: null, loaded: false, entries: [] });
  });
});

describe('enqueue', () => {
  it('stores the round with the arguments and the key of the failed save', async () => {
    const args = argsFor('a');

    await expect(state().enqueue('user-1', args)).resolves.toBe('added');

    expect(state().entries).toHaveLength(1);
    expect(state().entries[0]).toMatchObject({ clientRequestId: 'a', status: 'pending', attempts: 0 });
    expect(state().entries[0].args).toEqual(args);
    expect(await stored('user-1')).toEqual(['a']);
  });

  it('is idempotent on the client request id', async () => {
    await state().enqueue('user-1', argsFor('a'));

    await expect(state().enqueue('user-1', argsFor('a'))).resolves.toBe('duplicate');

    expect(state().entries).toHaveLength(1);
    expect(await stored('user-1')).toEqual(['a']);
  });

  it('keeps arrival order', async () => {
    await state().enqueue('user-1', argsFor('a'));
    clock += 1_000;
    await state().enqueue('user-1', argsFor('b'));

    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['a', 'b']);
    expect(await stored('user-1')).toEqual(['a', 'b']);
  });

  it('refuses a round beyond the size limit', async () => {
    await saveQueue('user-1', Array.from({ length: MAX_QUEUE_SIZE }, (_, index) => entry(`r${index}`)));
    await state().load('user-1');

    await expect(state().enqueue('user-1', argsFor('extra'))).resolves.toBe('full');

    expect(state().entries).toHaveLength(MAX_QUEUE_SIZE);
    expect(await loadQueue('user-1')).toHaveLength(MAX_QUEUE_SIZE);
  });

  it('reports a storage that cannot be written, and keeps nothing in memory', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('full'));

    await expect(state().enqueue('user-1', argsFor('a'))).resolves.toBe('storage');

    expect(state().entries).toEqual([]);
    expect(await stored('user-1')).toEqual([]);
  });

  it('reports a storage that cannot be read instead of replacing the stored queue', async () => {
    await seed('user-1', [entry('a')]);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await expect(state().enqueue('user-1', argsFor('b'))).resolves.toBe('storage');

    expect(await stored('user-1')).toEqual(['a']);
  });

  it('works before the queue was loaded and adopts what is stored', async () => {
    await saveQueue('user-1', [entry('a')]);

    await expect(state().enqueue('user-1', argsFor('b'))).resolves.toBe('added');

    expect(state()).toMatchObject({ userId: 'user-1', loaded: true });
    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['a', 'b']);
  });

  it('does not touch the memory of another loaded user', async () => {
    await seed('user-2', [entry('x')]);

    await expect(state().enqueue('user-1', argsFor('a'))).resolves.toBe('added');

    expect(state().userId).toBe('user-2');
    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['x']);
    expect(await stored('user-1')).toEqual(['a']);
    expect(await stored('user-2')).toEqual(['x']);
  });

  it('does not lose an enqueue that lands while a flush is writing', async () => {
    await seed('user-1', [entry('a')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise).mockRejectedValueOnce(networkError());

    const flushing = state().flush('manual');
    await state().enqueue('user-1', argsFor('b'));
    pending.resolve(savedRound('a'));
    await flushing;

    expect(mockSaveRound.mock.calls.map(([args]) => args.p_round.client_request_id)).toEqual(['a', 'b']);
    expect(await stored('user-1')).toEqual(['b']);
    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['b']);
  });
});

describe('flush', () => {
  it('sends the round, adds it to the rounds list, announces it and removes it from the queue', async () => {
    await seed('user-1', [entry('a')]);

    await state().flush('manual');

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(mockSaveRound.mock.calls[0][0]).toEqual(argsFor('a'));
    expect(useRoundsStore.getState().rounds.map((round) => round.id)).toEqual(['round-a']);
    expect(sent).toHaveLength(1);
    expect(sent[0].round.id).toBe('round-a');
    expect(sent[0].scorecard).toHaveLength(18);
    expect(state().entries).toEqual([]);
    expect(await stored('user-1')).toEqual([]);
    expect(state().flushing).toBe(false);
  });

  it('hands the hole payloads to the post-save listeners', async () => {
    await seed('user-1', [entry('a')]);

    await state().flush('manual');

    expect(sent[0].scorecard).toEqual(argsFor('a').p_holes);
  });

  it('sends the rounds in the order they were played', async () => {
    await seed('user-1', [entry('a'), entry('b'), entry('c')]);

    await state().flush('manual');

    expect(mockSaveRound.mock.calls.map(([args]) => args.p_round.client_request_id)).toEqual(['a', 'b', 'c']);
    expect(sent.map((event) => event.round.id)).toEqual(['round-a', 'round-b', 'round-c']);
    expect(state().entries).toEqual([]);
  });

  it('shows the sending state while the round is on its way', async () => {
    await seed('user-1', [entry('a')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise);

    const flushing = state().flush('manual');
    expect(state().flushing).toBe(true);

    pending.resolve(savedRound('a'));
    await flushing;
    expect(state().flushing).toBe(false);
  });

  it('keeps the round and backs off after a network failure, and stops there', async () => {
    await seed('user-1', [entry('a'), entry('b')]);
    mockSaveRound.mockRejectedValue(networkError());

    await state().flush('manual');

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(state().entries[0]).toMatchObject({
      clientRequestId: 'a',
      status: 'pending',
      attempts: 1,
      lastError: 'network',
      nextAttemptAt: NOW + BACKOFF_BASE_MS,
    });
    expect(state().entries[1]).toMatchObject({ clientRequestId: 'b', attempts: 0 });
    expect(await stored('user-1')).toEqual(['a', 'b']);
    expect(sent).toEqual([]);
    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(state().flushing).toBe(false);
  });

  it('recognises a raw network error thrown by the client', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockRejectedValue(new TypeError('Network request failed'));

    await state().flush('manual');

    expect(state().entries[0]).toMatchObject({ status: 'pending', lastError: 'network', attempts: 1 });
  });

  it('keeps a round that failed on a 5xx for another try', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockRejectedValue(new RoundSaveError('x', 'unknown', 'server'));

    await state().flush('manual');

    expect(state().entries[0]).toMatchObject({ status: 'pending', attempts: 1, answeredFailures: 1 });
  });

  it('does not retry a permanent rejection: the round needs attention, the next one still goes out', async () => {
    await seed('user-1', [entry('a'), entry('b')]);
    mockSaveRound
      .mockRejectedValueOnce(new RoundSaveError('x', '23514', 'permanent'))
      .mockImplementationOnce(async (args: SaveRoundArgs) => savedRound(args.p_round.client_request_id));

    await state().flush('manual');

    expect(mockSaveRound).toHaveBeenCalledTimes(2);
    expect(state().entries).toHaveLength(1);
    expect(state().entries[0]).toMatchObject({ clientRequestId: 'a', status: 'needs_attention', lastError: '23514' });
    expect(await stored('user-1')).toEqual(['a']);
    expect(useRoundsStore.getState().rounds.map((round) => round.id)).toEqual(['round-b']);

    mockSaveRound.mockClear();
    clock += 10 * 60_000;
    await state().flush('timer');
    await state().flush('manual');

    expect(mockSaveRound).not.toHaveBeenCalled();
  });

  it('does not use up the spacing of automatic triggers when nothing was due', async () => {
    await seed('user-1', [entry('a', { attempts: 1, nextAttemptAt: NOW + 60_000 })]);

    await state().flush('timer');
    clock += 1_000;
    await state().flush('network');

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
  });

  it('only retries a round whose backoff has elapsed when the timer fires', async () => {
    await seed('user-1', [entry('a', { attempts: 1, nextAttemptAt: NOW + 30_000 })]);

    await state().flush('timer');
    expect(mockSaveRound).not.toHaveBeenCalled();

    clock = NOW + 29_999;
    await state().flush('timer');
    expect(mockSaveRound).not.toHaveBeenCalled();

    clock = NOW + 30_000;
    await state().flush('timer');
    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(state().entries).toEqual([]);
  });

  it.each(['session', 'foreground', 'network', 'manual'] as const)('ignores the backoff on %s', async (reason) => {
    await seed('user-1', [entry('a', { attempts: 3, nextAttemptAt: NOW + 120_000 })]);

    await state().flush(reason);

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(state().entries).toEqual([]);
  });

  it('grows the backoff with every failed attempt', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockRejectedValue(networkError());

    const delays: number[] = [];
    for (let index = 0; index < 3; index++) {
      await state().flush('manual');
      delays.push((state().entries[0].nextAttemptAt as number) - clock);
      clock += 1_000;
    }

    expect(delays).toEqual([30_000, 60_000, 120_000]);
  });

  it('is single-flight: overlapping flushes share one run and send each round once', async () => {
    await seed('user-1', [entry('a'), entry('b')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise);

    const first = state().flush('manual');
    const second = state().flush('manual');
    const third = state().flush('foreground');

    expect(second).toBe(first);
    expect(third).toBe(first);

    pending.resolve(savedRound('a'));
    await Promise.all([first, second, third]);

    expect(mockSaveRound.mock.calls.map(([args]) => args.p_round.client_request_id)).toEqual(['a', 'b']);
  });

  it('can start again once the previous run is over', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockRejectedValueOnce(networkError());

    await state().flush('manual');
    await state().flush('manual');

    expect(mockSaveRound).toHaveBeenCalledTimes(2);
    expect(state().entries).toEqual([]);
  });

  it('does not hammer the server: automatic triggers are spaced out, manual ones are not', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockRejectedValue(networkError());

    await state().flush('foreground');
    await state().flush('network');
    await state().flush('foreground');
    expect(mockSaveRound).toHaveBeenCalledTimes(1);

    clock += MIN_AUTO_FLUSH_GAP_MS - 1;
    await state().flush('network');
    expect(mockSaveRound).toHaveBeenCalledTimes(1);

    await state().flush('manual');
    expect(mockSaveRound).toHaveBeenCalledTimes(2);

    clock += MIN_AUTO_FLUSH_GAP_MS;
    await state().flush('network');
    expect(mockSaveRound).toHaveBeenCalledTimes(3);
  });

  it('does nothing when the queue is empty, not loaded or has no user', async () => {
    await state().flush('manual');
    await seed('user-1', []);
    await state().flush('manual');

    expect(mockSaveRound).not.toHaveBeenCalled();
    expect(state().flushing).toBe(false);
  });

  it('does not send anything for a queue that could not be read', async () => {
    await saveQueue('user-1', [entry('a')]);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    await state().load('user-1');

    await state().flush('manual');

    expect(mockSaveRound).not.toHaveBeenCalled();
  });

  it('resends with the same idempotency key after a response that never arrived', async () => {
    await state().enqueue('user-1', argsFor('lost-response'));
    mockSaveRound.mockRejectedValueOnce(networkError());

    await state().flush('manual');
    await state().flush('manual');

    const keys = mockSaveRound.mock.calls.map(([args]) => args.p_round.client_request_id);
    expect(keys).toEqual(['lost-response', 'lost-response']);
    expect(useRoundsStore.getState().rounds).toHaveLength(1);
    expect(state().entries).toEqual([]);
  });

  it('keeps the round for one more try, with the same key, when it could not be removed after a success', async () => {
    await seed('user-1', [entry('a')]);
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await state().flush('manual');
    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['a']);
    expect(useRoundsStore.getState().rounds).toHaveLength(1);

    await state().flush('manual');

    expect(mockSaveRound.mock.calls.map(([args]) => args.p_round.client_request_id)).toEqual(['a', 'a']);
    expect(useRoundsStore.getState().rounds).toHaveLength(1);
    expect(state().entries).toEqual([]);
    expect(await stored('user-1')).toEqual([]);
  });

  it('keeps the round in the list that is already there', async () => {
    useRoundsStore.setState({ rounds: [savedRound('old')], initialized: true, loading: false });
    await seed('user-1', [entry('a')]);

    await state().flush('manual');

    expect(useRoundsStore.getState().rounds.map((round) => round.id).sort()).toEqual(['round-a', 'round-old']);
  });

  it('still removes a round the server accepted but answered without a row', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockResolvedValue(null);

    await state().flush('manual');

    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(sent).toEqual([]);
    expect(state().entries).toEqual([]);
  });

  it('is not stopped by a post-save listener that throws', async () => {
    stopListening();
    stopListening = onQueuedRoundSent(() => {
      throw new Error('listener');
    });
    await seed('user-1', [entry('a'), entry('b')]);

    await state().flush('manual');

    expect(mockSaveRound).toHaveBeenCalledTimes(2);
    expect(state().entries).toEqual([]);
  });

  it('asks for attention after the server keeps answering with errors', async () => {
    await seed('user-1', [entry('a')]);
    mockSaveRound.mockRejectedValue(new RoundSaveError('x', '57014', 'server'));

    for (let index = 0; index < 5; index++) {
      await state().flush('manual');
    }

    expect(state().entries[0]).toMatchObject({ status: 'needs_attention', lastError: '57014' });
  });
});

describe('user isolation', () => {
  it('never sends the queued rounds of another user', async () => {
    await saveQueue('user-1', [entry('a')]);

    await state().load('user-2');
    await state().flush('manual');

    expect(mockSaveRound).not.toHaveBeenCalled();
    expect(await stored('user-1')).toEqual(['a']);
  });

  it('keeps the rounds of a user who signed out, for when they come back', async () => {
    await seed('user-1', [entry('a')]);

    state().reset();

    expect(state()).toMatchObject({ userId: null, entries: [], loaded: false, flushing: false });
    expect(await stored('user-1')).toEqual(['a']);

    await state().load('user-1');
    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['a']);
  });

  it('does not send anything once the user is gone', async () => {
    await seed('user-1', [entry('a')]);
    state().reset();

    await state().flush('manual');

    expect(mockSaveRound).not.toHaveBeenCalled();
  });

  it('stops before the next round when the user changes during a flush', async () => {
    await seed('user-1', [entry('a'), entry('b')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise);

    const flushing = state().flush('manual');
    state().reset();
    await state().load('user-2');
    pending.resolve(savedRound('a'));
    await flushing;

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(mockSaveRound.mock.calls[0][0].p_round.client_request_id).toBe('a');
    expect(await stored('user-1')).toEqual(['b']);
  });

  it('does not add a round to the list of the next user when it lands after a user change', async () => {
    await seed('user-1', [entry('a')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise);

    const flushing = state().flush('manual');
    state().reset();
    useRoundsStore.getState().reset();
    await state().load('user-2');
    pending.resolve(savedRound('a'));
    await flushing;

    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(sent).toEqual([]);
    expect(state()).toMatchObject({ userId: 'user-2', entries: [], flushing: false });
    expect(await stored('user-1')).toEqual([]);
  });

  it('lets the next user flush while the previous run is still waiting', async () => {
    await seed('user-1', [entry('a')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise);
    const previous = state().flush('manual');

    state().reset();
    await seed('user-2', [entry('x')]);
    await state().flush('manual');

    expect(mockSaveRound.mock.calls.map(([args]) => args.p_round.client_request_id)).toEqual(['a', 'x']);
    expect(await stored('user-2')).toEqual([]);

    pending.resolve(savedRound('a'));
    await previous;
    expect(state()).toMatchObject({ userId: 'user-2', flushing: false });
  });

  it('records a failure that lands after a user change for its owner only', async () => {
    await seed('user-1', [entry('a')]);
    const pending = deferred<Round>();
    mockSaveRound.mockReturnValueOnce(pending.promise);

    const flushing = state().flush('manual');
    state().reset();
    await state().load('user-2');
    pending.reject(networkError());
    await flushing;

    expect(state().entries).toEqual([]);
    const [owned] = (await loadQueue('user-1')) ?? [];
    expect(owned).toMatchObject({ clientRequestId: 'a', attempts: 1, lastError: 'network' });
    expect(await stored('user-2')).toEqual([]);
  });
});

describe('retry', () => {
  it('puts a round that needed attention back in line and sends it', async () => {
    await seed('user-1', [entry('a', { status: 'needs_attention', attempts: 2, lastError: '57014' })]);

    await state().retry();

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(state().entries).toEqual([]);
  });

  it('keeps it in the queue, as a fresh pending round, when it fails again with the network down', async () => {
    await seed('user-1', [entry('a', { status: 'needs_attention', attempts: 5, lastError: '57014' })]);
    mockSaveRound.mockRejectedValue(networkError());

    await state().retry();

    expect(state().entries[0]).toMatchObject({ status: 'pending', attempts: 1, lastError: 'network' });
  });

  it('sends a round that is waiting for its backoff', async () => {
    await seed('user-1', [entry('a', { attempts: 3, nextAttemptAt: NOW + 120_000 })]);

    await state().retry();

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a user', async () => {
    await state().retry();

    expect(mockSaveRound).not.toHaveBeenCalled();
  });
});

describe('discard', () => {
  it('removes the round from memory and storage, and leaves the others', async () => {
    await seed('user-1', [entry('a', { status: 'needs_attention' }), entry('b')]);

    await state().discard('a');

    expect(state().entries.map((item) => item.clientRequestId)).toEqual(['b']);
    expect(await stored('user-1')).toEqual(['b']);
  });

  it('ignores an unknown round', async () => {
    await seed('user-1', [entry('a')]);

    await state().discard('missing');

    expect(await stored('user-1')).toEqual(['a']);
  });
});
