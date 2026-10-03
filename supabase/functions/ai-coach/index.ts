import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type Profile = {
  user_id: string;
  display_name: string | null;
  handicap: number;
  play_frequency: string;
  goal: string;
};

type Round = {
  user_id: string;
  total_score: number;
  par: number;
  holes: 9 | 18;
  putts: number | null;
  gir: number | null;
  fairways_hit: number | null;
  fairways_total: number | null;
  penalties: number | null;
  notes: string | null;
};

type RoundDraftHole = {
  hole_number: number;
  par: number;
  score: number;
  putts: number;
  gir: boolean;
  fairway_hit: boolean | null;
  penalty: number;
  completed: boolean;
};

type DiagnosticResult = {
  strengths: string[];
  weaknesses: string[];
  weekly_plan: string;
  raw_analysis: string;
  recommended_categories: string[];
};

type AnalyzeRoundRequest = {
  action: 'analyze_round';
  round: Round;
  profile: Profile;
  previousRounds: Round[];
  scorecard?: RoundDraftHole[];
};

type PostRoundDebriefRequest = {
  action: 'post_round_debrief';
  round: Round;
  profile: Profile;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL_PRIMARY') ?? 'gpt-5.4-mini';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const AI_COACH_DAILY_LIMIT_FREE = readDailyLimit('AI_COACH_DAILY_LIMIT_FREE', 3);
const AI_COACH_DAILY_LIMIT_PREMIUM = readDailyLimit('AI_COACH_DAILY_LIMIT_PREMIUM', 30);
const DIAGNOSTIC_CATEGORIES = ['putting', 'short_game', 'approach', 'driving', 'mental'] as const;
const DIAGNOSTIC_CATEGORY_SET = new Set<string>(DIAGNOSTIC_CATEGORIES);

const diagnosticResultJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
    },
    weekly_plan: {
      type: 'string',
    },
    raw_analysis: {
      type: 'string',
    },
    recommended_categories: {
      type: 'array',
      items: {
        type: 'string',
        enum: DIAGNOSTIC_CATEGORIES,
      },
    },
  },
  required: ['strengths', 'weaknesses', 'weekly_plan', 'raw_analysis', 'recommended_categories'],
} as const;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAnalyzeRoundRequest(value: unknown): value is AnalyzeRoundRequest {
  return isObject(value)
    && value.action === 'analyze_round'
    && isObject(value.round)
    && isObject(value.profile)
    && Array.isArray(value.previousRounds);
}

function isPostRoundDebriefRequest(value: unknown): value is PostRoundDebriefRequest {
  return isObject(value)
    && value.action === 'post_round_debrief'
    && isObject(value.round)
    && isObject(value.profile)
    && typeof value.userMessage === 'string'
    && Array.isArray(value.history);
}

function getScorecardInsights(scorecard?: RoundDraftHole[]) {
  if (!scorecard || scorecard.length === 0) {
    return null;
  }

  const frontNine = scorecard.slice(0, 9);
  const backNine = scorecard.length === 18 ? scorecard.slice(9, 18) : [];
  const birdiesOrBetter = scorecard.filter((hole) => hole.score <= hole.par - 1).length;
  const doublesOrWorse = scorecard.filter((hole) => hole.score >= hole.par + 2).length;
  const threePutts = scorecard.filter((hole) => hole.putts >= 3).length;
  const worstHoles = [...scorecard]
    .sort((left, right) => (right.score - right.par) - (left.score - left.par))
    .slice(0, 3)
    .map((hole) => `trou ${hole.hole_number} ${hole.score - hole.par >= 0 ? '+' : ''}${hole.score - hole.par}`);

  return {
    frontNineScore: frontNine.reduce((sum, hole) => sum + hole.score, 0),
    frontNineToPar: frontNine.reduce((sum, hole) => sum + (hole.score - hole.par), 0),
    backNineScore: backNine.length > 0 ? backNine.reduce((sum, hole) => sum + hole.score, 0) : null,
    backNineToPar: backNine.length > 0 ? backNine.reduce((sum, hole) => sum + (hole.score - hole.par), 0) : null,
    birdiesOrBetter,
    doublesOrWorse,
    threePutts,
    worstHoles,
  };
}

function buildScorecardContext(scorecard?: RoundDraftHole[]) {
  const insights = getScorecardInsights(scorecard);

  if (!insights) {
    return '';
  }

  const details = [
    `- Aller: ${insights.frontNineScore} (${insights.frontNineToPar >= 0 ? '+' : ''}${insights.frontNineToPar})`,
    `- Birdies ou mieux: ${insights.birdiesOrBetter}`,
    `- Doubles ou pire: ${insights.doublesOrWorse}`,
    `- Trois-putts probables: ${insights.threePutts}`,
  ];

  if (insights.backNineScore != null && insights.backNineToPar != null) {
    details.splice(1, 0, `- Retour: ${insights.backNineScore} (${insights.backNineToPar >= 0 ? '+' : ''}${insights.backNineToPar})`);
  }

  if (insights.worstHoles.length > 0) {
    details.push(`- Trous les plus coûteux: ${insights.worstHoles.join(', ')}`);
  }

  return `\nDETAIL TROU PAR TROU:\n${details.join('\n')}`;
}

