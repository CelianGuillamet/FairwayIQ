import { format } from 'date-fns';
import type { Diagnostic, Profile, Round, RoundHole } from '../types';
import { BADGES } from './badges';
import { CLUBS } from './bag';
import { DRILLS } from './drill-library';

export type ExportKind = 'json' | 'csv';

export type ExportFile = {
  name: string;
  content: string;
  mimeType: string;
  uti: string;
};

export type ExportUser = {
  id: string;
  email: string | null;
};

export type SubscriptionStatusRow = {
  is_premium: boolean;
  plan: string | null;
  expires_at: string | null;
  updated_at: string;
};

export type DrillCompletionRow = {
  id: string;
  user_id: string;
  drill_id: string;
  completed_at: string;
  result_made: number | null;
  result_attempts: number | null;
};

export type BadgeRow = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
};

export type ClubDistanceRow = {
  id: string;
  user_id: string;
  club: string;
  carry_m: number;
  updated_at: string;
};

export type DebriefSessionRow = {
  id: string;
  user_id: string;
  round_id: string;
  created_at: string;
};

export type DebriefMessageRow = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type ExportSource = {
  user: ExportUser;
  profile: Profile | null;
  subscription: SubscriptionStatusRow | null;
  rounds: Round[];
  roundHoles: RoundHole[];
  diagnostics: Diagnostic[];
  drillCompletions: DrillCompletionRow[];
  badges: BadgeRow[];
  clubDistances: ClubDistanceRow[];
  debriefSessions: DebriefSessionRow[];
  debriefMessages: DebriefMessageRow[];
};

type ExportDiagnostic = Omit<Diagnostic, 'user_id' | 'round_id'>;

export type ExportRound = Omit<Round, 'user_id'> & {
  scorecard: Omit<RoundHole, 'user_id' | 'round_id'>[];
  diagnostic: ExportDiagnostic | null;
};

export type ExportDocument = {
  exportedAt: string;
  app: { name: string; version: string | null };
  account: ExportUser;
  profile: Omit<Profile, 'user_id'> | null;
  subscription: SubscriptionStatusRow | null;
  rounds: ExportRound[];
  diagnosticsWithoutRound: Omit<Diagnostic, 'user_id'>[];
  drills: {
    drill_id: string;
    title: string | null;
    completed_at: string;
    result_made: number | null;
    result_attempts: number | null;
  }[];
  badges: { badge_id: string; title: string | null; earned_at: string }[];
  bag: { club: string; label: string; carry_m: number; updated_at: string }[];
  debriefs: {
    id: string;
    round_id: string;
    created_at: string;
    messages: { role: 'user' | 'assistant'; content: string; created_at: string }[];
  }[];
};

export type ExportContext = {
  now: Date;
  appVersion: string | null;
};

export const APP_NAME = 'FairwayIQ';

const FILE_TYPES: Record<ExportKind, { mimeType: string; uti: string }> = {
  json: { mimeType: 'application/json', uti: 'public.json' },
  csv: { mimeType: 'text/csv', uti: 'public.comma-separated-values-text' },
};

export function getExportFileType(kind: ExportKind) {
  return FILE_TYPES[kind];
}

