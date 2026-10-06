import type { ReactElement } from 'react';
import { act } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table), auth: { signOut: jest.fn() } },
  clearStoredAuthSession: jest.fn(),
}));
jest.mock('../../lib/purchases', () => ({ resetPurchasesUser: jest.fn() }));
jest.mock('../../lib/round-draft', () => ({ clearRoundDraft: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { resetHolesData } from '../../lib/holes-data';
import { getMonthlyChallengeStorageKey } from '../../lib/monthly-challenge-storage';
import { useAuthStore } from '../../stores/auth';
import { useBadgesStore } from '../../stores/badges';
import { useDrillsStore } from '../../stores/drills';
import { useMonthlyChallengeStore } from '../../stores/monthly-challenge';
import { useRoundsStore } from '../../stores/rounds';
import type { LeaksResult } from '../leaks/useLeaks';
import { useMonthlyChallenge, type MonthlyChallengeView } from './useMonthlyChallenge';

type Renderer = { update: (element: ReactElement) => void; unmount: () => void };

const { create } = require('react-test-renderer') as { create: (element: ReactElement) => Renderer };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 15, 12, 0, 0);

let view: MonthlyChallengeView;
let renderer: Renderer | null = null;
let upsert: jest.Mock;
let holeRows: Record<string, unknown[]>;

function Probe({ leaks }: { leaks: LeaksResult }) {
  view = useMonthlyChallenge(leaks);
  return null;
}

function leaksResult(status: 'loading' | 'ready', leakIds: string[] = [], lowConfidence = leakIds.length === 0): LeaksResult {
  if (status === 'loading') return { status: 'loading', analysis: null, error: null, reload: jest.fn() };

  const drills: Record<string, string> = { putting: 'putting', penalties: 'driving', blowups: 'mental', tee: 'driving', approach: 'approach', short_game: 'short_game' };
  const analysis = { lowConfidence, leaks: leakIds.map((id) => ({ id, drill: drills[id] })) } as unknown as LeaksResult['analysis'];

  return { status: 'ready', analysis, error: null, reload: jest.fn() } as LeaksResult;
}

function roundRow(id: string, day: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: 'user-1',
    played_at: new Date(2026, 9, day, 10, 0, 0).toISOString(),
    holes: 18,
    total_score: 90,
    par: 72,
    putts: 34,
    gir: 6,
    fairways_hit: 7,
    penalties: 0,
    ...overrides,
  } as any;
}

function completionRow(id: string, drillId: string, day: number, result?: [number, number]) {
  return {
    id,
    drill_id: drillId,
    completed_at: new Date(2026, 9, day, 10, 0, 0).toISOString(),
    ...(result ? { result_made: result[0], result_attempts: result[1] } : {}),
  } as any;
}

function cleanCard(overrides: Array<Record<string, unknown>> = []) {
  return Array.from({ length: 18 }, (_, index) => ({
    hole_number: index + 1,
    par: 4,
    score: 5,
    putts: 2,
    gir: false,
    fairway_hit: true,
    penalty: 0,
    ...overrides[index],
  }));
}

function seed({
  rounds = [] as any[],
  completions = [] as any[],
  roundsReady = true,
  drillsReady = true,
  earned = {} as Record<string, string>,
  badgesLoaded = true,
} = {}) {
  act(() => {
    useAuthStore.setState({ user: { id: 'user-1' } as any });
    useRoundsStore.setState({ rounds, initialized: roundsReady, loading: false, error: null });
    useDrillsStore.setState({ completions, initialized: drillsReady });
    useBadgesStore.setState({ userId: badgesLoaded ? 'user-1' : null, earned, loaded: badgesLoaded, backfilled: true, queue: [] });
  });
}

async function settle() {
  for (let index = 0; index < 4; index++) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

async function mount(leaks: LeaksResult) {
  await act(async () => {
    renderer = create(<Probe leaks={leaks} />);
  });
  await settle();
}

async function rerender(leaks: LeaksResult) {
  await act(async () => {
    renderer?.update(<Probe leaks={leaks} />);
  });
  await settle();
}

async function storedChallenge() {
  const raw = await AsyncStorage.getItem(getMonthlyChallengeStorageKey('user-1'));
  return raw ? JSON.parse(raw) : null;
}

function awardedIds() {
  return upsert.mock.calls.flatMap(([rows]) => rows.map((row: { badge_id: string }) => row.badge_id));
}

function readyView() {
  if (view.status !== 'ready') throw new Error('the card should be shown');
  return view;
}

beforeEach(async () => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'performance', 'hrtime', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback'],
  });
  await AsyncStorage.clear();
  holeRows = {};
  upsert = jest.fn().mockResolvedValue({ data: null, error: null });
  mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'round_holes') {
      return {
        select: () => ({
          in: (_column: string, ids: string[]) =>
            Promise.resolve({
              data: ids.flatMap((id) => (holeRows[id] ?? []).map((row) => ({ round_id: id, ...(row as object) }))),
              error: null,
            }),
        }),
      };
    }

    return { upsert };
  });
  useAuthStore.setState({ user: null });
  useRoundsStore.getState().reset();
  useDrillsStore.getState().reset();
  useBadgesStore.getState().reset();
  useMonthlyChallengeStore.getState().reset();
  resetHolesData();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
});

