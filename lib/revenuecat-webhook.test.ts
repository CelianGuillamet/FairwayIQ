import { secretsMatch } from '../supabase/functions/revenuecat-webhook/auth';
import {
  collectTransferUserIds,
  parseRevenueCatEvent,
  planEvent,
  toUuid,
  type KnownSubscription,
  type RevenueCatEvent,
} from '../supabase/functions/revenuecat-webhook/events';

const NOW = new Date('2026-10-04T12:00:00.000Z').getTime();
const USER_A = '3f6c1d0e-0000-4000-8000-000000000001';
const USER_B = '3f6c1d0e-0000-4000-8000-000000000002';
const USER_C = '3f6c1d0e-0000-4000-8000-000000000003';
const FUTURE_MS = new Date('2026-11-04T12:00:00.000Z').getTime();
const FUTURE_ISO = '2026-11-04T12:00:00.000Z';
const PAST_MS = new Date('2026-09-04T12:00:00.000Z').getTime();
const EVENT_MS = new Date('2026-10-04T11:00:00.000Z').getTime();
const EVENT_ISO = '2026-10-04T11:00:00.000Z';

function event(overrides: Partial<RevenueCatEvent>): RevenueCatEvent {
  return {
    id: 'evt-1',
    type: 'RENEWAL',
    appUserId: USER_A,
    productId: 'fairwayiq_annual',
    expirationAtMs: FUTURE_MS,
    eventTimestampMs: EVENT_MS,
    cancelReason: null,
    transferredFrom: [],
    transferredTo: [],
    ...overrides,
  };
}

function row(overrides: Partial<KnownSubscription>): KnownSubscription {
  return {
    user_id: USER_A,
    is_premium: true,
    plan: 'fairwayiq_annual',
    expires_at: FUTURE_ISO,
    ...overrides,
  };
}

describe('toUuid', () => {
  it('accepts a canonical uuid and lowercases it', () => {
    expect(toUuid(USER_A)).toBe(USER_A);
    expect(toUuid(USER_A.toUpperCase())).toBe(USER_A);
  });

  it('rejects RevenueCat anonymous ids and other non-uuid values', () => {
    expect(toUuid('$RCAnonymousID:0123456789abcdef0123456789abcdef')).toBeNull();
    expect(toUuid('not-a-uuid')).toBeNull();
    expect(toUuid(`${USER_A} `)).toBeNull();
    expect(toUuid(`${USER_A}0`)).toBeNull();
    expect(toUuid('')).toBeNull();
    expect(toUuid(null)).toBeNull();
    expect(toUuid(undefined)).toBeNull();
  });
});

describe('parseRevenueCatEvent', () => {
  it('rejects payloads without an event type', () => {
    expect(parseRevenueCatEvent(null)).toBeNull();
    expect(parseRevenueCatEvent('x')).toBeNull();
    expect(parseRevenueCatEvent({})).toBeNull();
    expect(parseRevenueCatEvent({ event: null })).toBeNull();
    expect(parseRevenueCatEvent({ event: { app_user_id: USER_A } })).toBeNull();
    expect(parseRevenueCatEvent({ event: { type: 42 } })).toBeNull();
  });

  it('accepts TRANSFER events, which have no app_user_id', () => {
    const parsed = parseRevenueCatEvent({
      event: {
        type: 'TRANSFER',
        id: 'evt-2',
        event_timestamp_ms: EVENT_MS,
        transferred_from: [USER_A, 7],
        transferred_to: [USER_B],
      },
    });

    expect(parsed).toMatchObject({
      type: 'TRANSFER',
      appUserId: null,
      expirationAtMs: null,
      eventTimestampMs: EVENT_MS,
      transferredFrom: [USER_A],
      transferredTo: [USER_B],
    });
  });

  it('keeps only well-typed fields', () => {
    const parsed = parseRevenueCatEvent({
      event: {
        type: 'CANCELLATION',
        app_user_id: USER_A,
        product_id: 'p',
        expiration_at_ms: '123',
        event_timestamp_ms: Number.NaN,
        cancel_reason: 'UNSUBSCRIBE',
        transferred_from: 'nope',
      },
    });

    expect(parsed).toMatchObject({
      appUserId: USER_A,
      productId: 'p',
      expirationAtMs: null,
      eventTimestampMs: null,
      cancelReason: 'UNSUBSCRIBE',
      transferredFrom: [],
      transferredTo: [],
    });
  });
});

