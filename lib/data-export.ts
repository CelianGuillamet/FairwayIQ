import type { SupabaseClient } from '@supabase/supabase-js';
import type { Diagnostic, Profile, Round, RoundHole } from '../types';
import { buildRoundsCsv } from './export-csv';
import {
  buildExportDocument,
  exportFileName,
  getExportFileType,
  serializeExportDocument,
  type BadgeRow,
  type ClubDistanceRow,
  type DebriefMessageRow,
  type DebriefSessionRow,
  type DrillCompletionRow,
  type ExportContext,
  type ExportFile,
  type ExportKind,
  type ExportSource,
  type ExportUser,
  type SubscriptionStatusRow,
} from './export-document';

export type ExportClient = Pick<SupabaseClient, 'from'>;

export type ExportFailureKind = 'network' | 'session' | 'unknown';

// PostgREST caps a response at 1000 rows by default.
export const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

const SESSION_CODES = new Set(['28000', '42501', 'PGRST301', 'PGRST302']);
const NETWORK_MESSAGE_PATTERN = /network|fetch|timeout|timed out|abort|offline|connection/i;

export class ExportFetchError extends Error {
  kind: ExportFailureKind;
  table: string;

  constructor(kind: ExportFailureKind, table: string, code = '') {
    super(`Export fetch failed (${kind}) on ${table}${code ? ` [${code}]` : ''}`);
    this.name = 'ExportFetchError';
    this.kind = kind;
    this.table = table;
  }
}

function readString(value: unknown, key: string) {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

export function classifyFetchFailure(error: unknown): ExportFailureKind {
  const code = readString(error, 'code');

  if (SESSION_CODES.has(code)) return 'session';
  if (!code && NETWORK_MESSAGE_PATTERN.test(readString(error, 'message'))) return 'network';
  return 'unknown';
}

function toFetchError(error: unknown, table: string) {
  return error instanceof ExportFetchError
    ? error
    : new ExportFetchError(classifyFetchFailure(error), table, readString(error, 'code'));
}

type Page<T> = { data: T[] | null; error: unknown };
type PageQuery<T> = (from: number, to: number) => PromiseLike<Page<T>>;

type PageOptions = {
  pageSize?: number;
  maxPages?: number;
};

// Each request starts after the rows already received, not at a multiple of the page size,
// so a server that returns fewer rows than asked can never make the loop skip any.
export async function fetchAllRows<T>(
  table: string,
  query: PageQuery<T>,
  { pageSize = PAGE_SIZE, maxPages = MAX_PAGES }: PageOptions = {},
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    let result: Page<T>;

    try {
      result = await query(rows.length, rows.length + pageSize - 1);
    } catch (error) {
      throw toFetchError(error, table);
    }

    if (result.error) {
      throw toFetchError(result.error, table);
    }

    if (!result.data || result.data.length === 0) {
      return rows;
    }

    rows.push(...result.data);
  }

  throw new ExportFetchError('unknown', table);
}

// Every list is read in an ascending, total order that new rows can only join at the end of.
function listRows<T>(client: ExportClient, table: string, userId: string | null, order: readonly string[]) {
  return fetchAllRows<T>(table, (from, to) => {
    let query = client.from(table).select('*');

    if (userId) query = query.eq('user_id', userId);
    for (const column of order) query = query.order(column, { ascending: true });

    return query.range(from, to);
  });
}

async function readOne<T>(table: string, query: PromiseLike<{ data: T | null; error: unknown }>) {
  let result: { data: T | null; error: unknown };

  try {
    result = await query;
  } catch (error) {
    throw toFetchError(error, table);
  }

  if (result.error) {
    throw toFetchError(result.error, table);
  }

  return result.data;
}

export function fetchRounds(client: ExportClient, userId: string) {
  return listRows<Round>(client, 'rounds', userId, ['created_at', 'id']);
}

export async function fetchExportSource(client: ExportClient, user: ExportUser): Promise<ExportSource> {
  const userId = user.id;

  const [
    profile,
    subscription,
    rounds,
    roundHoles,
    diagnostics,
    drillCompletions,
    badges,
    clubDistances,
    debriefSessions,
    debriefMessages,
  ] = await Promise.all([
    readOne<Profile>('profiles', client.from('profiles').select('*').eq('user_id', userId).maybeSingle()),
    readOne<SubscriptionStatusRow>(
      'subscriptions',
      client.from('subscriptions').select('is_premium, plan, expires_at, updated_at').eq('user_id', userId).maybeSingle(),
    ),
    fetchRounds(client, userId),
    listRows<RoundHole>(client, 'round_holes', userId, ['created_at', 'id']),
    listRows<Diagnostic>(client, 'diagnostics', userId, ['created_at', 'id']),
    listRows<DrillCompletionRow>(client, 'drill_completions', userId, ['completed_at', 'id']),
    listRows<BadgeRow>(client, 'user_badges', userId, ['badge_id']),
    listRows<ClubDistanceRow>(client, 'club_distances', userId, ['club']),
    listRows<DebriefSessionRow>(client, 'debrief_sessions', userId, ['created_at', 'id']),
    // debrief_messages has no user_id: row-level security limits it to the user's own sessions.
    listRows<DebriefMessageRow>(client, 'debrief_messages', null, ['created_at', 'id']),
  ]);

  return {
    user,
    profile,
    subscription,
    rounds,
    roundHoles,
    diagnostics,
    drillCompletions,
    badges,
    clubDistances,
    debriefSessions,
    debriefMessages,
  };
}

// Resolves to null when there is nothing to export (a rounds CSV with no round).
export async function prepareExport(
  client: ExportClient,
  kind: ExportKind,
  user: ExportUser,
  context: ExportContext,
): Promise<ExportFile | null> {
  const name = exportFileName(kind, context.now);
  const fileType = getExportFileType(kind);

  if (kind === 'csv') {
    const rounds = await fetchRounds(client, user.id);
    return rounds.length === 0 ? null : { name, content: buildRoundsCsv(rounds), ...fileType };
  }

  const source = await fetchExportSource(client, user);
  return { name, content: serializeExportDocument(buildExportDocument(source, context)), ...fileType };
}
