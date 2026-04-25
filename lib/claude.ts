import type { Profile, Round, RoundDraftHole } from '../types';
import type {
  AnalyzeRoundRequest,
  AnalyzeRoundResponse,
  DiagnosticResult,
  PostRoundDebriefRequest,
  PostRoundDebriefResponse,
} from './ai-contract';
import { aggregateScorecard } from './rounds';
import { supabase } from './supabase';

export type { DiagnosticResult } from './ai-contract';

function getScoreDiff(round: Round) {
  return round.total_score - round.par;
}

function getGirPercentage(round: Round) {
  return round.gir != null ? Math.round((round.gir / round.holes) * 100) : null;
}

function getFairwayPercentage(round: Round) {
  return round.fairways_hit != null && round.fairways_total
    ? Math.round((round.fairways_hit / round.fairways_total) * 100)
    : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function getScorecardInsights(scorecard?: RoundDraftHole[]) {
  if (!scorecard || scorecard.length === 0) {
    return null;
  }

  const aggregate = aggregateScorecard(scorecard);
  const threePutts = scorecard.filter((hole) => hole.putts >= 3).length;
  const birdiesOrBetter = scorecard.filter((hole) => hole.score <= hole.par - 1).length;
  const doublesOrWorse = scorecard.filter((hole) => hole.score >= hole.par + 2).length;
  const worstHoles = [...scorecard]
    .sort((left, right) => (right.score - right.par) - (left.score - left.par))
    .slice(0, 3)
    .map((hole) => `trou ${hole.hole_number} ${hole.score - hole.par >= 0 ? '+' : ''}${hole.score - hole.par}`);

  return {
    aggregate,
    threePutts,
    birdiesOrBetter,
    doublesOrWorse,
    worstHoles,
  };
}

async function invokeAiCoach<TRequest extends { action: string }, TResponse>(payload: TRequest) {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'La fonction IA a échoué.');
  }

  if (!data) {
    throw new Error('La fonction IA n’a renvoyé aucune donnée.');
  }

  return data as TResponse;
}