describe('planEvent: granting events', () => {
  it.each([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'SUBSCRIPTION_EXTENDED',
    'REFUND_REVERSED',
  ])('%s grants premium until the event expiration', (type) => {
    expect(planEvent(event({ type }), [], NOW)).toEqual({
      writes: [
        {
          userId: USER_A,
          isPremium: true,
          plan: 'fairwayiq_annual',
          expiresAt: FUTURE_ISO,
          eventAt: EVENT_ISO,
          ignoreOlderExpiry: false,
        },
      ],
      notes: [],
    });
  });

  it('does not grant a subscription event that has no expiration', () => {
    const plan = planEvent(event({ type: 'INITIAL_PURCHASE', expirationAtMs: null }), [], NOW);

    expect(plan.writes).toEqual([]);
    expect(plan.notes).toEqual(['missing_expiration']);
  });

  it('allows a non-renewing purchase without expiration', () => {
    const plan = planEvent(event({ type: 'NON_RENEWING_PURCHASE', expirationAtMs: null }), [], NOW);

    expect(plan.writes).toMatchObject([{ userId: USER_A, isPremium: true, expiresAt: null }]);
  });

  it('lowercases the user id and tolerates a missing event timestamp', () => {
    const plan = planEvent(event({ appUserId: USER_A.toUpperCase(), eventTimestampMs: null }), [], NOW);

    expect(plan.writes).toMatchObject([{ userId: USER_A, eventAt: null }]);
  });
});

describe('planEvent: CANCELLATION', () => {
  it.each([
    'UNSUBSCRIBE',
    'BILLING_ERROR',
    'DEVELOPER_INITIATED',
    'PRICE_INCREASE',
    'UNKNOWN',
    null,
  ])('keeps access until expiration for cancel_reason %s', (cancelReason) => {
    const plan = planEvent(event({ type: 'CANCELLATION', cancelReason }), [], NOW);

    expect(plan.writes).toEqual([
      {
        userId: USER_A,
        isPremium: true,
        plan: 'fairwayiq_annual',
        expiresAt: FUTURE_ISO,
        eventAt: EVENT_ISO,
        ignoreOlderExpiry: true,
      },
    ]);
  });

  it('revokes immediately for a customer-support refund', () => {
    const plan = planEvent(event({ type: 'CANCELLATION', cancelReason: 'CUSTOMER_SUPPORT' }), [], NOW);

    expect(plan.writes).toMatchObject([{ userId: USER_A, isPremium: false, ignoreOlderExpiry: true }]);
  });

  it('does not keep access once the cancelled period is already over', () => {
    const plan = planEvent(event({ type: 'CANCELLATION', cancelReason: 'UNSUBSCRIBE', expirationAtMs: PAST_MS }), [], NOW);

    expect(plan.writes).toMatchObject([{ isPremium: false }]);
  });

  it('does nothing for a non-refund cancellation without expiration', () => {
    const plan = planEvent(event({ type: 'CANCELLATION', cancelReason: 'UNSUBSCRIBE', expirationAtMs: null }), [], NOW);

    expect(plan.writes).toEqual([]);
    expect(plan.notes).toEqual(['missing_expiration']);
  });
});

describe('planEvent: EXPIRATION', () => {
  it('revokes premium and guards against an older expiry replacing a newer one', () => {
    const plan = planEvent(event({ type: 'EXPIRATION', expirationAtMs: PAST_MS }), [], NOW);

    expect(plan.writes).toEqual([
      {
        userId: USER_A,
        isPremium: false,
        plan: 'fairwayiq_annual',
        expiresAt: new Date(PAST_MS).toISOString(),
        eventAt: EVENT_ISO,
        ignoreOlderExpiry: true,
      },
    ]);
  });
});

describe('planEvent: non-attributable and informational events', () => {
  it.each([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'CANCELLATION',
    'EXPIRATION',
  ])('%s with an anonymous app_user_id is dropped without error', (type) => {
    const plan = planEvent(event({ type, appUserId: '$RCAnonymousID:0123456789abcdef0123456789abcdef' }), [], NOW);

    expect(plan.writes).toEqual([]);
    expect(plan.notes).toEqual(['app_user_id_not_a_uuid']);
  });

  it('drops an event without app_user_id', () => {
    expect(planEvent(event({ appUserId: null }), [], NOW).writes).toEqual([]);
  });

  it.each(['BILLING_ISSUE', 'SUBSCRIPTION_PAUSED', 'TEMPORARY_ENTITLEMENT_GRANT', 'TEST'])(
    '%s never changes the subscription',
    (type) => {
      const plan = planEvent(event({ type }), [], NOW);

      expect(plan.writes).toEqual([]);
      expect(plan.notes).toEqual(['ignored_event_type']);
    }
  );

  it('ignores unknown event types', () => {
    const plan = planEvent(event({ type: 'SOMETHING_NEW' }), [], NOW);

    expect(plan.writes).toEqual([]);
    expect(plan.notes).toEqual(['unhandled_event_type']);
  });
});

