const mockFrom = jest.fn();
const mockSignOut = jest.fn();
const mockClearStoredAuthSession = jest.fn();
const mockResetPurchasesUser = jest.fn();
const mockClearRoundDraft = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: { signOut: (options?: unknown) => mockSignOut(options) },
  },
  clearStoredAuthSession: () => mockClearStoredAuthSession(),
}));

jest.mock('../lib/purchases', () => ({
  resetPurchasesUser: () => mockResetPurchasesUser(),
}));

jest.mock('../lib/round-draft', () => ({
  clearRoundDraft: (userId: string) => mockClearRoundDraft(userId),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedHoles, loadHolesForRounds, resetHolesData } from '../lib/holes-data';
import { getCourseMemoryStorageKey } from '../lib/course-memory';
import { getRoundQueueStorageKey } from '../lib/round-save-queue';
import { useAuthStore } from './auth';
import { useBagStore } from './bag';
import { useBadgesStore } from './badges';
import { useMonthlyChallengeStore } from './monthly-challenge';
import { useDrillsStore } from './drills';
import { useRoundQueueStore } from './round-queue';
import { useCourseMemoryStore } from './course-memory';
import { useRoundsStore } from './rounds';

type Result = { data: unknown; error: { message: string } | null };

const CACHED_ROUND = { id: 'r1', holes: 18, par: 72, total_score: 90, putts: 34, gir: 4, fairways_hit: 6, penalties: 1 } as const;

async function primeHolesCache() {
  mockFrom.mockReturnValueOnce({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) });
  await loadHolesForRounds([CACHED_ROUND]);
  expect(getCachedHoles([CACHED_ROUND])).not.toBeNull();
}

async function primeRoundQueue(userId: string) {
  const round = { client_request_id: 'req-1', played_at: '2026-10-05T10:00:00.000Z', holes: 9, total_score: 40, par: 36 };
  const holes = Array.from({ length: 9 }, (_, index) => ({ hole_number: index + 1, par: 4, score: 4 }));

  await useRoundQueueStore.getState().load(userId);
  await expect(useRoundQueueStore.getState().enqueue(userId, { p_round: round, p_holes: holes } as any)).resolves.toBe('added');
  expect(useRoundQueueStore.getState().entries).toHaveLength(1);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createQuery(result: Result | Promise<Result>) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['select', 'update', 'insert', 'eq']) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(() => Promise.resolve(result));
  query.single = jest.fn(() => Promise.resolve(result));
  return query;
}

function session(userId: string) {
  return { access_token: 'token', refresh_token: 'refresh', user: { id: userId } } as any;
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    display_name: 'Célian',
    handicap: 12,
    play_frequency: 'weekly',
    goal: 'lower_handicap',
    onboarding_complete: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as any;
}