describe('what the card shows', () => {
  it('stays hidden until the rounds and the drills are loaded', async () => {
    seed({ rounds: [roundRow('r1', 3)], roundsReady: false });
    await mount(leaksResult('ready'));
    expect(view.status).toBe('hidden');

    seed({ rounds: [roundRow('r1', 3)], drillsReady: false });
    await rerender(leaksResult('ready'));
    expect(view.status).toBe('hidden');
  });

  it('stays hidden, and chooses nothing, when there are no rounds and no drills', async () => {
    seed();
    await mount(leaksResult('ready'));

    expect(view.status).toBe('hidden');
    expect(useMonthlyChallengeStore.getState().challengeId).toBeNull();
    await expect(storedChallenge()).resolves.toBeNull();
  });

  it('waits for the leaks before choosing, so a loading screen never fixes the fallback', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    await mount(leaksResult('loading'));

    expect(view.status).toBe('hidden');
    await expect(storedChallenge()).resolves.toBeNull();

    await rerender(leaksResult('ready', ['penalties']));

    expect(readyView().challenge.id).toBe('rounds_few_penalties');
  });

  it('shows the challenge built from the top leak, with its progress', async () => {
    seed({ rounds: [roundRow('r1', 3)], completions: [completionRow('c1', '1', 2)] });
    holeRows = { r1: cleanCard([{ penalty: 1 }]) };
    await mount(leaksResult('ready', ['penalties', 'putting']));

    expect(readyView().challenge.id).toBe('rounds_few_penalties');
    expect(readyView().progress).toEqual({ current: 1, target: 3, done: false, daysLeft: 16 });
    await expect(storedChallenge()).resolves.toEqual({ month: '2026-10', challengeId: 'rounds_few_penalties', changeUsed: false });
  });

  it('falls back to three rounds without enough hole data', async () => {
    seed({ rounds: [roundRow('r1', 3, { putts: null })] });
    await mount(leaksResult('ready'));

    expect(readyView().challenge.id).toBe('rounds_three');
    expect(readyView().progress).toMatchObject({ current: 1, target: 3, done: false });
  });

  it('shows a drills-only player the challenge too', async () => {
    seed({ completions: [completionRow('c1', '1', 2)] });
    await mount(leaksResult('ready', ['putting']));

    expect(view.status).toBe('ready');
  });

  it('counts drills of the category without any hole fetch', async () => {
    seed({
      rounds: [roundRow('r1', 3)],
      completions: [completionRow('c1', '7', 2, [8, 10]), completionRow('c2', '8', 4), completionRow('c3', '9', 5, [1, 10]), completionRow('c4', '1', 5)],
    });
    await mount(leaksResult('ready', ['approach']));

    expect(readyView().challenge.id).toBe('drills_approach');
    expect(readyView().progress).toMatchObject({ current: 2, target: 4 });
    expect(mockFrom).not.toHaveBeenCalledWith('round_holes');
  });
});

