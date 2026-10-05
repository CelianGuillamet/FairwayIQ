const mockFrom = jest.fn();
const mockLoadStoredWeeklyGoal = jest.fn();
const mockLoadHolesForRounds = jest.fn();

jest.mock('./supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table), auth: { signOut: jest.fn() } },
  clearStoredAuthSession: jest.fn(),
}));
jest.mock('./purchases', () => ({
  resetPurchasesUser: jest.fn(),
}));
jest.mock('./round-draft', () => ({
  clearRoundDraft: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('./weekly-goal-storage', () => ({
  loadStoredWeeklyGoal: (userId: string) => mockLoadStoredWeeklyGoal(userId),
}));
jest.mock('./holes-data', () => ({
  loadHolesForRounds: (rounds: unknown) => mockLoadHolesForRounds(rounds),
  resetHolesData: jest.fn(),
}));

import { awardAfterDrill, awardAfterRound, syncBadges } from './badge-awards';
import { useAuthStore } from '../stores/auth';
import { useBadgesStore } from '../stores/badges';
import { useDrillsStore } from '../stores/drills';
import { useRoundsStore } from '../stores/rounds';

const NOW = new Date(2026, 9, 7, 12, 0, 0);
const CLEAN_CARD_BADGES = { no_three_putt: '2026-10-01T10:00:00Z', no_double: '2026-10-01T10:00:00Z' };

function iso(day: number, hour = 12, month = 10) {
  return new Date(2026, month - 1, day, hour, 0, 0).toISOString();
}

function round(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: 'user-1',
    played_at: iso(1),
    holes: 18,
    total_score: 105,
    par: 72,
    putts: 36,
    gir: 4,
    fairways_hit: 5,
    penalties: 1,
    ...overrides,
  } as any;
}

function completion(id: string, day: number, overrides: Record<string, unknown> = {}) {
  return { id, drill_id: 'drill-1', completed_at: iso(day), ...overrides } as any;
}

function card(overrides: Array<Record<string, unknown>> = []) {
  return Array.from({ length: 18 }, (_, index) => ({ par: 4, score: 5, putts: 2, ...overrides[index] }));
}

let upsert: jest.Mock;
let select: jest.Mock;
let warn: jest.SpyInstance;

function seedStores({
  rounds = [] as any[],
  completions = [] as any[],
  earned = {} as Record<string, string>,
  backfilled = true,
  roundsReady = true,
  drillsReady = true,
} = {}) {
  useAuthStore.setState({ user: { id: 'user-1' } as any, profile: { play_frequency: 'weekly' } as any, loading: false });
  useRoundsStore.setState({ rounds, initialized: roundsReady, loading: false, error: null });
  useDrillsStore.setState({ completions, initialized: drillsReady });
  useBadgesStore.setState({ userId: 'user-1', earned, loaded: true, backfilled, queue: [] });
}

function awardedIds() {
  return upsert.mock.calls.flatMap(([rows]) => rows.map((row: { badge_id: string }) => row.badge_id));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  upsert = jest.fn().mockResolvedValue({ data: null, error: null });
  select = jest.fn().mockResolvedValue({ data: [], error: null });
  mockFrom.mockReset();
  mockFrom.mockReturnValue({ upsert, select });
  mockLoadStoredWeeklyGoal.mockReset();
  mockLoadStoredWeeklyGoal.mockResolvedValue(null);
  mockLoadHolesForRounds.mockReset();
  mockLoadHolesForRounds.mockResolvedValue({});
  useAuthStore.setState({ user: null, profile: null, loading: false });
  useRoundsStore.getState().reset();
  useDrillsStore.getState().reset();
  useBadgesStore.getState().reset();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  jest.useRealTimers();
});

describe('awardAfterRound', () => {
  it('celebrates the badges a saved round earns, with its hole data', async () => {
    const saved = round('r1', { total_score: 79, played_at: iso(7) });
    seedStores({ rounds: [saved], earned: {} });

    await awardAfterRound(saved, card([{ par: 4, score: 3 }]));

    expect(useBadgesStore.getState().queue).toEqual([
      'first_round',
      'first_birdie',
      'no_three_putt',
      'no_double',
      'break_100',
      'break_90',
      'break_80',
    ]);
    expect(awardedIds()).toEqual(useBadgesStore.getState().queue);
  });

  it('works when the saved round is not in the rounds store yet', async () => {
    seedStores({ rounds: [] });

    await awardAfterRound(round('r1', { played_at: iso(7) }), card());

    expect(useBadgesStore.getState().queue).toContain('first_round');
  });

  it('does not celebrate a badge twice', async () => {
    const saved = round('r1', { total_score: 95, played_at: iso(7) });
    seedStores({ rounds: [saved] });

    await awardAfterRound(saved, card());
    await awardAfterRound(saved, card());

    expect(awardedIds().filter((id) => id === 'first_round')).toHaveLength(1);
    expect(useBadgesStore.getState().queue.filter((id) => id === 'first_round')).toHaveLength(1);
  });

  it('celebrates the weekly goal once the saved round reaches it (stored goal first)', async () => {
    mockLoadStoredWeeklyGoal.mockResolvedValue(2);
    const earlier = round('r0', { played_at: iso(5) });
    const saved = round('r1', { played_at: iso(7) });
    seedStores({ rounds: [saved, earlier], earned: { first_round: iso(1), ...CLEAN_CARD_BADGES } });

    await awardAfterRound(saved, card());

    expect(mockLoadStoredWeeklyGoal).toHaveBeenCalledWith('user-1');
    expect(useBadgesStore.getState().queue).toEqual(['week_goal']);
  });

  it('falls back to the goal of the play frequency when none is stored', async () => {
    const saved = round('r1', { played_at: iso(7) });
    seedStores({ rounds: [saved], earned: { first_round: iso(1), ...CLEAN_CARD_BADGES } });
    useAuthStore.setState({ profile: { play_frequency: 'monthly' } as any });

    await awardAfterRound(saved, card());

    expect(useBadgesStore.getState().queue).toEqual(['week_goal']);
  });

  it('never celebrates before the backfill: it runs the silent sync instead', async () => {
    const old = round('old', { played_at: iso(1, 12, 3) });
    const saved = round('r1', { played_at: iso(7), total_score: 85 });
    seedStores({ rounds: [saved, old], backfilled: false });
    select.mockResolvedValue({ data: [], error: null });
    useBadgesStore.setState({ userId: null, loaded: false });

    await awardAfterRound(saved, card());

    expect(useBadgesStore.getState().queue).toEqual([]);
    expect(useBadgesStore.getState().backfilled).toBe(true);
    expect(Object.keys(useBadgesStore.getState().earned)).toEqual(expect.arrayContaining(['first_round', 'break_100', 'break_90']));
  });

  it('does nothing without a signed-in user', async () => {
    seedStores();
    useAuthStore.setState({ user: null });

    await awardAfterRound(round('r1'), card());

    expect(upsert).not.toHaveBeenCalled();
    expect(useBadgesStore.getState().queue).toEqual([]);
  });

  it('never throws: a failing load is only logged by code', async () => {
    useAuthStore.setState({ user: { id: 'user-1' } as any });
    select.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } });

    await expect(awardAfterRound(round('r1'), card())).resolves.toBeUndefined();

    expect(useBadgesStore.getState().queue).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[badges] load failed', 'PGRST301');
  });

  it('never throws when the weekly goal cannot be read', async () => {
    mockLoadStoredWeeklyGoal.mockRejectedValue(new Error('storage down'));
    seedStores({ rounds: [round('r1')] });

    await expect(awardAfterRound(round('r1'), card())).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[badges] round evaluation failed', 'Error');
  });
});