const ONBOARDING_VALUES = {
  display_name: 'Nouveau',
  handicap: 36,
  play_frequency: 'monthly',
  goal: 'enjoy',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  mockFrom.mockReset();
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({ error: null });
  mockClearStoredAuthSession.mockReset();
  mockClearStoredAuthSession.mockResolvedValue(undefined);
  mockClearRoundDraft.mockReset();
  mockClearRoundDraft.mockResolvedValue(undefined);
  mockResetPurchasesUser.mockReset();
  useRoundsStore.getState().reset();
  useDrillsStore.getState().reset();
  useBagStore.getState().reset();
  useBadgesStore.getState().reset();
  useMonthlyChallengeStore.getState().reset();
  useRoundQueueStore.getState().reset();
  useCourseMemoryStore.getState().reset();
  resetHolesData();
  useAuthStore.setState({
    session: null,
    user: null,
    profile: null,
    loading: true,
    profileLoading: false,
    profileError: null,
    passwordRecovery: false,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchProfile', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(session('user-1'));
  });

  it('stores the fetched profile', async () => {
    mockFrom.mockReturnValueOnce(createQuery({ data: profile(), error: null }));

    await useAuthStore.getState().fetchProfile();

    const state = useAuthStore.getState();
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(state.profile?.onboarding_complete).toBe(true);
    expect(state.profileError).toBeNull();
    expect(state.profileLoading).toBe(false);
  });

  it('reports "no profile row" as a missing profile without an error', async () => {
    mockFrom.mockReturnValueOnce(createQuery({ data: null, error: null }));

    await useAuthStore.getState().fetchProfile();

    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().profileError).toBeNull();
  });

  it('keeps the previous profile when a refetch fails', async () => {
    useAuthStore.setState({ profile: profile() });
    mockFrom.mockReturnValueOnce(createQuery({ data: null, error: { message: 'network down' } }));

    await useAuthStore.getState().fetchProfile();

    const state = useAuthStore.getState();
    expect(state.profile?.onboarding_complete).toBe(true);
    expect(state.profileError).toBe('network down');
    expect(state.profileLoading).toBe(false);
  });

  it('reports a failed first fetch as an error, not as a missing profile', async () => {
    mockFrom.mockReturnValueOnce(createQuery({ data: null, error: { message: 'timeout' } }));

    await useAuthStore.getState().fetchProfile();

    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().profileError).toBe('timeout');
  });

  it('clears the error on a successful retry', async () => {
    mockFrom.mockReturnValueOnce(createQuery({ data: null, error: { message: 'timeout' } }));
    await useAuthStore.getState().fetchProfile();
    mockFrom.mockReturnValueOnce(createQuery({ data: profile(), error: null }));

    await useAuthStore.getState().fetchProfile();

    expect(useAuthStore.getState().profileError).toBeNull();
    expect(useAuthStore.getState().profile?.id).toBe('profile-1');
  });

  it('drops a response that lands after the user changed', async () => {
    const pending = deferred<Result>();
    mockFrom.mockReturnValueOnce(createQuery(pending.promise));

    const fetching = useAuthStore.getState().fetchProfile();
    useAuthStore.getState().setSession(session('user-2'));
    pending.resolve({ data: profile({ user_id: 'user-1' }), error: null });
    await fetching;

    expect(useAuthStore.getState().user?.id).toBe('user-2');
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().profileLoading).toBe(true);
  });

  it('drops a response that lands after sign-out', async () => {
    const pending = deferred<Result>();
    mockFrom.mockReturnValueOnce(createQuery(pending.promise));

    const fetching = useAuthStore.getState().fetchProfile();
    await useAuthStore.getState().signOut();
    pending.resolve({ data: profile(), error: null });
    await fetching;

    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('lets the newest request win over an older response that resolves last', async () => {
    const older = deferred<Result>();
    const newer = deferred<Result>();
    mockFrom.mockReturnValueOnce(createQuery(older.promise)).mockReturnValueOnce(createQuery(newer.promise));

    const first = useAuthStore.getState().fetchProfile();
    const second = useAuthStore.getState().fetchProfile();
    newer.resolve({ data: profile({ onboarding_complete: true }), error: null });
    await second;
    older.resolve({ data: profile({ onboarding_complete: false }), error: null });
    await first;

    expect(useAuthStore.getState().profile?.onboarding_complete).toBe(true);
  });
});