describe('keeping the choice', () => {
  it('keeps the challenge of the month when the leaks change', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    await mount(leaksResult('ready', ['penalties']));
    expect(readyView().challenge.id).toBe('rounds_few_penalties');

    await rerender(leaksResult('ready', ['approach']));

    expect(readyView().challenge.id).toBe('rounds_few_penalties');
  });

  it('keeps it across sessions', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    await mount(leaksResult('ready', ['penalties']));
    act(() => renderer?.unmount());
    renderer = null;
    useMonthlyChallengeStore.getState().reset();

    await mount(leaksResult('ready', ['approach']));

    expect(readyView().challenge.id).toBe('rounds_few_penalties');
  });

  it('chooses again when the month rolls over', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    await mount(leaksResult('ready', ['penalties']));
    expect(readyView().challenge.id).toBe('rounds_few_penalties');

    jest.setSystemTime(new Date(2026, 10, 2, 9, 0, 0));
    await rerender(leaksResult('ready', ['approach']));

    expect(readyView().challenge.id).toBe('drills_approach');
    expect(readyView().progress).toMatchObject({ current: 0 });
    await expect(storedChallenge()).resolves.toEqual({ month: '2026-11', challengeId: 'drills_approach', changeUsed: false });
  });
});

describe('hole-based challenges', () => {
  it('waits for the hole rows of the month, then counts them', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 8, { played_at: new Date(2026, 8, 20).toISOString() })] });
    holeRows = { r1: cleanCard() };
    await mount(leaksResult('ready', ['blowups']));

    expect(readyView().challenge.id).toBe('round_no_double');
    expect(readyView().progress).toMatchObject({ current: 1, target: 1, done: true });
    const requested = mockFrom.mock.calls.filter(([table]) => table === 'round_holes').length;
    expect(requested).toBe(1);
  });

  it('never counts a legacy round', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 5)] });
    holeRows = {};
    await mount(leaksResult('ready', ['blowups']));

    expect(readyView().progress).toMatchObject({ current: 0, done: false });
  });
});

describe('changing the challenge', () => {
  it('offers the change once, to the next candidate', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    await mount(leaksResult('ready', ['penalties', 'approach']));
    expect(readyView()).toMatchObject({ canChange: true, changeUsed: false });

    await act(async () => readyView().change());
    await settle();

    expect(readyView().challenge.id).toBe('drills_approach');
    expect(readyView()).toMatchObject({ canChange: false, changeUsed: true });
    await expect(storedChallenge()).resolves.toEqual({ month: '2026-10', challengeId: 'drills_approach', changeUsed: true });

    await act(async () => readyView().change());
    expect(readyView().challenge.id).toBe('drills_approach');
  });

  it('skips a candidate that is already done', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 4), roundRow('r3', 5)] });
    holeRows = { r1: cleanCard(), r2: cleanCard(), r3: cleanCard() };
    await mount(leaksResult('ready', ['penalties', 'tee']));
    act(() => useMonthlyChallengeStore.setState({ challengeId: 'drills_driving' }));
    await rerender(leaksResult('ready', ['penalties', 'tee']));

    await act(async () => readyView().change());

    expect(readyView().challenge.id).toBe('drills_putting');
  });

  it('does not offer the change while the leaks are loading', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    await mount(leaksResult('ready', ['penalties']));
    await rerender(leaksResult('loading'));

    expect(readyView().canChange).toBe(false);
  });
});

