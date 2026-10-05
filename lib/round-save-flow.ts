import { classifyRoundSaveFailure, getRoundSaveErrorMessage } from './round-save';
import { MAX_QUEUE_SIZE, type EnqueueResult } from './round-save-queue';

export const QUEUED_ROUND_TITLE = 'Round enregistré sur ton téléphone';
export const QUEUED_ROUND_TEXT = 'Il sera envoyé dès que la connexion revient.';
export const QUEUE_FULL_MESSAGE = `${MAX_QUEUE_SIZE} rounds attendent déjà d’être envoyés. Retrouve du réseau pour les envoyer, puis réessaie.`;

export type EnqueueOutcome = EnqueueResult | 'storage';

export type SaveFailureResolution = { queued: true } | { queued: false; message: string };

export function isQueueableSaveFailure(error: unknown) {
  const kind = classifyRoundSaveFailure(error);
  return kind === 'network' || kind === 'server';
}

// The round is only treated as saved once the queue durably holds it: otherwise the draft stays.
export async function resolveSaveFailure(
  error: unknown,
  enqueue: () => Promise<EnqueueOutcome>,
): Promise<SaveFailureResolution> {
  if (!isQueueableSaveFailure(error)) {
    return { queued: false, message: getRoundSaveErrorMessage(error) };
  }

  const outcome = await enqueue().catch((): EnqueueOutcome => 'storage');

  if (outcome === 'added' || outcome === 'duplicate') {
    return { queued: true };
  }

  return { queued: false, message: outcome === 'full' ? QUEUE_FULL_MESSAGE : getRoundSaveErrorMessage(error) };
}