export function buildFallbackDiagnostic(
  round: Round,
  profile: Profile,
  previousRounds: Round[],
  scorecard?: RoundDraftHole[]
): DiagnosticResult {
  const scoreDiff = getScoreDiff(round);
  const girPct = getGirPercentage(round);
  const fairwayPct = getFairwayPercentage(round);
  const puttsPerHole = round.putts != null ? round.putts / round.holes : null;
  const recentAvg = average(previousRounds.map((previousRound) => previousRound.total_score));
  const scorecardInsights = getScorecardInsights(scorecard);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendedCategories: string[] = [];

  if (scoreDiff <= 8) {
    strengths.push('Score global solide par rapport au par du parcours.');
  }
  if (round.penalties != null && round.penalties <= 1) {
    strengths.push('Peu de coups donnés sur pénalités, bonne maîtrise stratégique.');
  }
  if (girPct != null && girPct >= 45) {
    strengths.push('Bon nombre de greens touchés en régulation.');
  }
  if (fairwayPct != null && fairwayPct >= 55) {
    strengths.push('Mises en jeu suffisamment en jeu pour construire le score.');
  }
  if (puttsPerHole != null && puttsPerHole <= 1.9) {
    strengths.push('Putting propre avec peu de trois-putts probables.');
  }
  if (scorecardInsights?.birdiesOrBetter && scorecardInsights.birdiesOrBetter >= 2) {
    strengths.push('Capacité à convertir plusieurs trous en dessous du par.');
  }

  if (puttsPerHole != null && puttsPerHole > 2) {
    weaknesses.push('Le putting coûte trop de coups sur l’ensemble du round.');
    pushUnique(recommendedCategories, 'putting');
  }
  if (girPct != null && girPct < 33) {
    weaknesses.push('Trop peu de greens touchés, le jeu d’approche manque de régularité.');
    pushUnique(recommendedCategories, 'approach');
  }
  if (fairwayPct != null && fairwayPct < 50) {
    weaknesses.push('Les mises en jeu créent trop souvent des positions défensives.');
    pushUnique(recommendedCategories, 'driving');
  }
  if ((round.penalties ?? 0) >= 2) {
    weaknesses.push('Les pénalités pèsent trop lourd dans le score final.');
    pushUnique(recommendedCategories, 'mental');
  }
  if (scoreDiff >= 15) {
    weaknesses.push('Le score final montre un manque de stabilité sur plusieurs compartiments.');
    pushUnique(recommendedCategories, 'short_game');
  }
  if (scorecardInsights?.threePutts && scorecardInsights.threePutts >= 2) {
    weaknesses.push('Trop de trois-putts probables sur la carte de score.');
    pushUnique(recommendedCategories, 'putting');
  }
  if (
    scorecardInsights?.aggregate.back_nine_to_par != null
    && scorecardInsights.aggregate.back_nine_to_par > scorecardInsights.aggregate.front_nine_to_par + 2
  ) {
    weaknesses.push('La fin de parcours se dégrade, signe d’une routine mentale ou stratégique à stabiliser.');
    pushUnique(recommendedCategories, 'mental');
  }

  if (strengths.length === 0) {
    strengths.push('Round complété avec des données exploitables pour progresser rapidement.');
  }

  if (weaknesses.length === 0) {
    weaknesses.push('Pas de faiblesse majeure isolée, le levier principal est la régularité globale.');
  }

  if (recommendedCategories.length === 0) {
    if (profile.goal === 'putting') {
      recommendedCategories.push('putting');
    } else if (profile.goal === 'short_game') {
      recommendedCategories.push('short_game');
    } else {
      recommendedCategories.push('approach');
    }
  }

  const focusAreas = recommendedCategories.slice(0, 2).map((category) => {
    const labels: Record<string, string> = {
      putting: 'putting',
      short_game: 'petit jeu',
      approach: 'jeu de fers',
      driving: 'mise en jeu',
      mental: 'routine mentale',
    };
    return labels[category] ?? category;
  });

  const recentReference = recentAvg != null
    ? `Ta moyenne récente tourne autour de ${recentAvg} coups. `
    : '';

  const scoreTrend =
    recentAvg != null
      ? round.total_score <= recentAvg
        ? 'Ce round est dans le bon sens par rapport à tes dernières parties.'
        : 'Ce round est au-dessus de ta moyenne récente et mérite un plan ciblé.'
      : 'Ce round sert de base de référence pour construire la suite.';

  const scorecardReference =
    scorecardInsights?.worstHoles.length
      ? ` Les trous les plus coûteux ont été ${scorecardInsights.worstHoles.join(', ')}.`
      : '';

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    weekly_plan: `Cette semaine, concentre-toi sur ${focusAreas.join(' puis ')}. Prévois 2 séances courtes de 20 minutes avec un objectif simple: réduire les coups donnés et reproduire une routine stable sur le parcours.`,
    raw_analysis: `${recentReference}Round terminé en ${round.total_score} coups (${scoreDiff >= 0 ? '+' : ''}${scoreDiff}). ${scoreTrend}${scorecardReference}`,
    recommended_categories: recommendedCategories.slice(0, 3),
  };
}

export async function analyzeRound(
  round: Round,
  profile: Profile,
  previousRounds: Round[],
  scorecard?: RoundDraftHole[]
): Promise<DiagnosticResult> {
  const response = await invokeAiCoach<AnalyzeRoundRequest, AnalyzeRoundResponse>({
    action: 'analyze_round',
    round,
    profile,
    previousRounds,
    scorecard,
  });

  return response.result;
}

export async function postRoundDebrief(
  round: Round,
  profile: Profile,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const response = await invokeAiCoach<PostRoundDebriefRequest, PostRoundDebriefResponse>({
    action: 'post_round_debrief',
    round,
    profile,
    userMessage,
    history,
  });

  return response.reply;
}