describe('setSession', () => {
  it('keeps the profile and its error when the same user gets a refreshed session', () => {
    useAuthStore.getState().setSession(session('user-1'));
    useAuthStore.setState({ profile: profile(), profileError: 'stale' });

    useAuthStore.getState().setSession(session('user-1'));

    expect(useAuthStore.getState().profile?.id).toBe('profile-1');
    expect(useAuthStore.getState().profileError).toBe('stale');
    expect(useAuthStore.getState().profileLoading).toBe(false);
  });

  it('clears the previous user caches when another user signs in', () => {
    useAuthStore.getState().setSession(session('user-1'));
    useRoundsStore.setState({ rounds: [{ id: 'r1' } as any], initialized: true, loading: false });
    useDrillsStore.setState({ completions: [{ id: 'c1' } as any], recommendedCategories: ['putting'] });
    useBagStore.setState({ userId: 'user-1', distances: { iron7: 140 }, loaded: true });

    useAuthStore.getState().setSession(session('user-2'));

    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(useRoundsStore.getState().initialized).toBe(false);
    expect(useDrillsStore.getState().completions).toEqual([]);
    expect(useBagStore.getState()).toMatchObject({ userId: null, distances: {}, loaded: false });
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().profileLoading).toBe(true);
  });

  it('clears the earned badges and the celebration queue when another user signs in', () => {
    useAuthStore.getState().setSession(session('user-1'));
    useBadgesStore.setState({ userId: 'user-1', earned: { first_round: '2026-01-01T00:00:00Z' }, loaded: true, queue: ['first_round'] });

    useAuthStore.getState().setSession(session('user-2'));

    expect(useBadgesStore.getState()).toMatchObject({ userId: null, earned: {}, loaded: false, queue: [] });
  });

  it('clears the monthly challenge when another user signs in', () => {
    useAuthStore.getState().setSession(session('user-1'));
    useMonthlyChallengeStore.setState({ userId: 'user-1', month: '2026-10', challengeId: 'drills_putting', changeUsed: true, loaded: true, doneSeen: true });

    useAuthStore.getState().setSession(session('user-2'));

    expect(useMonthlyChallengeStore.getState()).toMatchObject({ userId: null, month: null, challengeId: null, changeUsed: false, loaded: false, doneSeen: null });
  });

  it('clears the remembered tees in memory when another user signs in, but keeps them stored for their owner', async () => {
    useAuthStore.getState().setSession(session('user-1'));
    await useCourseMemoryStore.getState().load('user-1');
    useCourseMemoryStore.getState().remember('id:saint-cloud', { teeKey: 'white', holes: 9 });
    await new Promise((resolve) => setImmediate(resolve));

    useAuthStore.getState().setSession(session('user-2'));

    expect(useCourseMemoryStore.getState()).toMatchObject({ userId: null, entries: {}, loaded: false });
    await expect(AsyncStorage.getItem(getCourseMemoryStorageKey('user-1'))).resolves.not.toBeNull();
  });

  it('clears the queued rounds in memory when another user signs in, but keeps them stored for their owner', async () => {
    useAuthStore.getState().setSession(session('user-1'));
    await primeRoundQueue('user-1');

    useAuthStore.getState().setSession(session('user-2'));

    expect(useRoundQueueStore.getState()).toMatchObject({ userId: null, entries: [], loaded: false, flushing: false });
    await expect(AsyncStorage.getItem(getRoundQueueStorageKey('user-1'))).resolves.not.toBeNull();
  });

  it('clears the cached hole rows when another user signs in', async () => {
    useAuthStore.getState().setSession(session('user-1'));
    await primeHolesCache();

    useAuthStore.getState().setSession(session('user-2'));

    expect(getCachedHoles([CACHED_ROUND])).toBeNull();
  });
});