export function exportFileName(kind: ExportKind, now: Date) {
  const date = format(now, 'yyyy-MM-dd');
  return kind === 'json' ? `fairwayiq-donnees-${date}.json` : `fairwayiq-rounds-${date}.csv`;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareTime(left: string, right: string) {
  const delta = new Date(left).getTime() - new Date(right).getTime();
  return Number.isNaN(delta) ? compareText(left, right) : delta;
}

export function compareRoundsNewestFirst(left: Round, right: Round) {
  return compareTime(right.played_at, left.played_at) || compareText(right.id, left.id);
}

function omit<T extends object, K extends keyof T>(row: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (id == null) continue;
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

function newestDiagnostic(candidates: readonly Diagnostic[]) {
  return [...candidates].sort(
    (left, right) => compareTime(right.created_at, left.created_at) || compareText(right.id, left.id),
  )[0];
}

function buildRounds(source: ExportSource) {
  const holesByRound = groupBy(source.roundHoles, (hole) => hole.round_id);
  const diagnosticsByRound = groupBy(source.diagnostics, (diagnostic) => diagnostic.round_id);
  const attached = new Set<string>();

  const rounds = [...source.rounds].sort(compareRoundsNewestFirst).map((round): ExportRound => {
    const diagnostic = newestDiagnostic(diagnosticsByRound.get(round.id) ?? []);
    if (diagnostic) attached.add(diagnostic.id);

    return {
      ...omit(round, 'user_id'),
      scorecard: [...(holesByRound.get(round.id) ?? [])]
        .sort((left, right) => left.hole_number - right.hole_number)
        .map((hole) => omit(hole, 'user_id', 'round_id')),
      diagnostic: diagnostic ? omit(diagnostic, 'user_id', 'round_id') : null,
    };
  });

  // Deleting a round keeps its diagnostic with a null round_id, so it can't be nested in a round.
  const diagnosticsWithoutRound = source.diagnostics
    .filter((diagnostic) => !attached.has(diagnostic.id))
    .sort((left, right) => compareTime(left.created_at, right.created_at) || compareText(left.id, right.id))
    .map((diagnostic) => omit(diagnostic, 'user_id'));

  return { rounds, diagnosticsWithoutRound };
}

function buildDrills(completions: readonly DrillCompletionRow[]): ExportDocument['drills'] {
  const titles = new Map(DRILLS.map((drill) => [drill.id, drill.title]));

  return [...completions]
    .sort((left, right) => compareTime(left.completed_at, right.completed_at) || compareText(left.id, right.id))
    .map((completion) => ({
      drill_id: completion.drill_id,
      title: titles.get(completion.drill_id) ?? null,
      completed_at: completion.completed_at,
      result_made: completion.result_made ?? null,
      result_attempts: completion.result_attempts ?? null,
    }));
}

function buildBadges(rows: readonly BadgeRow[]): ExportDocument['badges'] {
  const titles = new Map<string, string>(BADGES.map((badge) => [badge.id, badge.title]));

  return [...rows]
    .sort((left, right) => compareTime(left.earned_at, right.earned_at) || compareText(left.badge_id, right.badge_id))
    .map((row) => ({
      badge_id: row.badge_id,
      title: titles.get(row.badge_id) ?? null,
      earned_at: row.earned_at,
    }));
}

function buildBag(rows: readonly ClubDistanceRow[]): ExportDocument['bag'] {
  const labels = new Map<string, string>(CLUBS.map((club) => [club.id, club.label]));
  const order = new Map<string, number>(CLUBS.map((club, index) => [club.id, index]));
  const rank = (club: string) => order.get(club) ?? CLUBS.length;

  return [...rows]
    .sort((left, right) => rank(left.club) - rank(right.club) || compareText(left.club, right.club))
    .map((row) => ({
      club: row.club,
      label: labels.get(row.club) ?? row.club,
      carry_m: row.carry_m,
      updated_at: row.updated_at,
    }));
}

function buildDebriefs(
  sessions: readonly DebriefSessionRow[],
  messages: readonly DebriefMessageRow[],
): ExportDocument['debriefs'] {
  const messagesBySession = groupBy(messages, (message) => message.session_id);

  return [...sessions]
    .sort((left, right) => compareTime(left.created_at, right.created_at) || compareText(left.id, right.id))
    .map((session) => ({
      id: session.id,
      round_id: session.round_id,
      created_at: session.created_at,
      messages: [...(messagesBySession.get(session.id) ?? [])]
        .sort((left, right) => compareTime(left.created_at, right.created_at) || compareText(left.id, right.id))
        .map((message) => ({ role: message.role, content: message.content, created_at: message.created_at })),
    }));
}

export function buildExportDocument(source: ExportSource, context: ExportContext): ExportDocument {
  const { rounds, diagnosticsWithoutRound } = buildRounds(source);
  const { subscription } = source;

  return {
    exportedAt: context.now.toISOString(),
    app: { name: APP_NAME, version: context.appVersion },
    // Only id and email are copied from the session user, so no token can end up in the file.
    account: { id: source.user.id, email: source.user.email },
    profile: source.profile ? omit(source.profile, 'user_id') : null,
    subscription: subscription
      ? {
          is_premium: subscription.is_premium,
          plan: subscription.plan,
          expires_at: subscription.expires_at,
          updated_at: subscription.updated_at,
        }
      : null,
    rounds,
    diagnosticsWithoutRound,
    drills: buildDrills(source.drillCompletions),
    badges: buildBadges(source.badges),
    bag: buildBag(source.clubDistances),
    debriefs: buildDebriefs(source.debriefSessions, source.debriefMessages),
  };
}

export function serializeExportDocument(document: ExportDocument) {
  return `${JSON.stringify(document, null, 2)}\n`;
}
