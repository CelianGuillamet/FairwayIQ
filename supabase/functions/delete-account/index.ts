import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function ensureSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
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

async function resolveAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    throw new Error('Authorization manquant.');
  }

  ensureSupabaseConfig();

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error('Utilisateur non authentifié.');
  }

  return data.user;
}

// Deletion order matters: child rows are removed before the rows they
// reference so this stays correct even if a table's FK cascade config
// ever drifts from what's below. debrief_messages has no user_id column,
// so its owned rows are resolved through the user's debrief_sessions first.
async function deleteOwnedData(admin: ReturnType<typeof getAdminClient>, userId: string) {
  const { data: sessions, error: sessionsError } = await admin
    .from('debrief_sessions')
    .select('id')
    .eq('user_id', userId);

  if (sessionsError) {
    throw sessionsError;
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);

  if (sessionIds.length > 0) {
    const { error: messagesError } = await admin
      .from('debrief_messages')
      .delete()
      .in('session_id', sessionIds);

    if (messagesError) {
      throw messagesError;
    }
  }

  const tablesOwnedByUser = [
    'debrief_sessions',
    'round_holes',
    'diagnostics',
    'drill_completions',
    'rounds',
    'subscriptions',
    'profiles',
  ];

  for (const table of tablesOwnedByUser) {
    const { error } = await admin.from(table).delete().eq('user_id', userId);

    if (error) {
      throw error;
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    const user = await resolveAuthenticatedUser(request);
    const admin = getAdminClient();

    await deleteOwnedData(admin, user.id);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      throw deleteUserError;
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return jsonResponse(500, { error: message });
  }
});
