import type { ReactElement } from 'react';
import { act } from 'react';
import { AppState } from 'react-native';

const mockSaveRound = jest.fn();
const mockAwardAfterRound = jest.fn();
const mockRemoveNetworkListener = jest.fn();
const mockAddNetworkListener = jest.fn();

jest.mock('./supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn(), auth: { signOut: jest.fn() } },
  clearStoredAuthSession: jest.fn(),
}));
jest.mock('./purchases', () => ({ resetPurchasesUser: jest.fn() }));
jest.mock('./round-draft', () => ({ clearRoundDraft: jest.fn() }));
jest.mock('./round-save', () => ({
  ...jest.requireActual('./round-save'),
  saveRound: (args: unknown) => mockSaveRound(args),
}));
jest.mock('./badge-awards', () => ({
  awardAfterRound: (...args: unknown[]) => mockAwardAfterRound(...args),
}));
jest.mock('expo-network', () => ({
  addNetworkStateListener: (listener: unknown) => mockAddNetworkListener(listener),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/auth';
import { useRoundQueueStore } from '../stores/round-queue';
import { useRoundsStore } from '../stores/rounds';
import { buildSaveRoundArgs } from './round-save';
import { saveQueue, type QueuedRound } from './round-save-queue';
import { createDefaultScorecard } from './rounds';
import { FLUSH_INTERVAL_MS, isBackOnline, useRoundQueueSync } from './use-round-queue-sync';

type Renderer = { unmount: () => void };

const { create } = require('react-test-renderer') as { create: (element: ReactElement) => Renderer };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { load: realLoad, flush: realFlush } = useRoundQueueStore.getState();

let renderer: Renderer | null = null;
let appStateListener: ((state: string) => void) | null = null;
let networkListener: ((state: { isConnected?: boolean; isInternetReachable?: boolean | null }) => void) | null = null;
let load: jest.Mock;
let flush: jest.Mock;
const removeAppStateListener = jest.fn();

function Probe() {
  useRoundQueueSync();
  return null;
}

function entry(id: string): QueuedRound {
  return {
    clientRequestId: id,
    args: buildSaveRoundArgs({
      clientRequestId: id,
      playedAt: '2026-10-05T10:00:00.000Z',
      courseId: null,
      courseName: null,
      teeKey: null,
      notes: null,
      scorecard: createDefaultScorecard(18).map((hole) => ({ ...hole, completed: true })),
    }),
    createdAt: '2026-10-05T10:00:00.000Z',
    attempts: 0,
    status: 'pending',
  };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}

async function mount() {
  await act(async () => {
    renderer = create(<Probe />);
  });
  await settle();
}

function signIn(userId: string | null, loading = false) {
  act(() => {
    useAuthStore.setState({ user: userId ? ({ id: userId } as any) : null, loading });
  });
}

function stubActions() {
  load = jest.fn().mockResolvedValue(undefined);
  flush = jest.fn().mockResolvedValue(undefined);
  useRoundQueueStore.setState({ load, flush });
}

beforeEach(async () => {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'performance', 'hrtime', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  await AsyncStorage.clear();
  appStateListener = null;
  networkListener = null;
  removeAppStateListener.mockReset();
  mockRemoveNetworkListener.mockReset();
  mockAddNetworkListener.mockReset();
  mockAddNetworkListener.mockImplementation((listener) => {
    networkListener = listener;
    return { remove: mockRemoveNetworkListener };
  });
  mockSaveRound.mockReset();
  mockAwardAfterRound.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
    appStateListener = listener;
    return { remove: removeAppStateListener };
  }) as any);
  useAuthStore.setState({ user: null, loading: true });
  useRoundsStore.getState().reset();
  useRoundQueueStore.getState().reset();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('isBackOnline', () => {
  it('needs a connection that is not known to be cut off from the internet', () => {
    expect(isBackOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isBackOnline({ isConnected: true })).toBe(true);
    expect(isBackOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isBackOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isBackOnline({ isConnected: false })).toBe(false);
    expect(isBackOnline({})).toBe(false);
  });
});

describe('triggers', () => {
  beforeEach(() => {
    stubActions();
  });

  it('flushes when the app starts with a signed-in user, after loading their queue', async () => {
    signIn('user-1');
    await mount();

    expect(load).toHaveBeenCalledWith('user-1');
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith('session');
    expect(load.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
  });

  it('waits for the session instead of flushing before it is known', async () => {
    await mount();
    expect(flush).not.toHaveBeenCalled();

    signIn('user-1', true);
    await settle();
    expect(flush).not.toHaveBeenCalled();

    signIn('user-1', false);
    await settle();
    expect(flush).toHaveBeenCalledWith('session');
  });

  it('flushes again after a sign-in, for the new user', async () => {
    signIn('user-1');
    await mount();
    signIn(null);
    await settle();
    flush.mockClear();

    signIn('user-2');
    await settle();

    expect(load).toHaveBeenLastCalledWith('user-2');
    expect(flush).toHaveBeenCalledWith('session');
  });

  it('flushes when the app comes back to the foreground, and only then', async () => {
    signIn('user-1');
    await mount();
    flush.mockClear();

    await act(async () => appStateListener?.('background'));
    await act(async () => appStateListener?.('inactive'));
    expect(flush).not.toHaveBeenCalled();

    await act(async () => appStateListener?.('active'));
    expect(flush).toHaveBeenCalledWith('foreground');
  });

  it('flushes when the connection comes back, and not when it drops', async () => {
    signIn('user-1');
    await mount();
    flush.mockClear();

    await act(async () => networkListener?.({ isConnected: false }));
    await act(async () => networkListener?.({ isConnected: true, isInternetReachable: false }));
    expect(flush).not.toHaveBeenCalled();

    await act(async () => networkListener?.({ isConnected: true, isInternetReachable: true }));
    expect(flush).toHaveBeenCalledWith('network');
  });

  it('listens to nothing without a user', async () => {
    await mount();

    expect(appStateListener).toBeNull();
    expect(networkListener).toBeNull();
  });

  it('stops listening on unmount and when the user signs out', async () => {
    signIn('user-1');
    await mount();

    signIn(null);
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(mockRemoveNetworkListener).toHaveBeenCalledTimes(1);

    signIn('user-1');
    act(() => renderer?.unmount());
    renderer = null;
    expect(removeAppStateListener).toHaveBeenCalledTimes(2);
    expect(mockRemoveNetworkListener).toHaveBeenCalledTimes(2);
  });

  it('keeps working on the foreground and the timer when expo-network is unavailable', async () => {
    mockAddNetworkListener.mockImplementation(() => {
      throw new Error('Cannot find native module ExpoNetwork');
    });
    signIn('user-1');
    useRoundQueueStore.setState({ entries: [entry('a')] });

    await mount();
    flush.mockClear();

    await act(async () => appStateListener?.('active'));
    expect(flush).toHaveBeenCalledWith('foreground');

    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS);
    });
    expect(flush).toHaveBeenCalledWith('timer');
  });
});

