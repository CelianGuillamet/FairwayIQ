jest.mock('./supabase', () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  MAX_ANSWERED_FAILURES,
  MAX_QUEUE_SIZE,
  ROUND_QUEUE_VERSION,
  enqueueRound,
  getBackoffDelayMs,
  getNextDue,
  getRoundQueueStorageKey,
  isDue,
  loadQueue,
  parseQueue,
  recordFailure,
  removeRound,
  reviveAttention,
  saveQueue,
  serializeQueue,
  summarizeQueue,
  updateQueue,
  type QueuedRound,
} from './round-save-queue';
import { buildSaveRoundArgs, type SaveRoundArgs } from './round-save';
import { createDefaultScorecard } from './rounds';

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);

function argsFor(id: string, overrides: { courseName?: string | null; holes?: 9 | 18 } = {}): SaveRoundArgs {
  return buildSaveRoundArgs({
    clientRequestId: id,
    playedAt: '2026-10-05T10:00:00.000Z',
    courseId: null,
    courseName: overrides.courseName ?? 'Golf de Test',
    teeKey: null,
    notes: null,
    scorecard: createDefaultScorecard(overrides.holes ?? 18).map((hole) => ({ ...hole, completed: true })),
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

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getBackoffDelayMs', () => {
  it('waits nothing before the first failure', () => {
    expect(getBackoffDelayMs(0)).toBe(0);
    expect(getBackoffDelayMs(-3)).toBe(0);
    expect(getBackoffDelayMs(Number.NaN)).toBe(0);
  });

  it('doubles after every failure', () => {
    expect([1, 2, 3, 4].map(getBackoffDelayMs)).toEqual([
      BACKOFF_BASE_MS,
      BACKOFF_BASE_MS * 2,
      BACKOFF_BASE_MS * 4,
      BACKOFF_BASE_MS * 8,
    ]);
  });

  it('never exceeds the ceiling, however many times it failed', () => {
    expect(getBackoffDelayMs(6)).toBe(BACKOFF_MAX_MS);
    expect(getBackoffDelayMs(500)).toBe(BACKOFF_MAX_MS);
  });

  it('only ever grows', () => {
    const delays = Array.from({ length: 12 }, (_, index) => getBackoffDelayMs(index + 1));
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });
});

describe('isDue', () => {
  it('is due at once when it never failed', () => {
    expect(isDue(entry('a'), NOW)).toBe(true);
  });

  it('waits for its backoff to elapse', () => {
    const waiting = entry('a', { attempts: 1, nextAttemptAt: NOW + 30_000 });

    expect(isDue(waiting, NOW)).toBe(false);
    expect(isDue(waiting, NOW + 29_999)).toBe(false);
    expect(isDue(waiting, NOW + 30_000)).toBe(true);
  });

  it('is never due while it needs attention', () => {
    expect(isDue(entry('a', { status: 'needs_attention' }), NOW)).toBe(false);
  });

  it('does not stay stuck when the clock moved back', () => {
    const stuck = entry('a', { attempts: 3, nextAttemptAt: NOW + BACKOFF_MAX_MS + 1 });

    expect(isDue(stuck, NOW)).toBe(true);
    expect(isDue({ ...stuck, nextAttemptAt: NOW + BACKOFF_MAX_MS }, NOW)).toBe(false);
  });
});

describe('enqueueRound', () => {
  it('appends a pending entry that carries the arguments untouched', () => {
    const args = argsFor('a');
    const { entries, result } = enqueueRound([], args, NOW);

    expect(result).toBe('added');
    expect(entries).toEqual([
      { clientRequestId: 'a', args, createdAt: new Date(NOW).toISOString(), attempts: 0, status: 'pending' },
    ]);
    expect(entries[0].args).toBe(args);
  });

  it('keeps arrival order', () => {
    let entries: QueuedRound[] = [];
    for (const [index, id] of ['a', 'b', 'c'].entries()) {
      entries = enqueueRound(entries, argsFor(id), NOW + index).entries;
    }

    expect(entries.map((item) => item.clientRequestId)).toEqual(['a', 'b', 'c']);
  });

  it('is idempotent on the client request id', () => {
    const first = enqueueRound([], argsFor('a', { courseName: 'Premier' }), NOW).entries;
    const again = enqueueRound(first, argsFor('a', { courseName: 'Second' }), NOW + 5_000);

    expect(again.result).toBe('duplicate');
    expect(again.entries).toHaveLength(1);
    expect(again.entries[0].args.p_round.course_name).toBe('Premier');
    expect(again.entries[0].createdAt).toBe(new Date(NOW).toISOString());
  });

  it('refuses a new round once the queue is full, but still recognises a duplicate', () => {
    const full = Array.from({ length: MAX_QUEUE_SIZE }, (_, index) => entry(`r${index}`));

    expect(enqueueRound(full, argsFor('extra'), NOW)).toMatchObject({ result: 'full' });
    expect(enqueueRound(full, argsFor('extra'), NOW).entries).toHaveLength(MAX_QUEUE_SIZE);
    expect(enqueueRound(full, argsFor('r3'), NOW).result).toBe('duplicate');
  });

  it('counts rounds that need attention against the limit', () => {
    const stuck = Array.from({ length: MAX_QUEUE_SIZE }, (_, index) => entry(`r${index}`, { status: 'needs_attention' }));

    expect(enqueueRound(stuck, argsFor('extra'), NOW).result).toBe('full');
  });

  it('refuses arguments without an idempotency key', () => {
    const args = argsFor('a');
    const keyless = { ...args, p_round: { ...args.p_round, client_request_id: '' } };

    expect(enqueueRound([], keyless, NOW)).toEqual({ entries: [], result: 'invalid' });
  });

  it('does not mutate the queue it was given', () => {
    const entries = [entry('a')];
    enqueueRound(entries, argsFor('b'), NOW);

    expect(entries).toHaveLength(1);
  });
});

describe('getNextDue', () => {
  it('returns the oldest pending entry first', () => {
    const entries = [entry('a'), entry('b'), entry('c')];

    expect(getNextDue(entries, NOW)?.clientRequestId).toBe('a');
  });

  it('skips entries that wait for their backoff, entries that need attention and entries already tried', () => {
    const entries = [
      entry('waiting', { attempts: 1, nextAttemptAt: NOW + 1_000 }),
      entry('stuck', { status: 'needs_attention' }),
      entry('tried'),
      entry('ready'),
    ];

    expect(getNextDue(entries, NOW, { skip: new Set(['tried']) })?.clientRequestId).toBe('ready');
  });

  it('ignores the backoff when forced, but never picks an entry that needs attention', () => {
    const entries = [entry('stuck', { status: 'needs_attention' }), entry('waiting', { attempts: 2, nextAttemptAt: NOW + 60_000 })];

    expect(getNextDue(entries, NOW)).toBeNull();
    expect(getNextDue(entries, NOW, { force: true })?.clientRequestId).toBe('waiting');
  });

  it('returns null for an empty queue', () => {
    expect(getNextDue([], NOW)).toBeNull();
  });
});

describe('recordFailure', () => {
  it('schedules the next attempt with an exponential backoff after a network failure', () => {
    let current = entry('a');
    const delays: number[] = [];

    for (let index = 0; index < 4; index++) {
      current = recordFailure(current, 'network', 'unknown', NOW);
      delays.push((current.nextAttemptAt as number) - NOW);
    }

    expect(delays).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(current).toMatchObject({ attempts: 4, status: 'pending', lastError: 'network' });
  });

  it('never gives up on a round because the network is down', () => {
    let current = entry('a');

    for (let index = 0; index < 100; index++) {
      current = recordFailure(current, 'network', 'unknown', NOW);
    }

    expect(current.status).toBe('pending');
    expect(current.nextAttemptAt).toBe(NOW + BACKOFF_MAX_MS);
  });

  it('moves a permanent rejection to needs attention at once, without a next attempt', () => {
    const next = recordFailure(entry('a', { attempts: 1, nextAttemptAt: NOW }), 'permanent', '23514', NOW);

    expect(next).toMatchObject({ status: 'needs_attention', lastError: '23514', attempts: 2 });
    expect(next).not.toHaveProperty('nextAttemptAt');
  });

  it('keeps retrying server failures, then asks for attention after repeated answers', () => {
    let current = entry('a');

    for (let index = 1; index < MAX_ANSWERED_FAILURES; index++) {
      current = recordFailure(current, 'server', '57014', NOW);
      expect(current.status).toBe('pending');
    }

    current = recordFailure(current, 'server', '57014', NOW);

    expect(current).toMatchObject({ status: 'needs_attention', lastError: '57014', answeredFailures: MAX_ANSWERED_FAILURES });
  });

  it('retries a refused session a few times before asking for attention', () => {
    let current = entry('a');

    for (let index = 0; index < MAX_ANSWERED_FAILURES; index++) {
      current = recordFailure(current, 'auth', '42501', NOW);
    }

    expect(current.status).toBe('needs_attention');
  });

  it('restarts the count of answered failures when the network drops in between', () => {
    let current = entry('a');

    for (let index = 0; index < MAX_ANSWERED_FAILURES - 1; index++) {
      current = recordFailure(current, 'server', '57014', NOW);
    }
    current = recordFailure(current, 'network', 'unknown', NOW);
    current = recordFailure(current, 'server', '57014', NOW);

    expect(current).toMatchObject({ status: 'pending', answeredFailures: 1 });
  });

  it('keeps the rest of the entry intact and does not mutate it', () => {
    const original = entry('a');
    const next = recordFailure(original, 'network', 'unknown', NOW);

    expect(next.args).toBe(original.args);
    expect(next.createdAt).toBe(original.createdAt);
    expect(original).toEqual(entry('a'));
  });
});

describe('reviveAttention', () => {
  it('turns the entries that need attention back into fresh pending ones', () => {
    const stuck = recordFailure(entry('a'), 'permanent', '23514', NOW);
    const waiting = recordFailure(entry('b'), 'network', 'unknown', NOW);

    const [revived, untouched] = reviveAttention([stuck, waiting]);

    expect(revived).toMatchObject({ clientRequestId: 'a', status: 'pending', attempts: 0 });
    expect(revived).not.toHaveProperty('nextAttemptAt');
    expect(revived).not.toHaveProperty('answeredFailures');
    expect(isDue(revived, NOW)).toBe(true);
    expect(untouched).toBe(waiting);
  });
});

describe('removeRound and summarizeQueue', () => {
  it('removes only the round that was sent', () => {
    const entries = [entry('a'), entry('b'), entry('c')];

    expect(removeRound(entries, 'b').map((item) => item.clientRequestId)).toEqual(['a', 'c']);
    expect(removeRound(entries, 'missing')).toHaveLength(3);
  });

  it('counts pending rounds and rounds that need attention', () => {
    expect(summarizeQueue([])).toEqual({ total: 0, pending: 0, needsAttention: 0 });
    expect(summarizeQueue([entry('a'), entry('b', { status: 'needs_attention' }), entry('c')])).toEqual({
      total: 3,
      pending: 2,
      needsAttention: 1,
    });
  });
});

describe('parseQueue and serializeQueue', () => {
  it('round-trips a queue', () => {
    const entries = [entry('a'), recordFailure(entry('b'), 'network', 'unknown', NOW)];

    expect(parseQueue(serializeQueue('user-1', entries), 'user-1')).toEqual(entries);
  });

  it('starts empty without anything stored', () => {
    expect(parseQueue(null, 'user-1')).toEqual([]);
    expect(parseQueue('', 'user-1')).toEqual([]);
  });

  it.each(['{not json', 'null', '42', '"text"', '[]', '{}', '{"version":1}', '{"version":1,"userId":"user-1","entries":"x"}'])(
    'reads corrupt content (%s) as an empty queue',
    (raw) => {
      expect(parseQueue(raw, 'user-1')).toEqual([]);
    },
  );

  it('drops the entries that are malformed and keeps the valid ones', () => {
    const good = entry('good');
    const broken = [
      { ...entry('no-holes'), args: { ...argsFor('no-holes'), p_holes: [] } },
      { ...entry('mismatch'), args: argsFor('another-id') },
      { ...entry('bad-status'), status: 'sent' },
      { ...entry('bad-attempts'), attempts: -1 },
      { ...entry('bad-next'), nextAttemptAt: 'soon' },
      { ...entry('bad-hole'), args: { ...argsFor('bad-hole'), p_holes: [{ hole_number: 1 }] } },
      { clientRequestId: 'bare' },
      null,
      'text',
    ];
    const raw = JSON.stringify({ version: ROUND_QUEUE_VERSION, userId: 'user-1', entries: [...broken, good] });

    expect(parseQueue(raw, 'user-1')).toEqual([good]);
  });

  it('keeps a single copy of a duplicated entry', () => {
    const raw = serializeQueue('user-1', [entry('a'), entry('a')]);

    expect(parseQueue(raw, 'user-1')).toHaveLength(1);
  });

  it('puts the entries back in the order they were created', () => {
    const older = entry('older', { createdAt: new Date(NOW - 60_000).toISOString() });
    const newer = entry('newer', { createdAt: new Date(NOW).toISOString() });

    expect(parseQueue(serializeQueue('user-1', [newer, older]), 'user-1')?.map((item) => item.clientRequestId)).toEqual([
      'older',
      'newer',
    ]);
  });

  it('never hands a queue to another user', () => {
    const raw = serializeQueue('user-1', [entry('a')]);

    expect(parseQueue(raw, 'user-2')).toEqual([]);
  });

  it('leaves content written by a newer app version alone', () => {
    const raw = JSON.stringify({ version: ROUND_QUEUE_VERSION + 1, userId: 'user-1', entries: [] });

    expect(parseQueue(raw, 'user-1')).toBeNull();
  });

  it('reads an unversioned or older payload as empty', () => {
    expect(parseQueue(JSON.stringify({ version: 0, userId: 'user-1', entries: [entry('a')] }), 'user-1')).toEqual([]);
    expect(parseQueue(JSON.stringify({ userId: 'user-1', entries: [entry('a')] }), 'user-1')).toEqual([]);
  });

  it('does not store the queue as anything but versioned json owned by the user', () => {
    const parsed = JSON.parse(serializeQueue('user-1', [entry('a')]));

    expect(parsed).toMatchObject({ version: ROUND_QUEUE_VERSION, userId: 'user-1' });
    expect(parsed.entries).toHaveLength(1);
  });
});

describe('storage', () => {
  it('uses a versioned key per user', () => {
    expect(getRoundQueueStorageKey('user-1')).toBe('fairwayiq:round-queue:v1:user-1');
    expect(getRoundQueueStorageKey('user-1')).not.toBe(getRoundQueueStorageKey('user-2'));
  });

  it('saves and loads a queue', async () => {
    const entries = [entry('a'), entry('b')];

    await expect(saveQueue('user-1', entries)).resolves.toBe(true);
    await expect(loadQueue('user-1')).resolves.toEqual(entries);
  });

  it('keeps the queues of two users apart', async () => {
    await saveQueue('user-1', [entry('a')]);
    await saveQueue('user-2', [entry('b')]);

    expect((await loadQueue('user-1'))?.map((item) => item.clientRequestId)).toEqual(['a']);
    expect((await loadQueue('user-2'))?.map((item) => item.clientRequestId)).toEqual(['b']);
  });

  it('does not hand a payload planted under another user key to that user', async () => {
    await AsyncStorage.setItem(getRoundQueueStorageKey('user-2'), serializeQueue('user-1', [entry('a')]));

    await expect(loadQueue('user-2')).resolves.toEqual([]);
  });

  it('removes the key when the queue becomes empty', async () => {
    await saveQueue('user-1', [entry('a')]);
    await saveQueue('user-1', []);

    await expect(AsyncStorage.getItem(getRoundQueueStorageKey('user-1'))).resolves.toBeNull();
  });

  it('loads an empty queue for a corrupt payload', async () => {
    await AsyncStorage.setItem(getRoundQueueStorageKey('user-1'), '{broken');

    await expect(loadQueue('user-1')).resolves.toEqual([]);
  });

  it('reports a storage that cannot be read, and never throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await expect(loadQueue('user-1')).resolves.toBeNull();
  });

  it('reports a storage that cannot be written, and never throws', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('full'));

    await expect(saveQueue('user-1', [entry('a')])).resolves.toBe(false);
  });
});

