import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Round } from '../types';
import { getRoundPerformanceSummary, getScoreToParTrend, normalizeTo18Holes } from './rounds';
import { formatTeeName } from './tee-names';

const NOTABLE_TREND_DELTA = 1.5;
const SPARKLINE_ROUNDS = 8;

export function capitalizeFirst(text: string) {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function formatDecimalFr(value: number, maxDecimals = 1) {
  return String(Number(value.toFixed(maxDecimals))).replace('.', ',');
}

export function formatSignedFr(value: number, maxDecimals = 1) {
  const rounded = Number(value.toFixed(maxDecimals));

  if (rounded > 0) return `+${formatDecimalFr(rounded, maxDecimals)}`;
  if (rounded < 0) return `−${formatDecimalFr(Math.abs(rounded), maxDecimals)}`;
  return '0';
}

export function formatHandicapValue(value: string) {
  return value.replace('.', ',');
}

export function describeScoreToPar(scoreToPar: number) {
  if (scoreToPar > 0) return `${scoreToPar} au-dessus du par`;
  if (scoreToPar < 0) return `${Math.abs(scoreToPar)} sous le par`;
  return 'à égalité avec le par';
}

export function formatHomeDate(date: Date) {
  return capitalizeFirst(format(date, 'EEEE d MMMM', { locale: fr }));
}

export function formatRoundDay(playedAt: string | Date) {
  const date = new Date(playedAt);

  return {
    day: format(date, 'd', { locale: fr }),
    month: format(date, 'MMM', { locale: fr }),
    long: format(date, 'd MMMM yyyy', { locale: fr }),
  };
}

export function formatRoundSubtitle(round: Pick<Round, 'tee_name' | 'holes'>) {
  const tee = round.tee_name?.trim();

  return [tee ? `Départ ${formatTeeName(tee)}` : null, `${round.holes} trous`].filter(Boolean).join(' · ');
}

export type TrendPill = {
  tone: 'good' | 'warn' | 'neutral';
  icon: 'arrow-down' | 'arrow-up' | 'minus' | null;
  label: string;
  accessibilityLabel: string;
};

export function getTrendPill(trend: ReturnType<typeof getScoreToParTrend>): TrendPill {
  if (trend == null) {
    return {
      tone: 'neutral',
      icon: null,
      label: 'Pas encore de tendance',
      accessibilityLabel: 'Pas encore assez de rounds pour isoler une tendance.',
    };
  }

  const { delta, holes } = trend;
  const holesNote = holes === 9 ? ' (9 trous)' : '';

  if (delta >= NOTABLE_TREND_DELTA) {
    const amount = formatDecimalFr(delta);
    return {
      tone: 'good',
      icon: 'arrow-down',
      label: `${amount} coups de mieux${holesNote}`,
      accessibilityLabel: `Tendance : environ ${amount} coups de mieux par rapport au par sur les derniers rounds${holesNote}.`,
    };
  }

  if (delta <= -NOTABLE_TREND_DELTA) {
    const amount = formatDecimalFr(Math.abs(delta));
    return {
      tone: 'warn',
      icon: 'arrow-up',
      label: `${amount} coups de plus${holesNote}`,
      accessibilityLabel: `Tendance : environ ${amount} coups de plus par rapport au par sur les derniers rounds${holesNote}.`,
    };
  }

  return {
    tone: 'neutral',
    icon: 'minus',
    label: 'Tendance stable',
    accessibilityLabel: `Tendance stable sur les derniers rounds${holesNote}.`,
  };
}

export function getSparklineValues(rounds: Round[], limit = SPARKLINE_ROUNDS) {
  return rounds
    .slice(0, limit)
    .reverse()
    .map((round) => normalizeTo18Holes(round.total_score - round.par, round.holes));
}

export function describeSparkline(values: number[]) {
  if (values.length < 2) return '';

  return `Score par rapport au par sur les ${values.length} derniers rounds, de ${formatSignedFr(values[0], 0)} à ${formatSignedFr(values[values.length - 1], 0)}`;
}

export function getSparklineTone(values: number[]): 'good' | 'neutral' {
  if (values.length < 2) return 'neutral';
  return values[values.length - 1] <= values[0] ? 'good' : 'neutral';
}

export type FocusInsight = {
  title: string;
  description: string;
  actionLabel: string;
  actionRoute: '/(tabs)/round' | '/(tabs)/drills';
};

export function getFocusInsight(rounds: Round[]): FocusInsight {
  const latestRound = rounds[0];

  if (!latestRound) {
    return {
      title: 'Construire ta base de jeu',
      description: 'Commence avec un round complet trou par trou pour débloquer un suivi crédible et réellement utile.',
      actionLabel: 'Saisir un round',
      actionRoute: '/(tabs)/round',
    };
  }

  const latestSummary = getRoundPerformanceSummary(latestRound);
  const penalties = latestRound.penalties ?? 0;

  if (penalties >= 2) {
    return {
      title: 'Le score fuit sur les coups donnés',
      description: 'Le levier le plus rentable reste la sécurité : moins de pénalités, moins de doubles, plus de trous joués dans la bonne zone.',
      actionLabel: 'Voir les exercices',
      actionRoute: '/(tabs)/drills',
    };
  }

  if (latestSummary.puttsPerHole != null && latestSummary.puttsPerHole > 2) {
    return {
      title: 'Le putting reste le gain le plus rapide',
      description: 'Quelques putts mieux maîtrisés suffisent souvent à faire tomber immédiatement le score sans toucher au swing complet.',
      actionLabel: 'Voir les exercices',
      actionRoute: '/(tabs)/drills',
    };
  }

  if (latestSummary.girPercentage != null && latestSummary.girPercentage < 33) {
    return {
      title: 'Les approches freinent le scoring',
      description: 'Le taux de GIR reste trop bas. Le meilleur retour sur effort est dans le jeu de fers et les attaques de green.',
      actionLabel: 'Voir les exercices',
      actionRoute: '/(tabs)/drills',
    };
  }

  if (latestSummary.fairwayPercentage != null && latestSummary.fairwayPercentage < 50) {
    return {
      title: 'Les mises en jeu rendent les trous trop défensifs',
      description: 'Un départ mieux contrôlé simplifiera toutes les décisions suivantes, même sans chercher plus de distance.',
      actionLabel: 'Voir les exercices',
      actionRoute: '/(tabs)/drills',
    };
  }

  return {
    title: 'Profil équilibré, cap sur la répétabilité',
    description: 'Tu n’as pas une faiblesse dominante. Le vrai saut de niveau viendra maintenant de la régularité.',
    actionLabel: 'Analyser un round',
    actionRoute: '/(tabs)/round',
  };
}