function buildAnalyzePrompt(payload: AnalyzeRoundRequest) {
  const { round, profile, previousRounds, scorecard } = payload;
  const scoreDiff = round.total_score - round.par;
  const gir = round.gir ?? null;
  const putts = round.putts ?? null;
  const fairways = round.fairways_hit != null && round.fairways_total != null
    ? `${round.fairways_hit}/${round.fairways_total}`
    : null;

  const recentAvg = previousRounds.length > 0
    ? Math.round(previousRounds.reduce((sum, previousRound) => sum + previousRound.total_score, 0) / previousRounds.length)
    : null;

  return `Tu es un coach de golf expert. Analyse ce round et fournis un diagnostic actionnable.

PROFIL DU JOUEUR:
- Handicap: ${profile.handicap}
- Objectif: ${profile.goal}
- Fréquence de jeu: ${profile.play_frequency}
${recentAvg ? `- Score moyen récent: ${recentAvg}` : ''}

ROUND ANALYSÉ:
- Score: ${round.total_score} (${scoreDiff > 0 ? '+' : ''}${scoreDiff} / par ${round.par})
- Putts: ${putts ?? 'non renseigné'}
- GIR (greens en régulation): ${gir != null ? `${gir}/${round.holes}` : 'non renseigné'}
- Fairways: ${fairways ?? 'non renseigné'}
- Pénalités: ${round.penalties ?? 0}
${round.notes ? `- Notes du joueur: ${round.notes}` : ''}${buildScorecardContext(scorecard)}

Réponds UNIQUEMENT en JSON valide, sans markdown ni texte hors JSON, avec cette structure exacte:
{
  "strengths": ["point fort 1", "point fort 2"],
  "weaknesses": ["point faible 1", "point faible 2"],
  "weekly_plan": "Plan d'entraînement pour cette semaine en 2-3 phrases concrètes avec des exercices spécifiques.",
  "raw_analysis": "Analyse détaillée du round en 3-4 phrases, avec les coups gagnants/perdants principaux.",
  "recommended_categories": ["putting", "short_game"]
}
Les catégories disponibles sont: "putting", "short_game", "approach", "driving", "mental". Inclus 1 à 3 catégories selon les lacunes identifiées.`;
}

function buildDebriefInstructions(payload: PostRoundDebriefRequest) {
  const { round, profile } = payload;

  return `Tu es FairwayIQ, un coach de golf expert et bienveillant.
Tu discutes avec ${profile.display_name ?? 'le joueur'} (handicap ${profile.handicap})
après son round: ${round.total_score} coups (par ${round.par}).
Sois concis, positif, et donne des conseils pratiques.
Réponds en français.
Ne donne pas plus de 5 phrases.
Privilégie une seule priorité claire si le round dérive dans plusieurs directions.`;
}

function extractOutputText(responsePayload: Record<string, unknown>) {
  if (typeof responsePayload.output_text === 'string' && responsePayload.output_text.trim().length > 0) {
    return responsePayload.output_text.trim();
  }

  const output = responsePayload.output;

  if (!Array.isArray(output)) {
    throw new Error('Réponse OpenAI sans contenu exploitable.');
  }

  const texts = output.flatMap((item) => {
    if (!isObject(item) || !Array.isArray(item.content)) {
      return [];
    }

    return item.content.flatMap((contentPart) => (
      isObject(contentPart) && typeof contentPart.text === 'string'
        ? [contentPart.text]
        : []
    ));
  });

  if (texts.length === 0) {
    throw new Error('Réponse OpenAI vide.');
  }

  return texts.join('\n').trim();
}

function extractJsonObject(rawText: string) {
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    const jsonCandidate = rawText.match(/\{[\s\S]*\}/)?.[0];

    if (!jsonCandidate) {
      throw new Error('Le modèle n’a pas renvoyé un JSON valide.');
    }

    return JSON.parse(jsonCandidate) as unknown;
  }
}

function parseStringArray(value: unknown, field: keyof DiagnosticResult, maxItems: number) {
  if (!Array.isArray(value)) {
    throw new Error(`Diagnostic IA invalide: ${field} doit être une liste.`);
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, maxItems);

  if (items.length === 0) {
    throw new Error(`Diagnostic IA invalide: ${field} est vide.`);
  }

  return items;
}

