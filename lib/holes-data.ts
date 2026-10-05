import type { Round } from '../types';
import { supabase } from './supabase';
import type { HoleRow, HolesByRound } from './leaks';

const HOLE_COLUMNS = 'round_id, hole_number, par, score, putts, gir, fairway_hit, penalty';

export const HOLES_LOAD_ERROR = 'Impossible de charger le détail des trous pour le moment.';

export type HolesRound = Pick<Round, 'id' | 'holes' | 'par' | 'total_score' | 'putts' | 'gir' | 'fairways_hit' | 'penalties'>;

type StoredHoleRow = HoleRow & { round_id: string };
type Cached = { fingerprint: string; rows: HoleRow[] };

const cache = new Map<string, Cached>();
const pending = new Map<string, Promise<void>>();

// Bumped on reset(): a response that started before it belongs to a previous user and is dropped.
let generation = 0;

// round_holes rows only change through update_round, which rewrites the round's aggregates in the
// same transaction: a different aggregate means the cached rows are out of date.
export function getHolesFingerprint(round: HolesRound) {
  return [round.holes, round.par, round.total_score, round.putts, round.gir, round.fairways_hit, round.penalties].join(':');
}

function readCache(rounds: readonly HolesRound[]) {
  const holesByRound: HolesByRound = {};
  const missing: HolesRound[] = [];

  for (const round of rounds) {
    const entry = cache.get(round.id);

    if (entry && entry.fingerprint === getHolesFingerprint(round)) {
      holesByRound[round.id] = entry.rows;
    } else {
      missing.push(round);
    }
  }

  return { holesByRound, missing };
}

export function getCachedHoles(rounds: readonly HolesRound[]): HolesByRound | null {
  const { holesByRound, missing } = readCache(rounds);
  return missing.length === 0 ? holesByRound : null;
}

async function fetchMissing(missing: readonly HolesRound[], requestGeneration: number) {
  const ids = missing.map((round) => round.id);
  const { data, error } = await supabase
    .from('round_holes')
    .select(HOLE_COLUMNS)
    .in('round_id', ids);

  if (requestGeneration !== generation) {
    return;
  }

  if (error) {
    console.warn('[holes] Hole rows fetch failed', { message: error.message });
    throw new Error(HOLES_LOAD_ERROR);
  }

  const byRound = new Map<string, HoleRow[]>();

  for (const { round_id: roundId, ...row } of (data ?? []) as StoredHoleRow[]) {
    byRound.set(roundId, [...(byRound.get(roundId) ?? []), row]);
  }

  // Rounds without rows are cached as empty so legacy rounds are not queried again.
  for (const round of missing) {
    cache.set(round.id, { fingerprint: getHolesFingerprint(round), rows: byRound.get(round.id) ?? [] });
  }
}

// Resolves to null when the session was reset while the request was in flight.
export async function loadHolesForRounds(rounds: readonly HolesRound[]): Promise<HolesByRound | null> {
  const requestGeneration = generation;
  const { missing } = readCache(rounds);

  if (missing.length > 0) {
    const key = `${requestGeneration}:${missing.map((round) => `${round.id}@${getHolesFingerprint(round)}`).sort().join(',')}`;
    let request = pending.get(key);

    if (!request) {
      request = fetchMissing(missing, requestGeneration).finally(() => pending.delete(key));
      pending.set(key, request);
    }

    await request;
  }

  if (requestGeneration !== generation) {
    return null;
  }

  return getCachedHoles(rounds);
}

export function resetHolesData() {
  generation++;
  cache.clear();
  pending.clear();
}