describe('completeOnboarding', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(session('user-1'));
  });

  it('updates the unfinished profile row created at signup', async () => {
    const update = createQuery({ data: profile({ ...ONBOARDING_VALUES }), error: null });
    mockFrom.mockReturnValueOnce(update);

    await expect(useAuthStore.getState().completeOnboarding(ONBOARDING_VALUES)).resolves.toBe('saved');

    expect(update.update).toHaveBeenCalledWith({ ...ONBOARDING_VALUES, onboarding_complete: true });
    expect(update.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(update.eq).toHaveBeenCalledWith('onboarding_complete', false);
    expect(useAuthStore.getState().profile?.display_name).toBe('Nouveau');
    expect(useAuthStore.getState().profileLoading).toBe(false);
  });

  it('never overwrites a profile that already finished onboarding', async () => {
    const existing = profile({ handicap: 8, goal: 'break_80' });
    const guardedUpdate = createQuery({ data: null, error: null });
    const lookup = createQuery({ data: existing, error: null });
    mockFrom.mockReturnValueOnce(guardedUpdate).mockReturnValueOnce(lookup);

    await expect(useAuthStore.getState().completeOnboarding(ONBOARDING_VALUES)).resolves.toBe('already_complete');

    expect(lookup.update).not.toHaveBeenCalled();
    expect(lookup.insert).not.toHaveBeenCalled();
    expect(useAuthStore.getState().profile?.handicap).toBe(8);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('inserts the profile when no row exists', async () => {
    const guardedUpdate = createQuery({ data: null, error: null });
    const lookup = createQuery({ data: null, error: null });
    const insert = createQuery({ data: profile({ ...ONBOARDING_VALUES }), error: null });
    mockFrom.mockReturnValueOnce(guardedUpdate).mockReturnValueOnce(lookup).mockReturnValueOnce(insert);

    await expect(useAuthStore.getState().completeOnboarding(ONBOARDING_VALUES)).resolves.toBe('saved');

    expect(insert.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      ...ONBOARDING_VALUES,
      onboarding_complete: true,
    });
  });

  it('throws without writing when the existence check fails', async () => {
    const guardedUpdate = createQuery({ data: null, error: null });
    const lookup = createQuery({ data: null, error: { message: 'network down' } });
    mockFrom.mockReturnValueOnce(guardedUpdate).mockReturnValueOnce(lookup);

    await expect(useAuthStore.getState().completeOnboarding(ONBOARDING_VALUES)).rejects.toEqual({
      message: 'network down',
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('throws when the update fails', async () => {
    mockFrom.mockReturnValueOnce(createQuery({ data: null, error: { message: 'rls' } }));

    await expect(useAuthStore.getState().completeOnboarding(ONBOARDING_VALUES)).rejects.toEqual({ message: 'rls' });
  });

  it('is not overridden by an older profile fetch that resolves afterwards', async () => {
    const stale = deferred<Result>();
    mockFrom.mockReturnValueOnce(createQuery(stale.promise));
    const fetching = useAuthStore.getState().fetchProfile();
    mockFrom.mockReturnValueOnce(createQuery({ data: profile({ ...ONBOARDING_VALUES }), error: null }));

    await useAuthStore.getState().completeOnboarding(ONBOARDING_VALUES);
    stale.resolve({ data: profile({ onboarding_complete: false }), error: null });
    await fetching;

    expect(useAuthStore.getState().profile?.onboarding_complete).toBe(true);
  });
});

describe('signOut', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(session('user-1'));
    useAuthStore.setState({ profile: profile() });
    useRoundsStore.setState({ rounds: [{ id: 'r1' } as any], initialized: true, loading: false });
    useDrillsStore.setState({ completions: [{ id: 'c1' } as any], recommendedCategories: ['putting'] });
    useBagStore.setState({ userId: 'user-1', distances: { iron7: 140 }, loaded: true });
  });

  it('signs out globally and clears every per-user cache', async () => {
    await useAuthStore.getState().signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith(undefined);
    expect(mockClearStoredAuthSession).not.toHaveBeenCalled();
    expect(mockResetPurchasesUser).toHaveBeenCalled();
    expect(mockClearRoundDraft).toHaveBeenCalledWith('user-1');

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(useRoundsStore.getState().initialized).toBe(false);
    expect(useDrillsStore.getState().completions).toEqual([]);
    expect(useDrillsStore.getState().recommendedCategories).toEqual([]);
    expect(useBagStore.getState()).toMatchObject({ userId: null, distances: {}, loaded: false });
  });

  it('clears the earned badges and the celebration queue', async () => {
    useBadgesStore.setState({ userId: 'user-1', earned: { first_round: '2026-01-01T00:00:00Z' }, loaded: true, queue: ['first_round'] });

    await useAuthStore.getState().signOut();

    expect(useBadgesStore.getState()).toMatchObject({ userId: null, earned: {}, loaded: false, queue: [] });
  });

  it('clears the monthly challenge', async () => {
    useMonthlyChallengeStore.setState({ userId: 'user-1', month: '2026-10', challengeId: 'drills_putting', changeUsed: true, loaded: true, doneSeen: true });

    await useAuthStore.getState().signOut();

    expect(useMonthlyChallengeStore.getState()).toMatchObject({ userId: null, month: null, challengeId: null, changeUsed: false, loaded: false, doneSeen: null });
  });

  it('clears the remembered tees in memory, but keeps them stored for when the user comes back', async () => {
    useAuthStore.getState().setSession(session('user-1'));
    await useCourseMemoryStore.getState().load('user-1');
    useCourseMemoryStore.getState().remember('id:saint-cloud', { teeKey: 'white', holes: 9 });
    await new Promise((resolve) => setImmediate(resolve));

    await useAuthStore.getState().signOut();

    expect(useCourseMemoryStore.getState()).toMatchObject({ userId: null, entries: {}, loaded: false });

    await useCourseMemoryStore.getState().load('user-1');
    expect(useCourseMemoryStore.getState().entries['id:saint-cloud']).toMatchObject({ teeKey: 'white', holes: 9 });
  });

  it('clears the queued rounds in memory, but keeps them stored for when the user comes back', async () => {
    await primeRoundQueue('user-1');

    await useAuthStore.getState().signOut();

    expect(useRoundQueueStore.getState()).toMatchObject({ userId: null, entries: [], loaded: false, flushing: false });
    await expect(AsyncStorage.getItem(getRoundQueueStorageKey('user-1'))).resolves.not.toBeNull();

    await useRoundQueueStore.getState().load('user-1');
    expect(useRoundQueueStore.getState().entries).toHaveLength(1);
  });

  it('clears the cached hole rows', async () => {
    await primeHolesCache();

    await useAuthStore.getState().signOut();

    expect(getCachedHoles([CACHED_ROUND])).toBeNull();
  });

  it('falls back to a local sign-out when the global one fails', async () => {
    mockSignOut.mockResolvedValueOnce({ error: { message: 'Network request failed' } });

    await useAuthStore.getState().signOut();

    expect(mockSignOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(mockClearStoredAuthSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('removes the stored session itself when even the local sign-out fails (offline)', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Network request failed' } });

    await useAuthStore.getState().signOut();

    expect(mockClearStoredAuthSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useRoundsStore.getState().rounds).toEqual([]);
  });

  it('still signs the user out locally when sign-out throws', async () => {
    mockSignOut.mockRejectedValue(new Error('boom'));

    await useAuthStore.getState().signOut();

    expect(mockClearStoredAuthSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not fail when clearing the round draft fails', async () => {
    mockClearRoundDraft.mockRejectedValue(new Error('storage unavailable'));

    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
  });
});

describe('password recovery flag', () => {
  it('starts off', () => {
    expect(useAuthStore.getState().passwordRecovery).toBe(false);
  });

  it('turns on with the PASSWORD_RECOVERY event', () => {
    useAuthStore.getState().setSession(session('user-1'), 'PASSWORD_RECOVERY');

    expect(useAuthStore.getState().passwordRecovery).toBe(true);
  });

  it('survives the SIGNED_IN a PKCE exchange emits once the reset screen raised it', () => {
    useAuthStore.getState().setPasswordRecovery(true);

    useAuthStore.getState().setSession(session('user-1'), 'SIGNED_IN');
    useAuthStore.getState().setSession(session('user-1'), 'USER_UPDATED');

    expect(useAuthStore.getState().passwordRecovery).toBe(true);
  });

  it('survives a late initial-session event without a session between raising it and the sign-in', () => {
    useAuthStore.getState().setPasswordRecovery(true);

    useAuthStore.getState().setSession(null, 'INITIAL_SESSION');
    useAuthStore.getState().setSession(null);

    expect(useAuthStore.getState().passwordRecovery).toBe(true);

    useAuthStore.getState().setSession(session('user-1'), 'SIGNED_IN');

    expect(useAuthStore.getState().passwordRecovery).toBe(true);
    expect(useAuthStore.getState().session).not.toBeNull();
  });

  it('is cleared when another user takes over the session', () => {
    useAuthStore.getState().setSession(session('user-1'), 'PASSWORD_RECOVERY');

    useAuthStore.getState().setSession(session('user-2'), 'SIGNED_IN');

    expect(useAuthStore.getState().passwordRecovery).toBe(false);
  });

  it('is not raised by an ordinary sign-in', () => {
    useAuthStore.getState().setSession(session('user-1'), 'SIGNED_IN');

    expect(useAuthStore.getState().passwordRecovery).toBe(false);
  });

  it('is cleared explicitly once the password is updated', () => {
    useAuthStore.getState().setSession(session('user-1'), 'PASSWORD_RECOVERY');

    useAuthStore.getState().setPasswordRecovery(false);

    expect(useAuthStore.getState().passwordRecovery).toBe(false);
    expect(useAuthStore.getState().session).not.toBeNull();
  });

  it('is cleared when the session disappears with an explicit sign-out', () => {
    useAuthStore.getState().setSession(session('user-1'), 'PASSWORD_RECOVERY');

    useAuthStore.getState().setSession(null, 'SIGNED_OUT');

    expect(useAuthStore.getState().passwordRecovery).toBe(false);
  });

  it('is cleared by signOut', async () => {
    useAuthStore.getState().setSession(session('user-1'), 'PASSWORD_RECOVERY');

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().passwordRecovery).toBe(false);
  });
});
