const mockRpc = jest.fn();
const mockAbortSignal = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_ROUND_TIMEOUT_MS, buildSaveRoundArgs, saveRound, type SaveRoundArgs } from '../lib/round-save';
import { resolveSaveFailure } from '../lib/round-save-flow';
import { loadQueue, saveQueue, type QueuedRound } from '../lib/round-save-queue';
import { createDefaultScorecard } from '../lib/rounds';
import type { Round } from '../types';
import { useRoundQueueStore } from './round-queue';
import { useRoundsStore } from './rounds';

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

function entry(id: string): QueuedRound {
  return { clientRequestId: id, args: argsFor(id), createdAt: '2026-10-05T10:00:00.000Z', attempts: 0, status: 'pending' };
}

function serverRound(id: string) {
  return { id: `round-${id}`, user_id: 'user-1', played_at: '2026-10-05T10:00:00.000Z', holes: 18, total_score: 90, par: 72 } as unknown as Round;
}

function answerWith(promise: Promise<unknown>) {
  mockAbortSignal.mockReturnValueOnce(promise);
  mockRpc.mockReturnValueOnce({ abortSignal: mockAbortSignal });
}

function hang() {
  let answer!: (value: unknown) => void;
  answerWith(new Promise((resolve) => {
    answer = resolve;
  }));
  return answer;
}

function sentKeys() {
  return mockRpc.mock.calls.map(([, args]) => args.p_round.client_request_id);
}

async function stored() {
  return (await loadQueue('user-1'))?.map((item) => item.clientRequestId);
}

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  mockRpc.mockReset();
  mockAbortSignal.mockReset();
  useRoundQueueStore.getState().reset();
  useRoundsStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the queue flush and the 15 s deadline', () => {
  it('gives up on a request that hangs, keeps the round and backs off like for any network failure', async () => {
    await saveQueue('user-1', [entry('a')]);
    await useRoundQueueStore.getState().load('user-1');
    hang();

    const flushing = useRoundQueueStore.getState().flush('manual');
    await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS - 1);
    expect(useRoundQueueStore.getState().flushing).toBe(true);

    await jest.advanceTimersByTimeAsync(1);
    await flushing;

    const [kept] = useRoundQueueStore.getState().entries;
    expect(kept).toMatchObject({ clientRequestId: 'a', status: 'pending', attempts: 1, lastError: 'network' });
    expect(kept.nextAttemptAt).toBeGreaterThan(Date.now());
    expect(mockAbortSignal.mock.calls[0][0].aborted).toBe(true);
    expect(useRoundQueueStore.getState().flushing).toBe(false);
    expect(await stored()).toEqual(['a']);
    expect(useRoundsStore.getState().rounds).toEqual([]);
  });

  it('stops at the first round that times out instead of waiting 15 s for each queued round', async () => {
    await saveQueue('user-1', [entry('a'), entry('b'), entry('c')]);
    await useRoundQueueStore.getState().load('user-1');
    hang();

    const flushing = useRoundQueueStore.getState().flush('manual');
    await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS);
    await flushing;

    expect(sentKeys()).toEqual(['a']);
    expect(await stored()).toEqual(['a', 'b', 'c']);
  });

  it('sends the round on the next try once the connection answers in time', async () => {
    await saveQueue('user-1', [entry('a')]);
    await useRoundQueueStore.getState().load('user-1');
    hang();
    const first = useRoundQueueStore.getState().flush('manual');
    await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS);
    await first;

    answerWith(Promise.resolve({ data: serverRound('a'), error: null, status: 201 }));
    await useRoundQueueStore.getState().flush('manual');

    expect(sentKeys()).toEqual(['a', 'a']);
    expect(useRoundsStore.getState().rounds.map((round) => round.id)).toEqual(['round-a']);
    expect(await stored()).toEqual([]);
  });
});

describe('a save that timed out although the server kept it', () => {
  it('queues the round at the deadline, then never duplicates it when the queue resends', async () => {
    const args = argsFor('lost');
    const lateAnswer = hang();

    const failure = saveRound(args).then(() => null, (error: unknown) => error);
    await jest.advanceTimersByTimeAsync(SAVE_ROUND_TIMEOUT_MS);
    const resolution = await resolveSaveFailure(await failure, () => useRoundQueueStore.getState().enqueue('user-1', args));

    expect(resolution).toEqual({ queued: true });
    expect(await stored()).toEqual(['lost']);
    expect(useRoundsStore.getState().rounds).toEqual([]);

    lateAnswer({ data: serverRound('lost'), error: null, status: 201 });
    await jest.advanceTimersByTimeAsync(0);
    expect(useRoundsStore.getState().rounds).toEqual([]);

    answerWith(Promise.resolve({ data: serverRound('lost'), error: null, status: 200 }));
    await useRoundQueueStore.getState().flush('manual');

    expect(sentKeys()).toEqual(['lost', 'lost']);
    expect(useRoundsStore.getState().rounds.map((round) => round.id)).toEqual(['round-lost']);
    expect(await stored()).toEqual([]);
  });
});
