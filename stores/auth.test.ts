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

import { useAuthStore } from './auth';
import { useDrillsStore } from './drills';
import { useRoundsStore } from './rounds';

type Result = { data: unknown; error: { message: string } | null };

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

beforeEach(() => {
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

    useAuthStore.getState().setSession(session('user-2'));

    expect(useRoundsStore.getState().rounds).toEqual([]);
    expect(useRoundsStore.getState().initialized).toBe(false);
    expect(useDrillsStore.getState().completions).toEqual([]);
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().profileLoading).toBe(true);
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

  it('is cleared when the session disappears', () => {
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
