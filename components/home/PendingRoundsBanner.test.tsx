import type { ReactElement } from 'react';
import { act } from 'react';
import { Alert } from 'react-native';

const mockSaveRound = jest.fn();

jest.mock('../../lib/theme', () => {
  const colors = jest.requireActual('../../constants/theme').lightColors;
  return {
    useTheme: () => ({ colors }),
    useThemedStyles: (create: (themeColors: unknown) => unknown) => create(colors),
  };
});
jest.mock('../ui/Icon', () => ({ Icon: () => null }));
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock('../../lib/round-save', () => ({
  ...jest.requireActual('../../lib/round-save'),
  saveRound: (args: unknown) => mockSaveRound(args),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSaveRoundArgs } from '../../lib/round-save';
import { saveQueue, type QueuedRound } from '../../lib/round-save-queue';
import { createDefaultScorecard } from '../../lib/rounds';
import { useRoundQueueStore } from '../../stores/round-queue';
import { PendingRoundsBanner } from './PendingRoundsBanner';

type Json = { type: string; props: Record<string, any>; children: Array<Json | string> | null };
type Renderer = {
  toJSON: () => Json | Json[] | null;
  unmount: () => void;
  root: { findAll: (test: (node: any) => boolean) => any[] };
};

const { create } = require('react-test-renderer') as { create: (element: ReactElement) => Renderer };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: Renderer | null = null;

function texts(node: Json | Json[] | string | null): string[] {
  if (node === null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);

  return (node.children ?? []).flatMap(texts);
}

function content() {
  return texts(renderer?.toJSON() ?? null).join(' ');
}

function labels() {
  return (renderer?.root.findAll((node) => typeof node.props?.accessibilityLabel === 'string') ?? []).map(
    (node) => node.props.accessibilityLabel as string,
  );
}

function action(label: string) {
  const node = renderer?.root.findAll(
    (candidate) => candidate.props?.accessibilityLabel === label && typeof candidate.props?.onPress === 'function',
  )[0];

  if (!node) throw new Error(`no action labelled ${label}`);
  return node;
}

function entry(id: string, overrides: Partial<QueuedRound> = {}): QueuedRound {
  return {
    clientRequestId: id,
    args: buildSaveRoundArgs({
      clientRequestId: id,
      playedAt: '2026-10-04T10:00:00.000Z',
      courseId: null,
      courseName: 'Golf de Test',
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

async function show(entries: QueuedRound[], flushing = false) {
  await saveQueue('user-1', entries);
  await useRoundQueueStore.getState().load('user-1');
  act(() => {
    useRoundQueueStore.setState({ flushing });
    renderer = create(<PendingRoundsBanner />);
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSaveRound.mockReset();
  useRoundQueueStore.getState().reset();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

describe('PendingRoundsBanner', () => {
  it('renders nothing when no round waits', async () => {
    await show([]);

    expect(renderer?.toJSON()).toBeNull();
  });

  it('says that a round waits, and offers to retry', async () => {
    await show([entry('a')]);

    expect(content()).toContain('1 round en attente d’envoi');
    expect(content()).toContain('Réessayer');
    expect(labels()).toContain('Réessayer d’envoyer les rounds en attente');
  });

  it('counts several rounds', async () => {
    await show([entry('a'), entry('b')]);

    expect(content()).toContain('2 rounds en attente d’envoi');
  });

  it('turns into a sending state without a retry action', async () => {
    await show([entry('a')], true);

    expect(content()).toContain('Envoi en cours…');
    expect(content()).not.toContain('Réessayer');
    expect(content()).not.toContain('en attente');
    expect(labels()).toContain('Envoi en cours');
  });

  it('sends the waiting round when pressing Réessayer, and disappears once it is sent', async () => {
    mockSaveRound.mockImplementation(async (args: any) => ({ id: 'round-a', user_id: 'user-1', played_at: args.p_round.played_at, holes: 18 }));
    await show([entry('a')]);

    await act(async () => {
      action('Réessayer d’envoyer les rounds en attente').props.onPress();
    });
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(mockSaveRound).toHaveBeenCalledTimes(1);
    expect(renderer?.toJSON()).toBeNull();
  });

  it('shows the sending state while the retry is on its way', async () => {
    let finish!: (round: unknown) => void;
    mockSaveRound.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve;
    }));
    await show([entry('a')]);

    act(() => {
      action('Réessayer d’envoyer les rounds en attente').props.onPress();
    });
    expect(content()).toContain('Envoi en cours…');

    await act(async () => {
      finish({ id: 'round-a', user_id: 'user-1', played_at: '2026-10-04T10:00:00.000Z', holes: 18 });
      await new Promise((resolve) => setImmediate(resolve));
    });
    expect(renderer?.toJSON()).toBeNull();
  });

  it('goes back to waiting when the retry fails again', async () => {
    mockSaveRound.mockRejectedValue(new TypeError('Network request failed'));
    await show([entry('a')]);

    await act(async () => {
      action('Réessayer d’envoyer les rounds en attente').props.onPress();
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(content()).toContain('1 round en attente d’envoi');
    expect(content()).not.toContain('Envoi en cours');
  });

  describe('when the server refused a round', () => {
    const stuck = () => entry('a', { status: 'needs_attention', lastError: '23514', attempts: 1 });

    it('says so clearly and offers to retry or delete it', async () => {
      await show([stuck()]);

      expect(content()).toContain('1 round n’a pas pu être envoyé');
      expect(content()).toContain('Le serveur a refusé ce round : certaines valeurs sont invalides.');
      expect(labels()).toEqual(expect.arrayContaining(['Réessayer d’envoyer le round', 'Supprimer le round qui n’a pas pu être envoyé']));
    });

    it('asks for a confirmation that names the round before deleting it', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await show([stuck()]);

      act(() => action('Supprimer le round qui n’a pas pu être envoyé').props.onPress());

      expect(alert).toHaveBeenCalledTimes(1);
      const [title, message, buttons] = alert.mock.calls[0];
      expect(title).toBe('Supprimer ce round ?');
      expect(message).toContain('Golf de Test · 4 octobre 2026 · 72 coups');
      expect(buttons?.map((button) => button.text)).toEqual(['Annuler', 'Supprimer']);
      expect(useRoundQueueStore.getState().entries).toHaveLength(1);
    });

    it('keeps the round when the confirmation is cancelled', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await show([stuck()]);

      act(() => action('Supprimer le round qui n’a pas pu être envoyé').props.onPress());
      const cancel = alert.mock.calls[0][2]?.find((button) => button.text === 'Annuler');
      await act(async () => cancel?.onPress?.());

      expect(useRoundQueueStore.getState().entries).toHaveLength(1);
      expect(content()).toContain('1 round n’a pas pu être envoyé');
    });

    it('deletes the round once confirmed, and the banner goes away', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await show([stuck()]);

      act(() => action('Supprimer le round qui n’a pas pu être envoyé').props.onPress());
      const confirm = alert.mock.calls[0][2]?.find((button) => button.text === 'Supprimer');
      expect(confirm?.style).toBe('destructive');
      await act(async () => {
        confirm?.onPress?.();
        await new Promise((resolve) => setImmediate(resolve));
      });

      expect(useRoundQueueStore.getState().entries).toEqual([]);
      expect(renderer?.toJSON()).toBeNull();
      await expect(AsyncStorage.getItem('fairwayiq:round-queue:v1:user-1')).resolves.toBeNull();
    });

    it('tries to send it again when pressing Réessayer', async () => {
      mockSaveRound.mockImplementation(async (args: any) => ({ id: 'round-a', user_id: 'user-1', played_at: args.p_round.played_at, holes: 18 }));
      await show([stuck()]);

      await act(async () => {
        action('Réessayer d’envoyer le round').props.onPress();
        await new Promise((resolve) => setImmediate(resolve));
      });
      await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
      });

      expect(mockSaveRound).toHaveBeenCalledTimes(1);
      expect(renderer?.toJSON()).toBeNull();
    });
  });
});
