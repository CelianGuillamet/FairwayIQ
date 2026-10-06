jest.mock('./supabase', () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { describeQueuedRound, getPendingRoundsView } from './pending-rounds';
import { buildSaveRoundArgs } from './round-save';
import type { QueuedRound } from './round-save-queue';
import { createDefaultScorecard } from './rounds';

function entry(id: string, overrides: Partial<QueuedRound> = {}, courseName: string | null = 'Golf de Test'): QueuedRound {
  return {
    clientRequestId: id,
    args: buildSaveRoundArgs({
      clientRequestId: id,
      playedAt: '2026-10-04T10:00:00.000Z',
      courseId: null,
      courseName,
      teeKey: null,
      notes: null,
      scorecard: createDefaultScorecard(18).map((hole) => ({ ...hole, completed: true })),
    }),
    createdAt: '2026-10-04T10:00:00.000Z',
    attempts: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('getPendingRoundsView', () => {
  it('is hidden when nothing is queued', () => {
    expect(getPendingRoundsView([], false)).toEqual({ kind: 'hidden' });
    expect(getPendingRoundsView([], true)).toEqual({ kind: 'hidden' });
  });

  it('counts the rounds that wait, in the singular and the plural', () => {
    expect(getPendingRoundsView([entry('a')], false)).toEqual({ kind: 'pending', title: '1 round en attente d’envoi' });
    expect(getPendingRoundsView([entry('a'), entry('b'), entry('c')], false)).toEqual({
      kind: 'pending',
      title: '3 rounds en attente d’envoi',
    });
  });

  it('turns into a sending state while a flush runs, and back afterwards', () => {
    expect(getPendingRoundsView([entry('a')], true)).toEqual({ kind: 'sending', title: 'Envoi en cours…' });
    expect(getPendingRoundsView([entry('a')], false).kind).toBe('pending');
  });

  it('keeps counting a round that failed once but still waits', () => {
    expect(getPendingRoundsView([entry('a', { attempts: 2, lastError: 'network' })], false)).toEqual({
      kind: 'pending',
      title: '1 round en attente d’envoi',
    });
  });

  it('explains a round the server refused as invalid', () => {
    const stuck = entry('a', { status: 'needs_attention', lastError: '23514' });

    expect(getPendingRoundsView([stuck], false)).toEqual({
      kind: 'attention',
      title: '1 round n’a pas pu être envoyé',
      caption: 'Le serveur a refusé ce round : certaines valeurs sont invalides.',
      entry: stuck,
    });
  });

  it.each(['22003', '22P02', '23502', '23505', 'P0002'])('reads SQLSTATE %s as invalid data', (code) => {
    const view = getPendingRoundsView([entry('a', { status: 'needs_attention', lastError: code })], false);

    expect(view).toMatchObject({ kind: 'attention', caption: 'Le serveur a refusé ce round : certaines valeurs sont invalides.' });
  });

  it.each(['28000', '42501', 'PGRST301'])('asks to sign in again for a refused session (%s)', (code) => {
    const view = getPendingRoundsView([entry('a', { status: 'needs_attention', lastError: code })], false);

    expect(view).toMatchObject({ kind: 'attention', caption: 'Ta session a expiré. Reconnecte-toi puis réessaie.' });
  });

  it.each(['57014', 'unknown', undefined])('falls back to a generic sentence for %s', (code) => {
    const view = getPendingRoundsView([entry('a', { status: 'needs_attention', lastError: code })], false);

    expect(view).toMatchObject({ kind: 'attention', caption: 'Le serveur n’a pas pu l’enregistrer. Réessaie dans un instant.' });
  });

  it('counts the rounds that need attention and points at the oldest one', () => {
    const first = entry('a', { status: 'needs_attention', lastError: '23514' });
    const second = entry('b', { status: 'needs_attention', lastError: '57014' });

    const view = getPendingRoundsView([entry('c'), first, second], false);

    expect(view).toMatchObject({ kind: 'attention', title: '2 rounds n’ont pas pu être envoyés' });
    expect(view.kind === 'attention' && view.entry.clientRequestId).toBe('a');
  });

  it('shows the sending state before the rounds that need attention', () => {
    expect(getPendingRoundsView([entry('a'), entry('b', { status: 'needs_attention' })], true).kind).toBe('sending');
  });

  it('shows the rounds that need attention before the ones that wait', () => {
    expect(getPendingRoundsView([entry('a'), entry('b', { status: 'needs_attention' })], false).kind).toBe('attention');
  });

  it('does not claim to be sending when only rounds that need attention are left', () => {
    expect(getPendingRoundsView([entry('a', { status: 'needs_attention' })], true).kind).toBe('attention');
  });
});

describe('describeQueuedRound', () => {
  it('names the course, the day and the score so the player knows what they are deleting', () => {
    expect(describeQueuedRound(entry('a'))).toBe('Golf de Test · 4 octobre 2026 · 72 coups');
  });

  it('copes with a round without a course', () => {
    expect(describeQueuedRound(entry('a', {}, null))).toContain('Parcours non précisé');
    expect(describeQueuedRound(entry('a', {}, '  '))).toContain('Parcours non précisé');
  });
});
