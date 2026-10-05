jest.mock('./supabase', () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { InvokeTimeoutError } from './invoke-timeout';
import { RoundSaveError } from './round-save';
import {
  QUEUED_ROUND_TEXT,
  QUEUED_ROUND_TITLE,
  QUEUE_FULL_MESSAGE,
  isQueueableSaveFailure,
  resolveSaveFailure,
  type EnqueueOutcome,
} from './round-save-flow';
import { MAX_QUEUE_SIZE } from './round-save-queue';

const NETWORK_MESSAGE = 'Connexion impossible. Vérifie ton réseau puis réessaie.';

const networkFailures = [
  ['a thrown fetch failure', new TypeError('Network request failed')],
  ['a client network answer', { code: '', message: 'TypeError: Failed to fetch' }],
  ['a timeout', { message: 'Request timed out' }],
  ['an already classified network error', new RoundSaveError(NETWORK_MESSAGE, 'unknown', 'network')],
  ['an already classified server error', new RoundSaveError('x', 'unknown', 'server')],
  ['the 15 s deadline of the save', new RoundSaveError(NETWORK_MESSAGE, 'timeout', 'network')],
  ['a deadline that passed', new InvokeTimeoutError('Délai dépassé (15000 ms).')],
  ['an aborted request', { code: '', message: 'AbortError: The user aborted a request.', hint: 'Request was aborted' }],
  ['a statement timeout', { code: '57014', message: 'canceling statement due to statement timeout' }],
] as const;

const blockingFailures = [
  ['invalid data', { code: '23514', message: 'violates check constraint' }],
  ['a refused session', { code: '28000', message: 'invalid authorization' }],
  ['an unknown error', { code: 'XX000', message: 'boom' }],
  ['an already classified permanent error', new RoundSaveError('Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.', '22003', 'permanent')],
  ['an already classified auth error', new RoundSaveError('Ta session a expiré. Reconnecte-toi puis réessaie.', '28000', 'auth')],
  ['nothing at all', null],
] as const;

describe('isQueueableSaveFailure', () => {
  it.each(networkFailures)('queues %s', (_label, error) => {
    expect(isQueueableSaveFailure(error)).toBe(true);
  });

  it.each(blockingFailures)('does not queue %s', (_label, error) => {
    expect(isQueueableSaveFailure(error)).toBe(false);
  });
});

describe('resolveSaveFailure', () => {
  it.each(networkFailures)('keeps the round in the queue after %s', async (_label, error) => {
    const enqueue = jest.fn().mockResolvedValue('added');

    await expect(resolveSaveFailure(error, enqueue)).resolves.toEqual({ queued: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it.each(blockingFailures)('shows the error and keeps the draft after %s, without touching the queue', async (_label, error) => {
    const enqueue = jest.fn().mockResolvedValue('added');

    const resolution = await resolveSaveFailure(error, enqueue);

    expect(resolution.queued).toBe(false);
    expect(resolution).toEqual({ queued: false, message: expect.any(String) });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('shows today’s message for invalid data and for a refused session', async () => {
    const enqueue = jest.fn();

    await expect(resolveSaveFailure({ code: '23514' }, enqueue)).resolves.toEqual({
      queued: false,
      message: 'Certaines valeurs du round sont invalides. Vérifie la saisie puis réessaie.',
    });
    await expect(resolveSaveFailure({ code: '28000' }, enqueue)).resolves.toEqual({
      queued: false,
      message: 'Ta session a expiré. Reconnecte-toi puis réessaie.',
    });
  });

  it('treats a round that is already queued (a retried save) as queued', async () => {
    await expect(resolveSaveFailure(new TypeError('Network request failed'), async () => 'duplicate')).resolves.toEqual({ queued: true });
  });

  it('keeps the draft and says the queue is full when no more rounds fit', async () => {
    const resolution = await resolveSaveFailure(new TypeError('Network request failed'), async () => 'full');

    expect(resolution).toEqual({ queued: false, message: QUEUE_FULL_MESSAGE });
    expect(QUEUE_FULL_MESSAGE).toContain(String(MAX_QUEUE_SIZE));
  });

  it.each<EnqueueOutcome>(['storage', 'invalid'])('keeps the draft and the network message when the phone could not store the round (%s)', async (outcome) => {
    const resolution = await resolveSaveFailure(new TypeError('Network request failed'), async () => outcome);

    expect(resolution).toEqual({ queued: false, message: NETWORK_MESSAGE });
  });

  it('keeps the draft when enqueueing itself throws', async () => {
    const resolution = await resolveSaveFailure(new TypeError('Network request failed'), () => Promise.reject(new Error('disk')));

    expect(resolution).toEqual({ queued: false, message: NETWORK_MESSAGE });
  });

  it('words the confirmation calmly, in French', () => {
    expect(`${QUEUED_ROUND_TITLE}. ${QUEUED_ROUND_TEXT}`).toBe(
      'Round enregistré sur ton téléphone. Il sera envoyé dès que la connexion revient.',
    );
  });
});
