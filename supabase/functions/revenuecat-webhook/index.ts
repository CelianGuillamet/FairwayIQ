import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { secretsMatch } from './auth.ts';
import {
  collectTransferUserIds,
  parseRevenueCatEvent,
  planEvent,
  type KnownSubscription,
  type RevenueCatEvent,
  type SubscriptionWrite,
} from './events.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

const GENERIC_ERROR_MESSAGE = 'Service temporairement indisponible.';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
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

async function isAuthorized(request: Request) {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    throw new Error('La variable REVENUECAT_WEBHOOK_SECRET est absente côté serveur.');
  }

  return await secretsMatch(request.headers.get('Authorization'), REVENUECAT_WEBHOOK_SECRET);
}

async function loadKnownSubscriptions(
  admin: ReturnType<typeof getAdminClient>,
  userIds: string[]
): Promise<KnownSubscription[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from('subscriptions')
    .select('user_id, is_premium, plan, expires_at')
    .in('user_id', userIds);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function applyWrite(admin: ReturnType<typeof getAdminClient>, write: SubscriptionWrite) {
  const { data, error } = await admin.rpc('apply_subscription_event', {
    p_user_id: write.userId,
    p_is_premium: write.isPremium,
    p_plan: write.plan,
    p_expires_at: write.expiresAt,
    p_event_at: write.eventAt,
    p_ignore_older_expiry: write.ignoreOlderExpiry,
  });

  if (error) {
    throw error;
  }

  return typeof data === 'string' ? data : 'unknown';
}

async function handleEvent(admin: ReturnType<typeof getAdminClient>, event: RevenueCatEvent) {
  const knownRows = event.type === 'TRANSFER'
    ? await loadKnownSubscriptions(admin, collectTransferUserIds(event))
    : [];
  const plan = planEvent(event, knownRows, Date.now());
  const outcomes: string[] = [];
  let failure: unknown = null;

  // Each write is attempted even if an earlier one fails, so a bad row cannot
  // block the other accounts of a TRANSFER; the first failure still yields a 500
  // so RevenueCat retries (writes are idempotent).
  for (const write of plan.writes) {
    try {
      outcomes.push(await applyWrite(admin, write));
    } catch (error) {
      outcomes.push('error');

      if (failure === null) {
        failure = error;
      }
    }
  }

  console.log('revenuecat-webhook: événement traité', {
    type: event.type,
    id: event.id,
    notes: plan.notes,
    outcomes,
  });

  if (failure !== null) {
    throw failure;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    if (!(await isAuthorized(request))) {
      return jsonResponse(401, { error: 'Authorization invalide.' });
    }

    const payload = await request.json().catch(() => null) as unknown;
    const event = parseRevenueCatEvent(payload);

    if (!event) {
      return jsonResponse(400, { error: 'Payload invalide.' });
    }

    await handleEvent(getAdminClient(), event);

    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error('revenuecat-webhook: erreur inattendue', error);
    return jsonResponse(500, { error: GENERIC_ERROR_MESSAGE });
  }
});
