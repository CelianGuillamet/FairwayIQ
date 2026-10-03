const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
const mockAuthState: { user: { id: string } | null } = { user: { id: 'user-1' } };

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

jest.mock('./auth', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

import { useSubscriptionStore } from './subscription';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const FUTURE = '2026-07-15T12:00:00.000Z';
const PAST = '2026-05-15T12:00:00.000Z';

function resolveRow(row: { is_premium: boolean; expires_at: string | null } | null) {
  mockMaybeSingle.mockResolvedValue({ data: row, error: null });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockMaybeSingle.mockReset();
  mockFrom.mockClear();
  mockEq.mockClear();
  mockAuthState.user = { id: 'user-1' };
  useSubscriptionStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('refresh', () => {
  it('reads the subscription row of the current user', async () => {
    resolveRow({ is_premium: true, expires_at: FUTURE });

    await useSubscriptionStore.getState().refresh();

    expect(mockFrom).toHaveBeenCalledWith('subscriptions');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(useSubscriptionStore.getState().isPremium).toBe(true);
    expect(useSubscriptionStore.getState().loading).toBe(false);
  });

  it('is premium when the row has no expiry', async () => {
    resolveRow({ is_premium: true, expires_at: null });

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(true);
  });

  it('is not premium when the subscription has expired', async () => {
    resolveRow({ is_premium: true, expires_at: PAST });

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });

  it('is not premium when there is no row', async () => {
    resolveRow(null);

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });

  it('does not query when nobody is signed in', async () => {
    mockAuthState.user = null;

    await useSubscriptionStore.getState().refresh();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });

  it('keeps the previous state when the query fails', async () => {
    resolveRow({ is_premium: true, expires_at: FUTURE });
    await useSubscriptionStore.getState().refresh();

    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(true);
    expect(useSubscriptionStore.getState().loading).toBe(false);
  });

  it('is loading while the query is in flight', async () => {
    let resolveQuery: (value: unknown) => void = () => {};
    mockMaybeSingle.mockReturnValue(new Promise((resolve) => { resolveQuery = resolve; }));

    const pending = useSubscriptionStore.getState().refresh();
    expect(useSubscriptionStore.getState().loading).toBe(true);

    resolveQuery({ data: null, error: null });
    await pending;
    expect(useSubscriptionStore.getState().loading).toBe(false);
  });

  it('ignores a response that arrives after reset', async () => {
    let resolveQuery: (value: unknown) => void = () => {};
    mockMaybeSingle.mockReturnValue(new Promise((resolve) => { resolveQuery = resolve; }));

    const pending = useSubscriptionStore.getState().refresh();
    useSubscriptionStore.getState().reset();
    resolveQuery({ data: { is_premium: true, expires_at: FUTURE }, error: null });
    await pending;

    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });
});

describe('markPremium', () => {
  it('unlocks premium immediately', () => {
    useSubscriptionStore.getState().markPremium();

    expect(useSubscriptionStore.getState().isPremium).toBe(true);
  });

  it('survives a refresh that still reads a free row (webhook lag)', async () => {
    useSubscriptionStore.getState().markPremium();
    resolveRow({ is_premium: false, expires_at: null });

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(true);
  });

  it('falls back to the row once the grace period is over', async () => {
    useSubscriptionStore.getState().markPremium();
    jest.setSystemTime(new Date(NOW.getTime() + 11 * 60 * 1000));
    resolveRow({ is_premium: false, expires_at: null });

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });
});

describe('markFree', () => {
  it('drops premium and the purchase grace', async () => {
    useSubscriptionStore.getState().markPremium();
    useSubscriptionStore.getState().markFree();
    resolveRow({ is_premium: false, expires_at: null });

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium).toBe(false);
  });
});

describe('reset', () => {
  it('clears premium state', () => {
    useSubscriptionStore.getState().markPremium();

    useSubscriptionStore.getState().reset();

    expect(useSubscriptionStore.getState().isPremium).toBe(false);
    expect(useSubscriptionStore.getState().loading).toBe(false);
  });
});
