import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoundSaveFailureKind, SaveRoundArgs } from './round-save';

export const ROUND_QUEUE_VERSION = 1;
export const MAX_QUEUE_SIZE = 20;
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_MS = 10 * 60_000;
export const MAX_ANSWERED_FAILURES = 5;

export type QueuedRoundStatus = 'pending' | 'needs_attention';

export type QueuedRound = {
  clientRequestId: string;
  args: SaveRoundArgs;
  createdAt: string;
  attempts: number;
  status: QueuedRoundStatus;
  nextAttemptAt?: number;
  answeredFailures?: number;
  lastError?: string;
};

export type EnqueueResult = 'added' | 'duplicate' | 'full' | 'invalid';

export type QueueSummary = { total: number; pending: number; needsAttention: number };

export function getBackoffDelayMs(attempts: number) {
  if (!Number.isFinite(attempts) || attempts <= 0) return 0;
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
}

// A next attempt further away than the longest backoff can only come from a clock that moved back.
export function isDue(entry: QueuedRound, now: number) {
  if (entry.status !== 'pending') return false;
  if (entry.nextAttemptAt === undefined) return true;
  return now >= entry.nextAttemptAt || entry.nextAttemptAt - now > BACKOFF_MAX_MS;
}

export function enqueueRound(
  entries: readonly QueuedRound[],
  args: SaveRoundArgs,
  now: number,
): { entries: QueuedRound[]; result: EnqueueResult } {
  const clientRequestId = args?.p_round?.client_request_id;

  if (typeof clientRequestId !== 'string' || clientRequestId.length === 0) {
    return { entries: [...entries], result: 'invalid' };
  }

  if (entries.some((entry) => entry.clientRequestId === clientRequestId)) {
    return { entries: [...entries], result: 'duplicate' };
  }

  if (entries.length >= MAX_QUEUE_SIZE) {
    return { entries: [...entries], result: 'full' };
  }

  const entry: QueuedRound = {
    clientRequestId,
    args,
    createdAt: new Date(now).toISOString(),
    attempts: 0,
    status: 'pending',
  };

  return { entries: [...entries, entry], result: 'added' };
}

export function getNextDue(
  entries: readonly QueuedRound[],
  now: number,
  options: { force?: boolean; skip?: ReadonlySet<string> } = {},
) {
  return entries.find((entry) => (
    entry.status === 'pending'
    && !options.skip?.has(entry.clientRequestId)
    && (options.force || isDue(entry, now))
  )) ?? null;
}

export function recordFailure(entry: QueuedRound, kind: RoundSaveFailureKind, code: string, now: number): QueuedRound {
  const { nextAttemptAt: _previousNextAttemptAt, ...rest } = entry;
  const attempts = entry.attempts + 1;
  const lastError = kind === 'network' ? 'network' : code;

  if (kind === 'permanent') {
    return { ...rest, attempts, lastError, status: 'needs_attention' };
  }

  const answeredFailures = kind === 'network' ? 0 : (entry.answeredFailures ?? 0) + 1;

  if (answeredFailures >= MAX_ANSWERED_FAILURES) {
    return { ...rest, attempts, lastError, answeredFailures, status: 'needs_attention' };
  }

  return { ...rest, attempts, lastError, answeredFailures, status: 'pending', nextAttemptAt: now + getBackoffDelayMs(attempts) };
}

export function reviveAttention(entries: readonly QueuedRound[]): QueuedRound[] {
  return entries.map((entry) => {
    if (entry.status !== 'needs_attention') return entry;

    const { nextAttemptAt: _nextAttemptAt, answeredFailures: _answeredFailures, ...rest } = entry;
    return { ...rest, attempts: 0, status: 'pending' };
  });
}

export function removeRound(entries: readonly QueuedRound[], clientRequestId: string): QueuedRound[] {
  return entries.filter((entry) => entry.clientRequestId !== clientRequestId);
}

