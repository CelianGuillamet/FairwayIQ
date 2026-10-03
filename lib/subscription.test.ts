import { isSubscriptionActive } from './subscription';

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();

describe('isSubscriptionActive', () => {
  it('is inactive when there is no subscription row', () => {
    expect(isSubscriptionActive(null, NOW)).toBe(false);
    expect(isSubscriptionActive(undefined, NOW)).toBe(false);
  });

  it('is inactive when is_premium is false, even with a future expiry', () => {
    expect(isSubscriptionActive({ is_premium: false, expires_at: '2026-12-31T00:00:00.000Z' }, NOW)).toBe(false);
  });

  it('is inactive when is_premium is null', () => {
    expect(isSubscriptionActive({ is_premium: null, expires_at: null }, NOW)).toBe(false);
  });

  it('is active when is_premium is true and there is no expiry', () => {
    expect(isSubscriptionActive({ is_premium: true, expires_at: null }, NOW)).toBe(true);
  });

  it('is active when the expiry is in the future', () => {
    expect(isSubscriptionActive({ is_premium: true, expires_at: '2026-06-15T12:00:01.000Z' }, NOW)).toBe(true);
  });

  it('is inactive when the expiry is in the past', () => {
    expect(isSubscriptionActive({ is_premium: true, expires_at: '2026-06-14T12:00:00.000Z' }, NOW)).toBe(false);
  });

  it('is inactive when the expiry is exactly now', () => {
    expect(isSubscriptionActive({ is_premium: true, expires_at: '2026-06-15T12:00:00.000Z' }, NOW)).toBe(false);
  });

  it('is inactive when the expiry is not a valid date', () => {
    expect(isSubscriptionActive({ is_premium: true, expires_at: 'not-a-date' }, NOW)).toBe(false);
  });

  it('defaults to the current time', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(isSubscriptionActive({ is_premium: true, expires_at: future })).toBe(true);
    expect(isSubscriptionActive({ is_premium: true, expires_at: past })).toBe(false);
  });
});
