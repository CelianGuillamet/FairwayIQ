export type RevenueCatEvent = {
  id: string | null;
  type: string;
  appUserId: string | null;
  productId: string | null;
  expirationAtMs: number | null;
  eventTimestampMs: number | null;
  cancelReason: string | null;
  transferredFrom: string[];
  transferredTo: string[];
};

export type SubscriptionWrite = {
  userId: string;
  isPremium: boolean;
  plan: string | null;
  expiresAt: string | null;
  eventAt: string | null;
  ignoreOlderExpiry: boolean;
};

export type KnownSubscription = {
  user_id: string;
  is_premium: boolean | null;
  plan: string | null;
  expires_at: string | null;
};

export type EventPlan = {
  writes: SubscriptionWrite[];
  notes: string[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GRANT_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
  'NON_RENEWING_PURCHASE',
]);

// BILLING_ISSUE and SUBSCRIPTION_PAUSED must not revoke access (grace period /
// access until the period end); TEMPORARY_ENTITLEMENT_GRANT carries no
// expiration; TEST is the dashboard's "send test webhook" button.
const IGNORED_EVENT_TYPES = new Set([
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'TEST',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function toUuid(value: string | null | undefined): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function toIso(ms: number | null): string | null {
  if (ms === null) {
    return null;
  }

  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function uniqueUuids(values: string[]): string[] {
  const ids = new Set<string>();

  for (const value of values) {
    const id = toUuid(value);

    if (id) {
      ids.add(id);
    }
  }

  return [...ids];
}

// TRANSFER and TEMPORARY_ENTITLEMENT_GRANT events have no app_user_id, so only
// `type` is mandatory.
export function parseRevenueCatEvent(payload: unknown): RevenueCatEvent | null {
  if (!isObject(payload) || !isObject(payload.event)) {
    return null;
  }

  const raw = payload.event;
  const type = asString(raw.type);

  if (!type) {
    return null;
  }

  return {
    id: asString(raw.id),
    type,
    appUserId: asString(raw.app_user_id),
    productId: asString(raw.product_id),
    expirationAtMs: asFiniteNumber(raw.expiration_at_ms),
    eventTimestampMs: asFiniteNumber(raw.event_timestamp_ms),
    cancelReason: asString(raw.cancel_reason),
    transferredFrom: asStringArray(raw.transferred_from),
    transferredTo: asStringArray(raw.transferred_to),
  };
}

export function collectTransferUserIds(event: RevenueCatEvent): string[] {
  return uniqueUuids([...event.transferredFrom, ...event.transferredTo]);
}

function skip(note: string): EventPlan {
  return { writes: [], notes: [note] };
}

function expiryMs(row: KnownSubscription | undefined): number {
  return row?.expires_at ? new Date(row.expires_at).getTime() : Number.NaN;
}

function planTransfer(event: RevenueCatEvent, knownRows: KnownSubscription[], nowMs: number): EventPlan {
  const eventAt = toIso(event.eventTimestampMs);
  const toIds = uniqueUuids(event.transferredTo);
  const fromIds = uniqueUuids(event.transferredFrom).filter((id) => !toIds.includes(id));
  const knownById = new Map(knownRows.map((row) => [row.user_id.toLowerCase(), row]));
  const notes: string[] = [];
  const writes: SubscriptionWrite[] = [];

  if ([...event.transferredFrom, ...event.transferredTo].some((id) => toUuid(id) === null)) {
    notes.push('transfer_non_uuid_ids_skipped');
  }

  // TRANSFER carries no expiration_at_ms, so the target inherits the expiry we
  // already store for the account(s) the entitlement was taken from.
  let carried: { plan: string | null; expiresAtMs: number } | null = null;

  for (const id of fromIds) {
    const row = knownById.get(id);
    const expiresAtMs = expiryMs(row);

    if (row?.is_premium === true && expiresAtMs > nowMs && (!carried || expiresAtMs > carried.expiresAtMs)) {
      carried = { plan: row.plan, expiresAtMs };
    }
  }

  if (toIds.length > 0 && !carried) {
    notes.push('transfer_no_known_expiration');
  }

  if (carried) {
    for (const id of toIds) {
      const row = knownById.get(id);

      if (row?.is_premium === true && expiryMs(row) >= carried.expiresAtMs) {
        continue;
      }

      writes.push({
        userId: id,
        isPremium: true,
        plan: carried.plan,
        expiresAt: new Date(carried.expiresAtMs).toISOString(),
        eventAt,
        ignoreOlderExpiry: false,
      });
    }
  }

  for (const id of fromIds) {
    writes.push({
      userId: id,
      isPremium: false,
      plan: null,
      expiresAt: null,
      eventAt,
      ignoreOlderExpiry: false,
    });
  }

  return { writes, notes };
}

export function planEvent(
  event: RevenueCatEvent,
  knownRows: KnownSubscription[] = [],
  nowMs: number = Date.now()
): EventPlan {
  if (event.type === 'TRANSFER') {
    return planTransfer(event, knownRows, nowMs);
  }

  if (IGNORED_EVENT_TYPES.has(event.type)) {
    return skip('ignored_event_type');
  }

  const isGrant = GRANT_EVENT_TYPES.has(event.type);
  const isCancellation = event.type === 'CANCELLATION';
  const isExpiration = event.type === 'EXPIRATION';

  if (!isGrant && !isCancellation && !isExpiration) {
    return skip('unhandled_event_type');
  }

  const userId = toUuid(event.appUserId);

  if (!userId) {
    return skip('app_user_id_not_a_uuid');
  }

  const expiresAt = toIso(event.expirationAtMs);
  const write = (isPremium: boolean, ignoreOlderExpiry: boolean): EventPlan => ({
    writes: [
      {
        userId,
        isPremium,
        plan: event.productId,
        expiresAt,
        eventAt: toIso(event.eventTimestampMs),
        ignoreOlderExpiry,
      },
    ],
    notes: [],
  });

  if (isGrant) {
    // Only NON_RENEWING_PURCHASE can legitimately have no expiration (lifetime);
    // for subscriptions a missing one must not turn into unlimited premium.
    if (expiresAt === null && event.type !== 'NON_RENEWING_PURCHASE') {
      return skip('missing_expiration');
    }

    return write(true, false);
  }

  if (isExpiration) {
    return write(false, true);
  }

  if (event.cancelReason === 'CUSTOMER_SUPPORT') {
    return write(false, true);
  }

  // CANCELLATION otherwise means auto-renew was turned off: access lasts until
  // expiration_at_ms and the EXPIRATION event does the revoking.
  if (expiresAt === null) {
    return skip('missing_expiration');
  }

  return write(new Date(expiresAt).getTime() > nowMs, true);
}
