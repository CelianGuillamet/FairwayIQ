import type { ReactElement } from 'react';
import { act } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRemindersHintStorageKey } from '../../lib/reminders-hint';
import { RemindersHint } from './RemindersHint';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../lib/theme', () => {
  const colors = jest.requireActual('../../constants/theme').lightColors;
  return {
    useTheme: () => ({ colors }),
    useThemedStyles: (create: (themeColors: unknown) => unknown) => create(colors),
  };
});
jest.mock('../ui/Icon', () => ({ Icon: () => null }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

const mockAuth = { user: { id: 'user-1' } as { id: string } | null };
const mockRounds = { rounds: [{ id: 'r1' }] as Array<{ id: string }> };
const mockSettings = { hydrated: true, settings: { enabled: false } };

jest.mock('../../stores/auth', () => ({
  useAuthStore: (select: (state: typeof mockAuth) => unknown) => select(mockAuth),
}));
jest.mock('../../stores/rounds', () => ({
  useRoundsStore: (select: (state: typeof mockRounds) => unknown) => select(mockRounds),
}));
jest.mock('../../stores/notification-settings', () => ({
  useNotificationSettingsStore: (select: (state: typeof mockSettings) => unknown) => select(mockSettings),
}));

type Json = { type: string; props: Record<string, any>; children: Array<Json | string> | null };
type Renderer = { toJSON: () => Json | Json[] | null; root: { findAll: (test: (node: any) => boolean) => any[] } };

const { create } = require('react-test-renderer') as { create: (element: ReactElement) => Renderer };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(element: ReactElement) {
  let renderer!: Renderer;
  await act(async () => {
    renderer = create(element);
  });
  return renderer;
}

function texts(node: Json | Json[] | string | null): string[] {
  if (node === null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);

  return (node.children ?? []).flatMap(texts);
}

function action(renderer: Renderer, label: string) {
  const [node] = renderer.root.findAll((item) => item.props?.accessibilityLabel === label && typeof item.props?.onPress === 'function');
  return node;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockPush.mockClear();
  mockAuth.user = { id: 'user-1' };
  mockRounds.rounds = [{ id: 'r1' }];
  mockSettings.hydrated = true;
  mockSettings.settings.enabled = false;
});

describe('RemindersHint', () => {
  it('asks once the player has a saved round', async () => {
    const renderer = await render(<RemindersHint />);

    const content = texts(renderer.toJSON()).join(' ');
    expect(content).toContain('Veux-tu des rappels ?');
    expect(content).toContain('Régler les rappels');
    expect(content).toContain('Plus tard');
  });

  it('is hidden before the first round', async () => {
    mockRounds.rounds = [];

    expect((await render(<RemindersHint />)).toJSON()).toBeNull();
  });

  it('is hidden when reminders are already on', async () => {
    mockSettings.settings.enabled = true;

    expect((await render(<RemindersHint />)).toJSON()).toBeNull();
  });

  it('is hidden when this user dismissed it before', async () => {
    await AsyncStorage.setItem(getRemindersHintStorageKey('user-1'), '1');

    expect((await render(<RemindersHint />)).toJSON()).toBeNull();
  });

  it('still shows for another user who did not dismiss it', async () => {
    await AsyncStorage.setItem(getRemindersHintStorageKey('user-1'), '1');
    mockAuth.user = { id: 'user-2' };

    expect((await render(<RemindersHint />)).toJSON()).not.toBeNull();
  });

  it('hides and remembers the dismissal on "Plus tard"', async () => {
    const renderer = await render(<RemindersHint />);

    await act(async () => {
      action(renderer, 'Plus tard').props.onPress();
    });

    expect(renderer.toJSON()).toBeNull();
    expect(await AsyncStorage.getItem(getRemindersHintStorageKey('user-1'))).toBe('1');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the notification settings and does not ask again', async () => {
    const renderer = await render(<RemindersHint />);

    await act(async () => {
      action(renderer, 'Régler les rappels').props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith('/notifications');
    expect(renderer.toJSON()).toBeNull();
    expect(await AsyncStorage.getItem(getRemindersHintStorageKey('user-1'))).toBe('1');
  });
});