export function summarizeQueue(entries: readonly QueuedRound[]): QueueSummary {
  const needsAttention = entries.filter((entry) => entry.status === 'needs_attention').length;
  return { total: entries.length, pending: entries.length - needsAttention, needsAttention };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isHolePayload(value: unknown) {
  return isRecord(value) && isFiniteNumber(value.hole_number) && isFiniteNumber(value.par) && isFiniteNumber(value.score);
}

function isSaveRoundArgs(value: unknown, clientRequestId: string): value is SaveRoundArgs {
  if (!isRecord(value) || !isRecord(value.p_round) || !Array.isArray(value.p_holes)) return false;

  const round = value.p_round;

  return round.client_request_id === clientRequestId
    && typeof round.played_at === 'string'
    && (round.holes === 9 || round.holes === 18)
    && isFiniteNumber(round.total_score)
    && isFiniteNumber(round.par)
    && value.p_holes.length > 0
    && value.p_holes.every(isHolePayload);
}

function isQueuedRound(value: unknown): value is QueuedRound {
  if (!isRecord(value)) return false;

  return typeof value.clientRequestId === 'string'
    && value.clientRequestId.length > 0
    && typeof value.createdAt === 'string'
    && isFiniteNumber(value.attempts)
    && value.attempts >= 0
    && (value.status === 'pending' || value.status === 'needs_attention')
    && (value.nextAttemptAt === undefined || isFiniteNumber(value.nextAttemptAt))
    && (value.answeredFailures === undefined || isFiniteNumber(value.answeredFailures))
    && (value.lastError === undefined || typeof value.lastError === 'string')
    && isSaveRoundArgs(value.args, value.clientRequestId);
}

function compareByCreation(left: QueuedRound, right: QueuedRound) {
  const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return Number.isNaN(delta) ? 0 : delta;
}

export function serializeQueue(userId: string, entries: readonly QueuedRound[]) {
  return JSON.stringify({ version: ROUND_QUEUE_VERSION, userId, entries });
}

// null means the content comes from a newer app version: it must be left untouched, never overwritten.
export function parseQueue(raw: string | null, userId: string): QueuedRound[] | null {
  if (!raw) return [];

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!isRecord(parsed)) return [];
  if (typeof parsed.version === 'number' && parsed.version > ROUND_QUEUE_VERSION) return null;
  if (parsed.version !== ROUND_QUEUE_VERSION || parsed.userId !== userId || !Array.isArray(parsed.entries)) return [];

  const seen = new Set<string>();
  const entries: QueuedRound[] = [];

  for (const candidate of parsed.entries) {
    if (isQueuedRound(candidate) && !seen.has(candidate.clientRequestId)) {
      seen.add(candidate.clientRequestId);
      entries.push(candidate);
    }
  }

  return entries.sort(compareByCreation);
}

export function getRoundQueueStorageKey(userId: string) {
  return `fairwayiq:round-queue:v${ROUND_QUEUE_VERSION}:${userId}`;
}

export async function loadQueue(userId: string): Promise<QueuedRound[] | null> {
  try {
    return parseQueue(await AsyncStorage.getItem(getRoundQueueStorageKey(userId)), userId);
  } catch {
    return null;
  }
}

export async function saveQueue(userId: string, entries: readonly QueuedRound[]) {
  try {
    if (entries.length === 0) {
      await AsyncStorage.removeItem(getRoundQueueStorageKey(userId));
    } else {
      await AsyncStorage.setItem(getRoundQueueStorageKey(userId), serializeQueue(userId, entries));
    }
    return true;
  } catch {
    return false;
  }
}

let writeChain: Promise<unknown> = Promise.resolve();

// Every change reads the stored queue first and writes it back, one at a time: a flush and a new
// enqueue can overlap, and an unreadable queue is never replaced by an empty one.
export function updateQueue(
  userId: string,
  update: (entries: QueuedRound[]) => QueuedRound[],
): Promise<{ ok: boolean; entries: QueuedRound[] }> {
  const run = writeChain.then(async () => {
    const current = await loadQueue(userId);

    if (current === null) return { ok: false, entries: [] };

    const next = update(current);

    if (serializeQueue(userId, next) === serializeQueue(userId, current)) return { ok: true, entries: current };

    const ok = await saveQueue(userId, next);
    return { ok, entries: ok ? next : current };
  });

  writeChain = run.catch(() => undefined);
  return run;
}