function parseDiagnosticResult(value: unknown): DiagnosticResult {
  if (!isObject(value)) {
    throw new Error('Diagnostic IA invalide: objet attendu.');
  }

  const recommendedCategories = [
    ...new Set(
      parseStringArray(value.recommended_categories, 'recommended_categories', 3)
        .filter((category) => DIAGNOSTIC_CATEGORY_SET.has(category))
    ),
  ];

  if (recommendedCategories.length === 0) {
    throw new Error('Diagnostic IA invalide: aucune catégorie recommandée exploitable.');
  }

  if (typeof value.weekly_plan !== 'string' || value.weekly_plan.trim().length === 0) {
    throw new Error('Diagnostic IA invalide: weekly_plan manquant.');
  }

  if (typeof value.raw_analysis !== 'string' || value.raw_analysis.trim().length === 0) {
    throw new Error('Diagnostic IA invalide: raw_analysis manquant.');
  }

  return {
    strengths: parseStringArray(value.strengths, 'strengths', 3),
    weaknesses: parseStringArray(value.weaknesses, 'weaknesses', 3),
    weekly_plan: value.weekly_plan.trim(),
    raw_analysis: value.raw_analysis.trim(),
    recommended_categories: recommendedCategories,
  };
}

async function createOpenAIResponse(input: Record<string, unknown>) {
  if (!OPENAI_API_KEY) {
    throw new Error('La variable OPENAI_API_KEY est absente côté serveur.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      ...input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI a renvoyé ${response.status}: ${errorText}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  return extractOutputText(payload);
}

async function analyzeRound(payload: AnalyzeRoundRequest) {
  const rawText = await createOpenAIResponse({
    input: buildAnalyzePrompt(payload),
    max_output_tokens: 900,
    text: {
      format: {
        type: 'json_schema',
        name: 'fairwayiq_round_diagnostic',
        strict: true,
        schema: diagnosticResultJsonSchema,
      },
    },
  });

  return parseDiagnosticResult(extractJsonObject(rawText));
}

async function postRoundDebrief(payload: PostRoundDebriefRequest) {
  const rawText = await createOpenAIResponse({
    instructions: buildDebriefInstructions(payload),
    input: [
      ...payload.history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: 'user',
        content: payload.userMessage,
      },
    ],
    max_output_tokens: 400,
    text: {
      format: {
        type: 'text',
      },
    },
  });

  return rawText;
}

async function resolveAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    throw new Error('Authorization manquant.');
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Configuration Supabase manquante côté serveur.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

function readDailyLimit(name: string, fallback: number) {
  const rawValue = Deno.env.get(name);

  if (rawValue == null || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? Math.floor(parsedValue) : fallback;
}

function buildDailyLimitMessage(limit: number, isPremium: boolean) {
  const calls = limit > 1 ? `${limit} utilisations` : '1 utilisation';

  return isPremium
    ? `Tu as atteint ta limite quotidienne de ${calls} du coach IA. Réessaie demain.`
    : `Tu as atteint ta limite quotidienne de ${calls} du coach IA. Réessaie demain ou passe à Premium pour en profiter davantage.`;
}

async function checkDailyLimit(userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configuration Supabase manquante côté serveur.');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('is_premium, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error('Impossible de vérifier l’abonnement.');
  }

  const isPremium = subscription?.is_premium === true
    && (subscription.expires_at == null || new Date(subscription.expires_at).getTime() > Date.now());
  const limit = isPremium ? AI_COACH_DAILY_LIMIT_PREMIUM : AI_COACH_DAILY_LIMIT_FREE;

  if (limit <= 0) {
    return null;
  }

  const { data, error } = await admin.rpc('increment_ai_coach_usage', {
    p_user_id: userId,
    p_usage_date: new Date().toISOString().slice(0, 10),
  });

  if (error || typeof data !== 'number') {
    throw new Error('Impossible de vérifier la limite quotidienne.');
  }

  return data > limit ? buildDailyLimitMessage(limit, isPremium) : null;
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

    const dailyLimitMessage = await checkDailyLimit(user.id);

    if (dailyLimitMessage) {
      return jsonResponse(429, { error: dailyLimitMessage });
    }

    const payload = await request.json() as unknown;

    if (isAnalyzeRoundRequest(payload)) {
      if (payload.round.user_id !== user.id || payload.profile.user_id !== user.id) {
        return jsonResponse(403, { error: 'Round ou profil non autorisé.' });
      }

      const result = await analyzeRound(payload);
      return jsonResponse(200, { result });
    }

    if (isPostRoundDebriefRequest(payload)) {
      if (payload.round.user_id !== user.id || payload.profile.user_id !== user.id) {
        return jsonResponse(403, { error: 'Round ou profil non autorisé.' });
      }

      const reply = await postRoundDebrief(payload);
      return jsonResponse(200, { reply });
    }

    return jsonResponse(400, { error: 'Payload invalide.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return jsonResponse(500, { error: message });
  }
});
