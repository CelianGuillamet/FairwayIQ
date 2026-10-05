import { supabase } from './supabase';
import { aggregateScorecard } from './rounds';
import type { Round, RoundDraftHole } from '../types';

export type SaveRoundHolePayload = {
  hole_number: number;
  par: number;
  score: number;
  putts: number;
  gir: boolean;
  fairway_hit: boolean | null;
  penalty: number;
};

export type SaveRoundRoundPayload = {
  client_request_id: string;
  played_at: string;
  course_id: string | null;
  course_name: string | null;
  course_provider: string | null;
  provider_course_id: string | null;
  tee_key: string | null;
  tee_set_id: string | null;
  tee_name: string | null;
  tee_color: string | null;
  holes: 9 | 18;
  total_score: number;
  par: number;
  putts: number;
  gir: number;
  fairways_hit: number;
  fairways_total: number;
  penalties: number;
  notes: string | null;
};

export type SaveRoundArgs = {
  p_round: SaveRoundRoundPayload;
  p_holes: SaveRoundHolePayload[];
};

export type SaveRoundInput = {
  clientRequestId: string;
  playedAt: string;
  courseId: string | null;
  courseName: string | null;
  courseProvider?: string | null;
  providerCourseId?: string | null;
  teeKey: string | null;
  teeSetId?: string | null;
  teeName?: string | null;
  teeColor?: string | null;
  notes: string | null;
  scorecard: RoundDraftHole[];
};

export type UpdateRoundMetadata = {
  course_name: string | null;
  notes: string | null;
};

export type UpdateRoundAggregates = {
  total_score: number;
  par: number;
  putts: number;
  gir: number;
  fairways_hit: number;
  fairways_total: number;
  penalties: number;
};

export type UpdateRoundArgs = {
  p_round_id: string;
  p_round: UpdateRoundMetadata | (UpdateRoundMetadata & UpdateRoundAggregates);
  p_holes?: SaveRoundHolePayload[];
};

export type RoundSaveAction = 'save' | 'update';

export type RoundSaveFailureKind = 'network' | 'server' | 'auth' | 'permanent';

const SESSION_MESSAGE = 'Ta session a expiré. Reconnecte-toi puis réessaie.';
const NETWORK_MESSAGE = 'Connexion impossible. Vérifie ton réseau puis réessaie.';
const INVALID_DATA_MESSAGE = 'Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.';
const NOT_FOUND_MESSAGE = 'Ce round est introuvable. Il a peut-être été supprimé.';
const GENERIC_SAVE_MESSAGE = 'Impossible d’enregistrer ce round pour le moment. Réessaie dans un instant.';
const GENERIC_UPDATE_MESSAGE = 'Impossible de modifier ce round pour le moment. Réessaie dans un instant.';

const SESSION_CODES = new Set(['28000', '42501', 'PGRST301', 'PGRST302']);
const INVALID_DATA_CODES = new Set(['22003', '22007', '22008', '22023', '22P02', '23502', '23505', '23514']);
const NOT_FOUND_CODES = new Set(['P0002', '23503']);
const NETWORK_MESSAGE_PATTERN = /network|fetch|timeout|timed out|abort|offline|connection/i;
const NETWORK_ERROR_NAMES = new Set(['AbortError', 'TimeoutError']);
const TRANSIENT_SQLSTATE_CLASSES = new Set(['08', '40', '53', '57', '58']);
const TRANSIENT_POSTGREST_CODES = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

export class RoundSaveError extends Error {
  readonly code: string;
  readonly kind: RoundSaveFailureKind;

  constructor(message: string, code: string, kind: RoundSaveFailureKind = 'permanent') {
    super(message);
    this.name = 'RoundSaveError';
    this.code = code;
    this.kind = kind;
  }
}