describe('timer', () => {
  beforeEach(() => {
    stubActions();
  });

  it('does not tick while nothing is waiting', async () => {
    signIn('user-1');
    await mount();
    flush.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS * 4);
    });

    expect(flush).not.toHaveBeenCalled();
  });

  it('ticks every interval while a round waits, and stops once the queue is empty', async () => {
    signIn('user-1');
    await mount();
    flush.mockClear();

    act(() => useRoundQueueStore.setState({ entries: [entry('a')] }));
    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS - 1);
    });
    expect(flush).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenLastCalledWith('timer');

    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS);
    });
    expect(flush).toHaveBeenCalledTimes(2);

    act(() => useRoundQueueStore.setState({ entries: [] }));
    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS * 3);
    });
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('does not tick for rounds that only wait for attention', async () => {
    signIn('user-1');
    await mount();
    flush.mockClear();

    act(() => useRoundQueueStore.setState({ entries: [{ ...entry('a'), status: 'needs_attention' }] }));
    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS * 3);
    });

    expect(flush).not.toHaveBeenCalled();
  });

  it('does not tick for a signed-out user', async () => {
    signIn('user-1');
    await mount();
    act(() => useRoundQueueStore.setState({ entries: [entry('a')] }));
    signIn(null);
    flush.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(FLUSH_INTERVAL_MS * 3);
    });

    expect(flush).not.toHaveBeenCalled();
  });
});

describe('with the real queue', () => {
  beforeEach(() => {
    useRoundQueueStore.setState({ load: realLoad, flush: realFlush });
  });

  it('sends a queued round when the app starts, adds it to the rounds and evaluates the badges', async () => {
    const queued = entry('a');
    await saveQueue('user-1', [queued]);
    mockSaveRound.mockResolvedValue({ id: 'round-a', user_id: 'user-1', played_at: queued.args.p_round.played_at, holes: 18 });

    signIn('user-1');
    await mount();
    await settle();

    expect(mockSaveRound).toHaveBeenCalledWith(queued.args);
    expect(useRoundsStore.getState().rounds.map((round) => round.id)).toEqual(['round-a']);
    expect(mockAwardAfterRound).toHaveBeenCalledTimes(1);
    expect(mockAwardAfterRound.mock.calls[0][0]).toMatchObject({ id: 'round-a' });
    expect(mockAwardAfterRound.mock.calls[0][1]).toEqual(queued.args.p_holes);
    expect(useRoundQueueStore.getState().entries).toEqual([]);
  });

  it('sends it when the connection comes back after a failed attempt', async () => {
    const queued = entry('a');
    await saveQueue('user-1', [queued]);
    mockSaveRound
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValue({ id: 'round-a', user_id: 'user-1', played_at: queued.args.p_round.played_at, holes: 18 });

    signIn('user-1');
    await mount();
    await settle();
    expect(useRoundQueueStore.getState().entries).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await act(async () => networkListener?.({ isConnected: true, isInternetReachable: true }));
    await settle();

    expect(mockSaveRound).toHaveBeenCalledTimes(2);
    expect(useRoundQueueStore.getState().entries).toEqual([]);
    expect(mockAwardAfterRound).toHaveBeenCalledTimes(1);
  });
});