describe('awardAfterDrill', () => {
  it('celebrates the first drill and a perfect result', async () => {
    const done = completion('c1', 7, { result_made: 10, result_attempts: 10 });
    seedStores({ completions: [done] });

    await awardAfterDrill(done);

    expect(useBadgesStore.getState().queue).toEqual(['first_drill', 'perfect_drill']);
  });

  it('does not treat a skipped result or a missed try as perfect', async () => {
    const skipped = completion('c1', 7);
    seedStores({ completions: [skipped] });
    await awardAfterDrill(skipped);
    expect(useBadgesStore.getState().queue).toEqual(['first_drill']);

    const missed = completion('c2', 7, { result_made: 9, result_attempts: 10 });
    seedStores({ completions: [missed, skipped], earned: { first_drill: iso(1) } });
    await awardAfterDrill(missed);
    expect(useBadgesStore.getState().queue).toEqual([]);
  });

  it('celebrates the 7-day streak from the store streak', async () => {
    const days = [1, 2, 3, 4, 5, 6, 7];
    const completions = days.map((day) => completion(`c${day}`, day));
    seedStores({ completions: [...completions].reverse(), earned: { first_drill: iso(1), week_goal: iso(6) } });

    await awardAfterDrill(completions[completions.length - 1]);

    expect(useBadgesStore.getState().queue).toEqual(['streak_7']);
  });

  it('celebrates the 10th drill', async () => {
    const completions = Array.from({ length: 10 }, (_, index) => completion(`c${index}`, 1 + (index % 2) * 3));
    seedStores({ completions, earned: { first_drill: iso(1) } });

    await awardAfterDrill(completions[0]);

    expect(useBadgesStore.getState().queue).toEqual(['drills_10']);
  });

  it('celebrates the weekly goal reached with rounds and drills together', async () => {
    mockLoadStoredWeeklyGoal.mockResolvedValue(2);
    const done = completion('c1', 7);
    seedStores({
      rounds: [round('r1', { played_at: iso(6) })],
      completions: [done],
      earned: { first_drill: iso(1) },
    });

    await awardAfterDrill(done);

    expect(useBadgesStore.getState().queue).toEqual(['week_goal']);
  });
});