describe('the Défi du mois relevé badge', () => {
  it('celebrates the flip from undone to done, once', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 5)] });
    await mount(leaksResult('ready'));
    expect(readyView().progress.done).toBe(false);
    expect(awardedIds()).toEqual([]);

    await act(async () => {
      useRoundsStore.setState({ rounds: [roundRow('r3', 9), roundRow('r1', 3), roundRow('r2', 5)] });
    });
    await settle();

    expect(readyView().progress.done).toBe(true);
    expect(useBadgesStore.getState().queue).toEqual(['monthly_challenge']);
    expect(awardedIds()).toEqual(['monthly_challenge']);

    await act(async () => {
      useRoundsStore.setState({ rounds: [roundRow('r4', 11), roundRow('r3', 9), roundRow('r1', 3), roundRow('r2', 5)] });
    });
    await settle();

    expect(useBadgesStore.getState().queue).toEqual(['monthly_challenge']);
    expect(awardedIds()).toEqual(['monthly_challenge']);
  });

  it('celebrates a hole-based challenge once its hole rows are in', async () => {
    seed({ rounds: [roundRow('r1', 3)] });
    holeRows = { r1: cleanCard([{ score: 6 }]) };
    await mount(leaksResult('ready', ['blowups']));
    expect(readyView().progress.done).toBe(false);

    holeRows.r2 = cleanCard();
    await act(async () => {
      useRoundsStore.setState({ rounds: [roundRow('r2', 9), roundRow('r1', 3)] });
    });
    await settle();

    expect(readyView().progress.done).toBe(true);
    expect(useBadgesStore.getState().queue).toEqual(['monthly_challenge']);
  });

  it('keeps a challenge that is already done at the first look silent', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 5), roundRow('r3', 9)] });
    await mount(leaksResult('ready'));

    expect(readyView().progress.done).toBe(true);
    expect(useBadgesStore.getState().earned).toHaveProperty('monthly_challenge');
    expect(useBadgesStore.getState().queue).toEqual([]);
    expect(awardedIds()).toEqual(['monthly_challenge']);
  });

  it('is awarded again at the next load when the first insert failed, instead of being lost', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rounds = [roundRow('r1', 3), roundRow('r2', 5), roundRow('r3', 9)];
    upsert.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } });
    seed({ rounds });
    await mount(leaksResult('ready'));

    expect(awardedIds()).toEqual(['monthly_challenge']);
    expect(useBadgesStore.getState().unsynced).toHaveProperty('monthly_challenge');

    act(() => renderer?.unmount());
    renderer = null;
    useBadgesStore.getState().reset();
    useMonthlyChallengeStore.getState().reset();
    upsert.mockClear();
    seed({ rounds, earned: {} });
    await mount(leaksResult('ready'));

    expect(awardedIds()).toEqual(['monthly_challenge']);
    expect(useBadgesStore.getState().queue).toEqual([]);
    expect(useBadgesStore.getState().unsynced).toEqual({});
    warn.mockRestore();
  });

  it('does not award it again when it was already earned', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 5)], earned: { monthly_challenge: '2026-09-20T10:00:00Z' } });
    await mount(leaksResult('ready'));

    await act(async () => {
      useRoundsStore.setState({ rounds: [roundRow('r3', 9), roundRow('r1', 3), roundRow('r2', 5)] });
    });
    await settle();

    expect(readyView().progress.done).toBe(true);
    expect(awardedIds()).toEqual([]);
    expect(useBadgesStore.getState().queue).toEqual([]);
  });

  it('waits for the badges to be loaded before judging the flip', async () => {
    seed({ rounds: [roundRow('r1', 3), roundRow('r2', 5)], badgesLoaded: false });
    await mount(leaksResult('ready'));

    await act(async () => {
      useRoundsStore.setState({ rounds: [roundRow('r3', 9), roundRow('r1', 3), roundRow('r2', 5)] });
    });
    await settle();
    expect(awardedIds()).toEqual([]);

    await act(async () => {
      useBadgesStore.setState({ userId: 'user-1', loaded: true });
    });
    await settle();

    expect(awardedIds()).toEqual(['monthly_challenge']);
    expect(useBadgesStore.getState().queue).toEqual([]);
  });
});