describe('planEvent: TRANSFER', () => {
  it('moves the known expiry to the target and revokes the source, target first', () => {
    const plan = planEvent(
      event({ type: 'TRANSFER', appUserId: null, expirationAtMs: null, productId: null, transferredFrom: [USER_A], transferredTo: [USER_B] }),
      [row({ user_id: USER_A, plan: 'fairwayiq_monthly' })],
      NOW
    );

    expect(plan.writes).toEqual([
      {
        userId: USER_B,
        isPremium: true,
        plan: 'fairwayiq_monthly',
        expiresAt: FUTURE_ISO,
        eventAt: EVENT_ISO,
        ignoreOlderExpiry: false,
      },
      {
        userId: USER_A,
        isPremium: false,
        plan: null,
        expiresAt: null,
        eventAt: EVENT_ISO,
        ignoreOlderExpiry: false,
      },
    ]);
  });

  it('never grants premium without a known expiration', () => {
    const anonymousSource = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: ['$RCAnonymousID:abc'], transferredTo: [USER_B] }),
      [],
      NOW
    );
    const expiredSource = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: [USER_A], transferredTo: [USER_B] }),
      [row({ user_id: USER_A, expires_at: new Date(PAST_MS).toISOString() })],
      NOW
    );
    const unlimitedSource = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: [USER_A], transferredTo: [USER_B] }),
      [row({ user_id: USER_A, expires_at: null })],
      NOW
    );

    expect(anonymousSource.writes).toEqual([]);
    expect(anonymousSource.notes).toEqual(['transfer_non_uuid_ids_skipped', 'transfer_no_known_expiration']);
    expect(expiredSource.writes.filter((write) => write.isPremium)).toEqual([]);
    expect(unlimitedSource.writes.filter((write) => write.isPremium)).toEqual([]);
  });

  it('still grants the target when another id in the event is not a uuid', () => {
    const plan = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: ['$RCAnonymousID:abc', USER_A], transferredTo: ['garbage', USER_B] }),
      [row({ user_id: USER_A })],
      NOW
    );

    expect(plan.writes.map((write) => [write.userId, write.isPremium])).toEqual([
      [USER_B, true],
      [USER_A, false],
    ]);
    expect(plan.notes).toEqual(['transfer_non_uuid_ids_skipped']);
  });

  it('inherits the latest expiry when several sources are transferred', () => {
    const later = new Date('2027-01-01T00:00:00.000Z');
    const plan = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: [USER_A, USER_C], transferredTo: [USER_B] }),
      [row({ user_id: USER_A }), row({ user_id: USER_C, plan: 'fairwayiq_monthly', expires_at: later.toISOString() })],
      NOW
    );

    expect(plan.writes[0]).toMatchObject({ userId: USER_B, plan: 'fairwayiq_monthly', expiresAt: later.toISOString() });
  });

  it('does not shorten a target that already has a longer subscription', () => {
    const plan = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: [USER_A], transferredTo: [USER_B] }),
      [row({ user_id: USER_A }), row({ user_id: USER_B, expires_at: '2027-01-01T00:00:00.000Z' })],
      NOW
    );

    expect(plan.writes.map((write) => [write.userId, write.isPremium])).toEqual([[USER_A, false]]);
  });

  it('does not revoke an account that is also a target', () => {
    const plan = planEvent(
      event({ type: 'TRANSFER', appUserId: null, transferredFrom: [USER_A, USER_B], transferredTo: [USER_B] }),
      [row({ user_id: USER_A })],
      NOW
    );

    expect(plan.writes.map((write) => [write.userId, write.isPremium])).toEqual([
      [USER_B, true],
      [USER_A, false],
    ]);
  });

  it('collects the uuids to look up', () => {
    expect(
      collectTransferUserIds(
        event({ type: 'TRANSFER', transferredFrom: [USER_A, 'anon', USER_B], transferredTo: [USER_B.toUpperCase(), USER_C] })
      ).sort()
    ).toEqual([USER_A, USER_B, USER_C]);
  });
});

describe('secretsMatch', () => {
  it('matches only the exact secret', async () => {
    await expect(secretsMatch('s3cret-value', 's3cret-value')).resolves.toBe(true);
    await expect(secretsMatch('s3cret-valuf', 's3cret-value')).resolves.toBe(false);
    await expect(secretsMatch('s3cret', 's3cret-value')).resolves.toBe(false);
    await expect(secretsMatch('s3cret-value-and-more', 's3cret-value')).resolves.toBe(false);
    await expect(secretsMatch('Bearer s3cret-value', 's3cret-value')).resolves.toBe(false);
  });

  it('rejects a missing or empty header', async () => {
    await expect(secretsMatch(null, 's3cret-value')).resolves.toBe(false);
    await expect(secretsMatch('', 's3cret-value')).resolves.toBe(false);
  });
});
