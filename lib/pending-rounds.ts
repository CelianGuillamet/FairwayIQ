import { formatRoundDay } from './home';
import { classifyRoundSaveFailure } from './round-save';
import { summarizeQueue, type QueuedRound } from './round-save-queue';

export type PendingRoundsView =
  | { kind: 'hidden' }
  | { kind: 'pending'; title: string }
  | { kind: 'sending'; title: string }
  | { kind: 'attention'; title: string; caption: string; entry: QueuedRound };

export const SENDING_TITLE = 'Envoi en cours…';

const INVALID_CAPTION = 'Le serveur a refusé ce round : certaines valeurs sont invalides.';
const SESSION_CAPTION = 'Ta session a expiré. Reconnecte-toi puis réessaie.';
const GENERIC_CAPTION = 'Le serveur n’a pas pu l’enregistrer. Réessaie dans un instant.';

function describeAttention(entry: QueuedRound) {
  const code = entry.lastError ?? '';

  if (code.startsWith('22') || code.startsWith('23') || code === 'P0002') return INVALID_CAPTION;
  if (classifyRoundSaveFailure({ code }) === 'auth') return SESSION_CAPTION;
  return GENERIC_CAPTION;
}

export function getPendingRoundsView(entries: readonly QueuedRound[], flushing: boolean): PendingRoundsView {
  const { pending, needsAttention } = summarizeQueue(entries);

  if (pending > 0 && flushing) {
    return { kind: 'sending', title: SENDING_TITLE };
  }

  const stuck = entries.find((entry) => entry.status === 'needs_attention');

  if (stuck) {
    return {
      kind: 'attention',
      title: needsAttention === 1 ? '1 round n’a pas pu être envoyé' : `${needsAttention} rounds n’ont pas pu être envoyés`,
      caption: describeAttention(stuck),
      entry: stuck,
    };
  }

  if (pending > 0) {
    return { kind: 'pending', title: pending === 1 ? '1 round en attente d’envoi' : `${pending} rounds en attente d’envoi` };
  }

  return { kind: 'hidden' };
}

export function describeQueuedRound(entry: QueuedRound) {
  const { p_round: round } = entry.args;
  const course = round.course_name?.trim() || 'Parcours non précisé';

  return `${course} · ${formatRoundDay(round.played_at).long} · ${round.total_score} coups`;
}
