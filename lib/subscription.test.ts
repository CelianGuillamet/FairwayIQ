import {
  buildSubscriptionDisclosure,
  describeFreeTrial,
  findPlanPackage,
  isSubscriptionActive,
  MANAGE_SUBSCRIPTION_URL,
} from './subscription';

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

describe('findPlanPackage', () => {
  const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY' };
  const annual = { identifier: '$rc_annual', packageType: 'ANNUAL' };
  const weekly = { identifier: '$rc_weekly', packageType: 'WEEKLY' };

  it('returns the exact package of the selected plan', () => {
    const offering = { monthly, annual, availablePackages: [weekly, annual, monthly] };

    expect(findPlanPackage(offering, 'monthly')).toBe(monthly);
    expect(findPlanPackage(offering, 'annual')).toBe(annual);
  });

  it('never falls back to another plan when the selected one is missing', () => {
    const offering = { monthly: null, annual, availablePackages: [weekly, annual] };

    expect(findPlanPackage(offering, 'monthly')).toBeNull();
    expect(findPlanPackage({ monthly: null, annual: null, availablePackages: [weekly] }, 'annual')).toBeNull();
  });

  it('finds the package in availablePackages by type or identifier', () => {
    const byType = { identifier: 'custom_month', packageType: 'MONTHLY' };
    const byIdentifier = { identifier: '$rc_annual', packageType: 'CUSTOM' };

    expect(findPlanPackage({ availablePackages: [weekly, byType] }, 'monthly')).toBe(byType);
    expect(findPlanPackage({ availablePackages: [weekly, byIdentifier] }, 'annual')).toBe(byIdentifier);
  });

  it('does not trust a convenience accessor that points at the wrong package', () => {
    expect(findPlanPackage({ monthly: annual, annual: null, availablePackages: [] }, 'monthly')).toBeNull();
  });

  it('returns null without an offering', () => {
    expect(findPlanPackage(null, 'monthly')).toBeNull();
    expect(findPlanPackage(undefined, 'annual')).toBeNull();
  });
});

describe('describeFreeTrial', () => {
  const trial = (overrides: Partial<{ price: number; cycles: number; periodUnit: string; periodNumberOfUnits: number }> = {}) => ({
    price: 0,
    cycles: 1,
    periodUnit: 'WEEK',
    periodNumberOfUnits: 1,
    ...overrides,
  });

  it('shows no trial without an introductory offer', () => {
    expect(describeFreeTrial(null, true)).toBeNull();
    expect(describeFreeTrial(undefined, true)).toBeNull();
  });

  it('shows no trial when the user is not eligible', () => {
    expect(describeFreeTrial(trial(), false)).toBeNull();
  });

  it('shows no trial for a paid introductory offer', () => {
    expect(describeFreeTrial(trial({ price: 0.99 }), true)).toBeNull();
  });

  it('derives the duration from the offer', () => {
    expect(describeFreeTrial(trial(), true)).toEqual({ duration: '7 jours', freeLabel: '7 jours gratuits' });
    expect(describeFreeTrial(trial({ periodNumberOfUnits: 2 }), true)?.duration).toBe('14 jours');
    expect(describeFreeTrial(trial({ periodUnit: 'DAY', periodNumberOfUnits: 3 }), true)?.freeLabel).toBe('3 jours gratuits');
    expect(describeFreeTrial(trial({ periodUnit: 'DAY', periodNumberOfUnits: 1 }), true)?.freeLabel).toBe('1 jour gratuit');
    expect(describeFreeTrial(trial({ periodUnit: 'MONTH', periodNumberOfUnits: 1 }), true)?.freeLabel).toBe('1 mois gratuit');
    expect(describeFreeTrial(trial({ periodUnit: 'MONTH', periodNumberOfUnits: 3 }), true)?.freeLabel).toBe('3 mois gratuits');
    expect(describeFreeTrial(trial({ periodUnit: 'YEAR', periodNumberOfUnits: 1 }), true)?.freeLabel).toBe('1 an gratuit');
  });

  it('shows no trial for an unreadable period', () => {
    expect(describeFreeTrial(trial({ periodUnit: 'FORTNIGHT' }), true)).toBeNull();
    expect(describeFreeTrial(trial({ periodNumberOfUnits: 0 }), true)).toBeNull();
    expect(describeFreeTrial(trial({ periodNumberOfUnits: 1.5 }), true)).toBeNull();
  });
});

describe('buildSubscriptionDisclosure', () => {
  it('states price, period, Apple ID billing, 24h auto-renewal and where to manage it', () => {
    const { summary, terms } = buildSubscriptionDisclosure('annual', '49,99 €', null);

    expect(summary).toBe('Abonnement Premium annuel : 49,99 €/an.');
    expect(terms).toContain('compte Apple (Apple ID)');
    expect(terms).toContain('se renouvelle automatiquement');
    expect(terms).toContain('au moins 24 heures avant la fin de la période en cours');
    expect(terms).toContain('réglages de ton compte Apple');
    expect(summary + terms).not.toMatch(/gratuit/i);
  });

  it('mentions the trial only when one applies', () => {
    const trial = describeFreeTrial({ price: 0, cycles: 1, periodUnit: 'WEEK', periodNumberOfUnits: 1 }, true);
    const { summary, terms } = buildSubscriptionDisclosure('monthly', '4,99 €', trial);

    expect(summary).toBe('Abonnement Premium mensuel : 7 jours gratuits, puis 4,99 €/mois.');
    expect(terms).toContain('Aucun paiement pendant l’essai');
    expect(terms).toContain('essai inclus');
  });

  it('does not invent a price', () => {
    expect(buildSubscriptionDisclosure('monthly', null, null).summary).toContain('prix indisponible');
  });

  it('points to the App Store subscription settings', () => {
    expect(MANAGE_SUBSCRIPTION_URL).toBe('https://apps.apple.com/account/subscriptions');
  });
});