describe('syncBadges', () => {
  it('silently awards what existing data deserves, dated when it was earned', async () => {
    const rounds = [round('r2', { played_at: iso(2), total_score: 92 }), round('r1', { played_at: iso(1), total_score: 110 })];
    const completions = [completion('c1', 3, { result_made: 5, result_attempts: 5 })];
    seedStores({ rounds, completions, backfilled: false });
    useBadgesStore.setState({ userId: null, loaded: false });
    mockLoadStoredWeeklyGoal.mockResolvedValue(7);

    await syncBadges();

    const state = useBadgesStore.getState();
    expect(state.queue).toEqual([]);
    expect(state.backfilled).toBe(true);
    expect(state.earned).toEqual({
      first_round: iso(1),
      break_100: iso(2),
      first_drill: iso(3),
      perfect_drill: iso(3),
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][1]).toMatchObject({ ignoreDuplicates: true });
  });

  it('does not run before the rounds and the drills are loaded', async () => {
    seedStores({ rounds: [round('r1')], backfilled: false, drillsReady: false });
    await syncBadges();
    expect(useBadgesStore.getState().backfilled).toBe(false);
    expect(upsert).not.toHaveBeenCalled();

    useDrillsStore.setState({ initialized: true });
    useRoundsStore.setState({ error: 'Network request failed' });
    await syncBadges();
    expect(useBadgesStore.getState().backfilled).toBe(false);

    useRoundsStore.setState({ error: null });
    await syncBadges();
    expect(useBadgesStore.getState().backfilled).toBe(true);
    expect(awardedIds()).toContain('first_round');
  });

  it('runs once per session', async () => {
    seedStores({ rounds: [round('r1')], backfilled: false });

    await syncBadges();
    await syncBadges();

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('runs once when called twice at the same time', async () => {
    seedStores({ rounds: [round('r1')], backfilled: false });

    await Promise.all([syncBadges(), syncBadges()]);

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('derives the hole-based badges from the loaded hole rows', async () => {
    const rounds = [round('r1', { played_at: iso(1), total_score: 100 })];
    mockLoadHolesForRounds.mockResolvedValue({ r1: card([{ par: 4, score: 3 }]) });
    seedStores({ rounds, backfilled: false });

    await syncBadges();

    expect(mockLoadHolesForRounds).toHaveBeenCalledWith(rounds);
    expect(Object.keys(useBadgesStore.getState().earned).sort()).toEqual(
      ['first_birdie', 'first_round', 'no_double', 'no_three_putt'].sort(),
    );
  });

  it('loads hole rows in chunks', async () => {
    const rounds = Array.from({ length: 45 }, (_, index) => round(`r${index}`, { played_at: iso(1 + (index % 28)) }));
    seedStores({ rounds, backfilled: false });

    await syncBadges();

    expect(mockLoadHolesForRounds.mock.calls.map(([chunk]) => chunk.length)).toEqual([20, 20, 5]);
  });

  it('does not fetch hole rows when every hole-based badge is already earned', async () => {
    seedStores({
      rounds: [round('r1')],
      earned: { first_birdie: iso(1), no_three_putt: iso(1), no_double: iso(1) },
      backfilled: false,
    });

    await syncBadges();

    expect(mockLoadHolesForRounds).not.toHaveBeenCalled();
  });

  it('still backfills the other badges when the hole rows cannot be loaded', async () => {
    mockLoadHolesForRounds.mockRejectedValue(new Error('Impossible de charger le détail des trous pour le moment.'));
    seedStores({ rounds: [round('r1', { total_score: 88 })], backfilled: false });

    await syncBadges();

    expect(Object.keys(useBadgesStore.getState().earned).sort()).toEqual(['break_100', 'break_90', 'first_round']);
    expect(useBadgesStore.getState().backfilled).toBe(true);
    expect(warn).toHaveBeenCalledWith('[badges] hole rows unavailable for the backfill', 'Error');
  });

  it('does not mark the backfill done for the next user when the session changed meanwhile', async () => {
    const pending = new Promise<Record<string, never>>((resolve) => setTimeout(() => resolve({}), 10));
    mockLoadHolesForRounds.mockReturnValue(pending);
    seedStores({ rounds: [round('r1')], backfilled: false });

    const syncing = syncBadges();
    useBadgesStore.getState().reset();
    jest.advanceTimersByTime(20);
    await syncing;

    expect(useBadgesStore.getState().backfilled).toBe(false);
    expect(useBadgesStore.getState().earned).toEqual({});
  });

  it('never throws', async () => {
    useAuthStore.setState({ user: { id: 'user-1' } as any });
    mockFrom.mockImplementation(() => {
      throw new TypeError('boom');
    });

    await expect(syncBadges()).resolves.toBeUndefined();
  });
});