describe('updateQueue', () => {
  it('applies a change on top of what is stored', async () => {
    await saveQueue('user-1', [entry('a')]);

    const outcome = await updateQueue('user-1', (entries) => [...entries, entry('b')]);

    expect(outcome.ok).toBe(true);
    expect(outcome.entries.map((item) => item.clientRequestId)).toEqual(['a', 'b']);
    expect((await loadQueue('user-1'))?.map((item) => item.clientRequestId)).toEqual(['a', 'b']);
  });

  it('applies overlapping changes one after the other without losing any', async () => {
    const changes = ['a', 'b', 'c', 'd', 'e'].map((id) => updateQueue('user-1', (entries) => [...entries, entry(id)]));

    await Promise.all(changes);

    expect((await loadQueue('user-1'))?.map((item) => item.clientRequestId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('does not write when nothing changed', async () => {
    await saveQueue('user-1', [entry('a')]);
    (AsyncStorage.setItem as jest.Mock).mockClear();

    const outcome = await updateQueue('user-1', (entries) => entries);

    expect(outcome.ok).toBe(true);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('never replaces a queue it could not read with a new one', async () => {
    await saveQueue('user-1', [entry('a')]);
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    const outcome = await updateQueue('user-1', (entries) => [...entries, entry('b')]);

    expect(outcome.ok).toBe(false);
    expect((await loadQueue('user-1'))?.map((item) => item.clientRequestId)).toEqual(['a']);
  });

  it('never overwrites content written by a newer app version', async () => {
    const future = JSON.stringify({ version: ROUND_QUEUE_VERSION + 1, userId: 'user-1', entries: [] });
    await AsyncStorage.setItem(getRoundQueueStorageKey('user-1'), future);

    const outcome = await updateQueue('user-1', (entries) => [...entries, entry('a')]);

    expect(outcome.ok).toBe(false);
    await expect(AsyncStorage.getItem(getRoundQueueStorageKey('user-1'))).resolves.toBe(future);
  });

  it('reports a failed write and keeps the previous queue', async () => {
    await saveQueue('user-1', [entry('a')]);
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('full'));

    const outcome = await updateQueue('user-1', (entries) => [...entries, entry('b')]);

    expect(outcome.ok).toBe(false);
    expect(outcome.entries.map((item) => item.clientRequestId)).toEqual(['a']);
  });

  it('keeps working after a change that throws', async () => {
    await expect(updateQueue('user-1', () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    const outcome = await updateQueue('user-1', () => [entry('a')]);

    expect(outcome.ok).toBe(true);
  });
});
