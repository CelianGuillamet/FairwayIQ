import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  transferred_from?: string[];
  transferred_to?: string[];
};

type RevenueCatWebhookPayload = {
  api_version?: string;
  event: RevenueCatEvent;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

const PREMIUM_ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'NON_RENEWING_PURCHASE',
]);

const PREMIUM_INACTIVE_EVENT_TYPES = new Set([
  'CANCELLATION',
  'EXPIRATION',
]);

// Events intentionally ignored: BILLING_ISSUE means the subscription is still
// in its grace period (access unchanged until RevenueCat sends EXPIRATION),
// and TEST is RevenueCat's "send test webhook" button in the dashboard.
const PREMIUM_IGNORED_EVENT_TYPES = new Set([
  'BILLING_ISSUE',
  'TEST',
]);

const GENERIC_ERROR_MESSAGE = 'Service temporairement indisponible.';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRevenueCatWebhookPayload(value: unknown): value is RevenueCatWebhookPayload {
  return isObject(value)
    && isObject(value.event)
    && typeof value.event.type === 'string'
    && typeof value.event.app_user_id === 'string';
}

function ensureSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configuration Supabase incomplète côté serveur.');
  }
}

function getAdminClient() {
  ensureSupabaseConfig();

  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
    },
  });
}

function isAuthorized(request: Request) {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    throw new Error('La variable REVENUECAT_WEBHOOK_SECRET est absente côté serveur.');
  }

  const authorization = request.headers.get('Authorization');
  return authorization === REVENUECAT_WEBHOOK_SECRET;
}

function toExpiresAtIso(expirationAtMs: number | null | undefined) {
  if (expirationAtMs == null) {
    return null;
  }

  const date = new Date(expirationAtMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function upsertSubscriptionStatus(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  isPremium: boolean,
  productId: string | null | undefined,
  expiresAt: string | null
) {
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      is_premium: isPremium,
      plan: productId ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw error;
  }
}

async function handleEvent(admin: ReturnType<typeof getAdminClient>, event: RevenueCatEvent) {
  const expiresAt = toExpiresAtIso(event.expiration_at_ms);

  if (PREMIUM_ACTIVE_EVENT_TYPES.has(event.type)) {
    await upsertSubscriptionStatus(admin, event.app_user_id, true, event.product_id, expiresAt);
    return;
  }

  if (PREMIUM_INACTIVE_EVENT_TYPES.has(event.type)) {
    await upsertSubscriptionStatus(admin, event.app_user_id, false, event.product_id, expiresAt);
    return;
  }

  if (event.type === 'TRANSFER') {
    for (const fromUserId of event.transferred_from ?? []) {
      await upsertSubscriptionStatus(admin, fromUserId, false, null, null);
    }

    for (const toUserId of event.transferred_to ?? []) {
      await upsertSubscriptionStatus(admin, toUserId, true, event.product_id, expiresAt);
    }

    return;
  }

  if (!PREMIUM_IGNORED_EVENT_TYPES.has(event.type)) {
    console.warn(`Type d'événement RevenueCat non géré, ignoré: ${event.type}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    if (!isAuthorized(request)) {
      return jsonResponse(401, { error: 'Authorization invalide.' });
    }

    const payload = await request.json().catch(() => null) as unknown;

    if (!isRevenueCatWebhookPayload(payload)) {
      return jsonResponse(400, { error: 'Payload invalide.' });
    }

    const admin = getAdminClient();
    await handleEvent(admin, payload.event);

    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error('revenuecat-webhook: erreur inattendue', error);
    return jsonResponse(500, { error: GENERIC_ERROR_MESSAGE });
  }
});