function readString(value: unknown, key: string) {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

export function getErrorCode(error: unknown) {
  return readString(error, 'code') || readString(error, 'name') || 'unknown';
}

export function mapRoundSaveError(error: unknown, action: RoundSaveAction = 'save') {
  const code = readString(error, 'code');

  if (SESSION_CODES.has(code)) return SESSION_MESSAGE;
  if (INVALID_DATA_CODES.has(code)) return INVALID_DATA_MESSAGE;
  if (NOT_FOUND_CODES.has(code)) return NOT_FOUND_MESSAGE;

  if (!code && NETWORK_MESSAGE_PATTERN.test(readString(error, 'message'))) {
    return NETWORK_MESSAGE;
  }

  return action === 'save' ? GENERIC_SAVE_MESSAGE : GENERIC_UPDATE_MESSAGE;
}

// Only network and server failures can be fixed by sending the same round again later.
export function classifyRoundSaveFailure(error: unknown, status?: number): RoundSaveFailureKind {
  if (error instanceof RoundSaveError) return error.kind;

  const code = readString(error, 'code');
  const sqlStateClass = code.slice(0, 2);

  if (sqlStateClass === '22' || sqlStateClass === '23' || NOT_FOUND_CODES.has(code)) return 'permanent';
  if (SESSION_CODES.has(code) || status === 401 || status === 403) return 'auth';

  if (
    TRANSIENT_POSTGREST_CODES.has(code)
    || TRANSIENT_SQLSTATE_CLASSES.has(sqlStateClass)
    || (status !== undefined && (status >= 500 || status === 408 || status === 429))
  ) {
    return 'server';
  }

  if (!code && (NETWORK_MESSAGE_PATTERN.test(readString(error, 'message')) || NETWORK_ERROR_NAMES.has(readString(error, 'name')))) {
    return 'network';
  }

  return 'permanent';
}

export function getRoundSaveErrorMessage(error: unknown, action: RoundSaveAction = 'save') {
  return error instanceof RoundSaveError ? error.message : mapRoundSaveError(error, action);
}

export function createClientRequestId() {
  const cryptoApi = (globalThis as { crypto?: Partial<Crypto> }).crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function buildHolePayloads(scorecard: RoundDraftHole[]): SaveRoundHolePayload[] {
  return scorecard.map((hole) => ({
    hole_number: hole.hole_number,
    par: hole.par,
    score: hole.score,
    putts: hole.putts,
    gir: hole.gir,
    fairway_hit: hole.par === 3 ? null : hole.fairway_hit,
    penalty: hole.penalty,
  }));
}

function buildAggregates(scorecard: RoundDraftHole[]): UpdateRoundAggregates & { holes: 9 | 18 } {
  const aggregate = aggregateScorecard(scorecard);

  return {
    holes: aggregate.holes,
    total_score: aggregate.total_score,
    par: aggregate.par,
    putts: aggregate.putts,
    gir: aggregate.gir,
    fairways_hit: aggregate.fairways_hit,
    fairways_total: aggregate.fairways_total,
    penalties: aggregate.penalties,
  };
}

export function buildSaveRoundArgs(input: SaveRoundInput): SaveRoundArgs {
  return {
    p_round: {
      client_request_id: input.clientRequestId,
      played_at: input.playedAt,
      course_id: input.courseId,
      course_name: input.courseName,
      course_provider: input.courseProvider ?? null,
      provider_course_id: input.providerCourseId ?? null,
      tee_key: input.teeKey,
      tee_set_id: input.teeSetId ?? null,
      tee_name: input.teeName ?? null,
      tee_color: input.teeColor ?? null,
      notes: input.notes,
      ...buildAggregates(input.scorecard),
    },
    p_holes: buildHolePayloads(input.scorecard),
  };
}

export function buildUpdateRoundArgs(input: {
  roundId: string;
  courseName: string | null;
  notes: string | null;
  scorecard?: RoundDraftHole[];
}): UpdateRoundArgs {
  const metadata: UpdateRoundMetadata = { course_name: input.courseName, notes: input.notes };

  if (!input.scorecard) {
    return { p_round_id: input.roundId, p_round: metadata };
  }

  const { total_score, par, putts, gir, fairways_hit, fairways_total, penalties } = buildAggregates(input.scorecard);

  return {
    p_round_id: input.roundId,
    p_round: { ...metadata, total_score, par, putts, gir, fairways_hit, fairways_total, penalties },
    p_holes: buildHolePayloads(input.scorecard),
  };
}

export async function saveRound(args: SaveRoundArgs): Promise<Round> {
  const { data, error, status } = await supabase.rpc('save_round', args);

  if (error) {
    throw new RoundSaveError(mapRoundSaveError(error, 'save'), getErrorCode(error), classifyRoundSaveFailure(error, status));
  }

  return data as Round;
}

export async function updateRound(args: UpdateRoundArgs): Promise<Round> {
  const { data, error, status } = await supabase.rpc('update_round', args);

  if (error) {
    throw new RoundSaveError(mapRoundSaveError(error, 'update'), getErrorCode(error), classifyRoundSaveFailure(error, status));
  }

  return data as Round;
}
