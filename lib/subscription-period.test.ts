const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));

jest.mock('./supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { describeSubscriptionPeriod, fetchSubscriptionPeriod } from './subscription-period';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('describeSubscriptionPeriod', () => {
  it('labels the plan and formats the end date in French', () => {
    const expires = new Date(2026, 10, 4, 12, 0).toISOString();

    expect(describeSubscriptionPeriod({ plan: 'annual', expires_at: expires })).toEqual({
      planLabel: 'Annuel',
      until: 'valable jusqu’au 4 novembre 2026',
    });
    expect(describeSubscriptionPeriod({ plan: 'monthly', expires_at: expires }).planLabel).toBe('Mensuel');
  });

  it('has no label for an unknown plan and no date without an expiry', () => {
    expect(describeSubscriptionPeriod({ plan: null, expires_at: null })).toEqual({ planLabel: null, until: null });
    expect(describeSubscriptionPeriod({ plan: 'lifetime', expires_at: null }).planLabel).toBeNull();
  });

  it('ignores an unreadable date', () => {
    expect(describeSubscriptionPeriod({ plan: 'annual', expires_at: 'not a date' }).until).toBeNull();
  });

  it('copes with a missing row', () => {
    expect(describeSubscriptionPeriod(null)).toEqual({ planLabel: null, until: null });
    expect(describeSubscriptionPeriod(undefined)).toEqual({ planLabel: null, until: null });
  });
});

describe('fetchSubscriptionPeriod', () => {
  it('reads the plan and expiry of the given user', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { plan: 'annual', expires_at: '2026-11-04T12:00:00.000Z' }, error: null });

    await expect(fetchSubscriptionPeriod('user-1')).resolves.toEqual({ plan: 'annual', expires_at: '2026-11-04T12:00:00.000Z' });
    expect(mockFrom).toHaveBeenCalledWith('subscriptions');
    expect(mockSelect).toHaveBeenCalledWith('plan, expires_at');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('returns null without a row', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchSubscriptionPeriod('user-1')).resolves.toBeNull();
  });

  it('returns null and logs a warning on an error', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(fetchSubscriptionPeriod('user-1')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[subscription] Period fetch failed', { message: 'boom' });
    warn.mockRestore();
  });
});
