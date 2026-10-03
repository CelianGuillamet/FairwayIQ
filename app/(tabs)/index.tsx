import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../../stores/auth';
import { useDrillsStore } from '../../stores/drills';
import { useRoundsStore } from '../../stores/rounds';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import { ChartCard, LineChart } from '../../components/ui/LineChart';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppBadge } from '../../components/ui/AppBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Diagnostic, Drill, Round } from '../../types';
import { fetchLatestDiagnostic } from '../../lib/diagnostics';
import {
  DRILL_CATEGORY_LABELS,
  DRILL_DIFFICULTY_LABELS,
  getDailyFocusDrill,
  isDrillDoneToday,
} from '../../lib/drill-library';
import {
  getAveragePenaltyCount,
  getBestRound,
  getEstimatedHandicapIndex,
  getRoundPerformanceSummary,
} from '../../lib/rounds';

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function getFocusInsight(rounds: Round[]) {
  const latestRound = rounds[0];

  if (!latestRound) {
    return {
      title: 'Construire ta base de jeu',
      description: 'Commence avec un round complet trou par trou pour débloquer un suivi crédible et réellement utile.',
      actionLabel: 'Saisir un round',
      actionRoute: '/(tabs)/round' as const,
    };
  }

  const latestSummary = getRoundPerformanceSummary(latestRound);
  const penalties = latestRound.penalties ?? 0;

  if (penalties >= 2) {
    return {
      title: 'Le score fuit sur les coups donnés',
      description: 'Le levier le plus rentable reste la sécurité: moins de pénalités, moins de doubles, plus de trous joués dans la bonne zone.',
      actionLabel: 'Voir les drills',
      actionRoute: '/(tabs)/drills' as const,
    };
  }

  if (latestSummary.puttsPerHole != null && latestSummary.puttsPerHole > 2) {
    return {
      title: 'Le putting reste le gain le plus rapide',
      description: 'Quelques putts mieux maîtrisés suffisent souvent à faire tomber immédiatement le score sans toucher au swing complet.',
      actionLabel: 'Voir les drills',
      actionRoute: '/(tabs)/drills' as const,
    };
  }

  if (latestSummary.girPercentage != null && latestSummary.girPercentage < 33) {
    return {
      title: 'Les approches freinent le scoring',
      description: 'Le taux de GIR reste trop bas. Le meilleur retour sur effort est dans le jeu de fers et les attaques de green.',
      actionLabel: 'Voir les drills',
      actionRoute: '/(tabs)/drills' as const,
    };
  }

  if (latestSummary.fairwayPercentage != null && latestSummary.fairwayPercentage < 50) {
    return {
      title: 'Les mises en jeu rendent les trous trop défensifs',
      description: 'Un départ mieux contrôlé simplifiera toutes les décisions suivantes, même sans chercher plus de distance.',
      actionLabel: 'Voir les drills',
      actionRoute: '/(tabs)/drills' as const,
    };
  }

  return {
    title: 'Profil équilibré, cap sur la répétabilité',
    description: 'Tu n’as pas une faiblesse dominante. Le vrai saut de niveau viendra maintenant de la régularité.',
    actionLabel: 'Analyser un round',
    actionRoute: '/(tabs)/round' as const,
  };
}

function getTrendLabel(rounds: Round[]) {
  if (rounds.length < 4) {
    return 'Pas encore assez de rounds pour isoler une tendance robuste.';
  }

  const recent = rounds.slice(0, 3);
  const previous = rounds.slice(3, 6);

  if (previous.length === 0) {
    return 'Pas encore assez de rounds pour isoler une tendance robuste.';
  }

  const recentAverage = average(recent.map((round) => round.total_score - round.par));
  const previousAverage = average(previous.map((round) => round.total_score - round.par));

  if (recentAverage == null || previousAverage == null) {
    return 'Pas encore assez de rounds pour isoler une tendance robuste.';
  }

  const delta = Math.round((previousAverage - recentAverage) * 10) / 10;

  if (delta >= 1.5) {
    return `Tu gagnes environ ${delta} coups vs par sur les derniers rounds.`;
  }

  if (delta <= -1.5) {
    return `Le niveau glisse d’environ ${Math.abs(delta)} coups vs par. Reviens aux fondamentaux.`;
  }

  return 'La courbe est stable. Le prochain gain viendra d’un seul compartiment mieux ciblé.';
}

export default function DashboardScreen() {
  const { profile, user } = useAuthStore();
  const { rounds, fetchRounds, fetchMoreRounds, loading, loadingMore, hasMore, initialized, error } = useRoundsStore();
  const { completions, fetchCompletions, markDone, setRecommendedCategories } = useDrillsStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [latestDiagnostic, setLatestDiagnostic] = useState<Diagnostic | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [markingFocusDone, setMarkingFocusDone] = useState(false);
  const [focusCompletionError, setFocusCompletionError] = useState<string | null>(null);
  const [visibleRoundsCount, setVisibleRoundsCount] = useState(6);

  useEffect(() => {
    if (!initialized) {
      void fetchRounds();
    }
  }, [fetchRounds, initialized]);

  useEffect(() => {
    void fetchCompletions().catch((currentError: any) => {
      console.warn('[drills] Completion fetch failed', currentError?.message ?? currentError);
    });
  }, [fetchCompletions]);

  const loadLatestDiagnostic = useCallback(async () => {
    if (rounds.length === 0) {
      setLatestDiagnostic(null);
      setDiagnosticError(null);
      return;
    }

    setDiagnosticLoading(true);
    setDiagnosticError(null);

    try {
      const diagnostic = await fetchLatestDiagnostic();
      setLatestDiagnostic(diagnostic);
      setRecommendedCategories(diagnostic?.recommended_categories ?? []);
    } catch (currentError: any) {
      setDiagnosticError(currentError?.message ?? 'Impossible de charger le dernier diagnostic.');
    } finally {
      setDiagnosticLoading(false);
    }
  }, [rounds.length, setRecommendedCategories]);

  useEffect(() => {
    if (initialized) {
      void loadLatestDiagnostic();
    }
  }, [initialized, loadLatestDiagnostic]);

  const chartWidth = width - 32;
  const latestRound = rounds[0] ?? null;
  const focusInsight = getFocusInsight(rounds);
  const estimatedHandicapIndex = getEstimatedHandicapIndex(rounds);
  const bestRound = getBestRound(rounds);
  const averagePenaltyCount = getAveragePenaltyCount(rounds);
  const trendLabel = getTrendLabel(rounds);

  const scoreRounds = useMemo(() => rounds.slice(0, 10).reverse(), [rounds]);
  const scoreData = scoreRounds.map((round) => round.total_score - round.par);
  const scoreLabels = scoreRounds.map((round) => format(new Date(round.played_at), 'dd/MM'));

  const puttRounds = scoreRounds.filter((round) => round.putts != null);
  const puttsData = puttRounds.map((round) => round.putts as number);
  const puttsLabels = puttRounds.map((round) => format(new Date(round.played_at), 'dd/MM'));

  const girRounds = scoreRounds.filter((round) => round.gir != null);
  const girData = girRounds.map((round) => Math.round(((round.gir as number) / round.holes) * 100));
  const girLabels = girRounds.map((round) => format(new Date(round.played_at), 'dd/MM'));

  const averageScoreToPar = average(rounds.map((round) => round.total_score - round.par));
  const averagePutts = average(rounds.filter((round) => round.putts != null).map((round) => round.putts as number));
  const averageGirPct = average(
    rounds.filter((round) => round.gir != null).map((round) => Math.round(((round.gir as number) / round.holes) * 100))
  );
  const averageFairwayPct = average(
    rounds
      .filter((round) => round.fairways_hit != null && round.fairways_total != null && (round.fairways_total ?? 0) > 0)
      .map((round) => Math.round(((round.fairways_hit as number) / (round.fairways_total as number)) * 100))
  );
  const recentRounds = rounds.slice(0, visibleRoundsCount);
  const canShowMoreRounds = visibleRoundsCount < rounds.length || hasMore;

  const handleShowMoreRounds = async () => {
    if (visibleRoundsCount < rounds.length) {
      setVisibleRoundsCount((count) => count + 6);
      return;
    }

    if (hasMore) {
      await fetchMoreRounds();
      setVisibleRoundsCount((count) => count + 6);
    }
  };
  const focusDrill = useMemo(() => (
    latestDiagnostic
      ? getDailyFocusDrill({
          categories: latestDiagnostic.recommended_categories ?? [],
          completions,
        })
      : null
  ), [completions, latestDiagnostic]);
  const focusDrillDoneToday = focusDrill ? isDrillDoneToday(focusDrill.id, completions) : false;

  const handleMarkFocusDrillDone = async () => {
    if (!user || !focusDrill || focusDrillDoneToday || markingFocusDone) {
      return;
    }

    setMarkingFocusDone(true);
    setFocusCompletionError(null);

    try {
      await markDone(focusDrill.id, user.id);
    } catch (currentError: any) {
      setFocusCompletionError(currentError?.message ?? 'Impossible de valider ce drill.');
    } finally {
      setMarkingFocusDone(false);
    }
  };

  if (loading && !initialized) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <ActivityIndicator size="large" color={Colors.text} />
        <Text style={styles.loadingText}>Chargement de ton cockpit de jeu...</Text>
      </View>
    );
  }

  if (error && rounds.length === 0) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <Text style={styles.errorTitle}>Impossible de charger tes rounds</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <AppButton label="Réessayer" onPress={() => void fetchRounds()} style={styles.retryButton} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <PageHeader
          eyebrow="Cockpit joueur"
          title={`Bonjour, ${profile?.display_name ?? 'Joueur'}`}
          subtitle={
            latestRound
              ? `Dernier round: ${latestRound.total_score} coups (${latestRound.total_score - latestRound.par > 0 ? '+' : ''}${latestRound.total_score - latestRound.par})`
              : `Handicap déclaré ${profile?.handicap ?? '--'}`
          }
          trailing={(
            <TouchableOpacity onPress={() => router.push('/paywall' as any)}>
              <AppBadge label="Premium" tone="warning" />
            </TouchableOpacity>
          )}
        />

        <AppCard accent="highlight" style={styles.heroCard}>
          <AppBadge label="Cap du moment" tone="primary" style={styles.heroBadge} />
          <Text style={styles.heroTitle}>{focusInsight.title}</Text>
          <Text style={styles.heroDescription}>{focusInsight.description}</Text>
          <Text style={styles.heroTrend}>{trendLabel}</Text>
          <AppButton
            label={focusInsight.actionLabel}
            onPress={() => router.push(focusInsight.actionRoute)}
            style={styles.heroAction}
          />
        </AppCard>

        {rounds.length === 0 ? (
          <AppCard accent="soft" style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun round enregistré</Text>
            <Text style={styles.emptySubtitle}>
              Commence par un round complet. Tu obtiendras un suivi crédible, une vraie lecture des tendances et un diagnostic plus utile.
            </Text>
            <AppButton label="Enregistrer un round" onPress={() => router.push('/(tabs)/round')} style={styles.emptyButton} />
          </AppCard>
        ) : (
          <>
            <PracticeFocusCard
              loading={diagnosticLoading}
              error={diagnosticError}
              diagnostic={latestDiagnostic}
              drill={focusDrill}
              doneToday={focusDrillDoneToday}
              markingDone={markingFocusDone}
              completionError={focusCompletionError}
              onRetry={() => void loadLatestDiagnostic()}
              onMarkDone={() => void handleMarkFocusDrillDone()}
              onOpenDrills={() => router.push('/(tabs)/drills')}
              onOpenDiagnostic={() => {
                if (latestDiagnostic?.round_id) {
                  router.push({ pathname: '/diagnostic', params: { roundId: latestDiagnostic.round_id } });
                } else {
                  router.push('/(tabs)/round');
                }
              }}
            />

            <View style={styles.statsGrid}>
              <PrimaryStatCard label="Handicap Index estimé" value={estimatedHandicapIndex != null ? estimatedHandicapIndex.toString() : '--'} helper="méthode WHS, non officiel" />
              <PrimaryStatCard label="Moyenne vs par" value={averageScoreToPar != null ? `${averageScoreToPar > 0 ? '+' : ''}${averageScoreToPar}` : '--'} helper="sur les rounds" />
              <PrimaryStatCard label="Meilleur round" value={bestRound ? `${bestRound.total_score}` : '--'} helper={bestRound ? `${bestRound.total_score - bestRound.par > 0 ? '+' : ''}${bestRound.total_score - bestRound.par}` : '—'} />
              <PrimaryStatCard label="Pénalités moy." value={averagePenaltyCount != null ? averagePenaltyCount.toString() : '--'} helper="par round" />
            </View>

            <View style={styles.secondaryStatsRow}>
              <MiniStatCard label="Putts" value={averagePutts != null ? averagePutts.toString() : '--'} />
              <MiniStatCard label="GIR" value={averageGirPct != null ? `${averageGirPct}%` : '--'} />
              <MiniStatCard label="Fairways" value={averageFairwayPct != null ? `${averageFairwayPct}%` : '--'} />
            </View>

            {scoreData.length >= 2 ? (
              <ChartCard title="Évolution du score vs par">
                <LineChart data={scoreData} labels={scoreLabels} width={chartWidth} color={Colors.accentBlue} />
                <Text style={styles.chartHint}>Plus bas est meilleur. Lecture sur les 10 derniers rounds.</Text>
              </ChartCard>
            ) : null}

            {puttsData.length >= 2 ? (
              <ChartCard title="Évolution du putting">
                <LineChart data={puttsData} labels={puttsLabels} width={chartWidth} color={Colors.warning} />
                <Text style={styles.chartHint}>Plus bas est meilleur.</Text>
              </ChartCard>
            ) : null}

            {girData.length >= 2 ? (
              <ChartCard title="Greens en régulation">
                <LineChart data={girData} labels={girLabels} width={chartWidth} color={Colors.accentBlue} />
                <Text style={styles.chartHint}>Pourcentage de greens touchés.</Text>
              </ChartCard>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Derniers rounds</Text>
              <TouchableOpacity onPress={() => void fetchRounds()}>
                <Text style={styles.sectionAction}>Actualiser</Text>
              </TouchableOpacity>
            </View>

            {recentRounds.map((round) => {
              const scoreToPar = round.total_score - round.par;
              const roundSummary = getRoundPerformanceSummary(round);

              return (
                <TouchableOpacity
                  key={round.id}
                  onPress={() => router.push({ pathname: '/round-detail', params: { roundId: round.id } } as any)}
                >
                  <AppCard style={styles.roundCard}>
                    <View style={styles.roundLeft}>
                      <Text style={styles.roundScore}>{round.total_score}</Text>
                      <Text style={styles.roundPar}>{round.holes} trous</Text>
                    </View>
                    <View style={styles.roundCenter}>
                      <Text style={styles.roundCourse}>{round.course_name ?? 'Parcours non précisé'}</Text>
                      <Text style={styles.roundDate}>
                        {format(new Date(round.played_at), 'dd MMM yyyy', { locale: fr })}
                      </Text>
                      <Text style={styles.roundStats}>
                        {round.putts != null ? `${round.putts} putts` : 'Putts non saisis'}
                        {roundSummary.girPercentage != null ? ` · ${roundSummary.girPercentage}% GIR` : ''}
                        {round.penalties != null ? ` · ${round.penalties} pen.` : ''}
                      </Text>
                    </View>
                    <View style={styles.roundRight}>
                      <Text style={[styles.roundDiffText, scoreToPar <= 0 ? styles.good : styles.bad]}>
                        {scoreToPar > 0 ? '+' : ''}
                        {scoreToPar}
                      </Text>
                      <Text style={styles.roundArrow}>›</Text>
                    </View>
                  </AppCard>
                </TouchableOpacity>
              );
            })}

            {canShowMoreRounds ? (
              <AppButton
                label={loadingMore ? 'Chargement...' : 'Voir plus de rounds'}
                variant="secondary"
                loading={loadingMore}
                onPress={() => void handleShowMoreRounds()}
                style={styles.showMoreButton}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PrimaryStatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <AppCard style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </AppCard>
  );
}

function PracticeFocusCard({
  loading,
  error,
  diagnostic,
  drill,
  doneToday,
  markingDone,
  completionError,
  onRetry,
  onMarkDone,
  onOpenDrills,
  onOpenDiagnostic,
}: {
  loading: boolean;
  error: string | null;
  diagnostic: Diagnostic | null;
  drill: Drill | null;
  doneToday: boolean;
  markingDone: boolean;
  completionError: string | null;
  onRetry: () => void;
  onMarkDone: () => void;
  onOpenDrills: () => void;
  onOpenDiagnostic: () => void;
}) {
  if (loading) {
    return (
      <AppCard style={styles.practiceCard}>
        <View style={styles.practiceLoadingRow}>
          <ActivityIndicator color={Colors.text} />
          <Text style={styles.practiceLoadingText}>Préparation de ton focus du jour...</Text>
        </View>
      </AppCard>
    );
  }

  if (error) {
    return (
      <AppCard style={styles.practiceCard}>
        <Text style={styles.practiceEyebrow}>Focus du jour</Text>
        <Text style={styles.practiceTitle}>Impossible de charger le plan</Text>
        <Text style={styles.practiceText}>{error}</Text>
        <AppButton label="Réessayer" variant="secondary" onPress={onRetry} style={styles.practicePrimaryAction} />
      </AppCard>
    );
  }

  if (!diagnostic) {
    return (
      <AppCard style={styles.practiceCard}>
        <Text style={styles.practiceEyebrow}>Focus du jour</Text>
        <Text style={styles.practiceTitle}>Aucun diagnostic exploitable</Text>
        <Text style={styles.practiceText}>
          Enregistre ou relance un diagnostic pour transformer ton prochain round en plan d'entraînement concret.
        </Text>
        <AppButton label="Analyser un round" variant="secondary" onPress={onOpenDiagnostic} style={styles.practicePrimaryAction} />
      </AppCard>
    );
  }

  if (!drill) {
    return (
      <AppCard style={styles.practiceCard}>
        <Text style={styles.practiceEyebrow}>Focus du jour</Text>
        <Text style={styles.practiceTitle}>Plan à clarifier</Text>
        <Text style={styles.practiceText}>{diagnostic.weekly_plan}</Text>
        <AppButton label="Voir le diagnostic" variant="secondary" onPress={onOpenDiagnostic} style={styles.practicePrimaryAction} />
      </AppCard>
    );
  }

  const categoryLabel = DRILL_CATEGORY_LABELS[drill.category];

  return (
    <AppCard accent={doneToday ? 'highlight' : 'default'} style={styles.practiceCard}>
      <View style={styles.practiceHeader}>
        <View style={styles.practiceHeaderCopy}>
          <Text style={styles.practiceEyebrow}>Focus du jour</Text>
          <Text style={styles.practiceTitle}>{doneToday ? 'Routine validée' : drill.title}</Text>
        </View>
        <AppBadge label={doneToday ? 'Fait' : `${drill.duration_minutes} min`} tone={doneToday ? 'primary' : 'warning'} />
      </View>

      <View style={styles.practiceMetaRow}>
        <View style={styles.practiceMetaPill}>
          <Text style={styles.practiceMetaText}>{categoryLabel}</Text>
        </View>
        <View style={styles.practiceMetaPill}>
          <Text style={styles.practiceMetaText}>{DRILL_DIFFICULTY_LABELS[drill.difficulty]}</Text>
        </View>
      </View>

      <Text style={styles.practiceText}>
        {doneToday
          ? 'Objectif du jour enregistré. Tu gardes la dynamique sans ajouter de complexité.'
          : drill.description}
      </Text>

      {completionError ? (
        <Text style={styles.practiceError}>{completionError}</Text>
      ) : null}

      <View style={styles.practiceActions}>
        <AppButton
          label={doneToday ? 'Voir les drills' : markingDone ? 'Validation...' : 'Marquer fait'}
          onPress={doneToday ? onOpenDrills : onMarkDone}
          loading={markingDone}
          style={styles.practiceActionButton}
        />
        <AppButton
          label="Diagnostic"
          variant="secondary"
          onPress={onOpenDiagnostic}
          style={styles.practiceActionButton}
        />
      </View>
    </AppCard>
  );
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <AppCard style={styles.miniStatCard} accent="soft">
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 110,
  },
  loadingState: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorTitle: {
    ...Typography.titleMd,
    color: Colors.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  retryButton: {
    marginTop: Spacing.md,
    minWidth: 160,
  },
  heroCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroBadge: {
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  heroDescription: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  heroTrend: {
    ...Typography.label,
    color: Colors.accentBlue,
    marginTop: Spacing.sm,
  },
  heroAction: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    minWidth: 170,
  },
  emptyCard: {
    marginHorizontal: Spacing.md,
  },
  emptyTitle: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  emptyButton: {
    marginTop: Spacing.md,
  },
  practiceCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  practiceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  practiceLoadingText: {
    ...Typography.body,
    color: Colors.textMuted,
    flex: 1,
  },
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  practiceHeaderCopy: {
    flex: 1,
  },
  practiceEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  practiceTitle: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  practiceText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  practiceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  practiceMetaPill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  practiceMetaText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  practiceError: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
  practiceActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  practiceActionButton: {
    flex: 1,
    minHeight: 48,
  },
  practicePrimaryAction: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
  },
  statValue: {
    ...Typography.display,
    color: Colors.text,
  },
  statLabel: {
    ...Typography.label,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  statHelper: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  miniStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  miniStatValue: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  miniStatLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
  },
  chartHint: {
    ...Typography.caption,
    color: Colors.textDim,
    textAlign: 'right',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  sectionAction: {
    ...Typography.label,
    color: Colors.accentBlue,
  },
  roundCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  showMoreButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  roundLeft: {
    alignItems: 'center',
    minWidth: 64,
  },
  roundScore: {
    ...Typography.title,
    color: Colors.text,
  },
  roundPar: {
    ...Typography.caption,
    color: Colors.textDim,
  },
  roundCenter: {
    flex: 1,
  },
  roundCourse: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  roundDate: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  roundStats: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
  },
  roundRight: {
    alignItems: 'flex-end',
  },
  roundDiffText: {
    ...Typography.heading,
  },
  roundArrow: {
    color: Colors.textDim,
    fontSize: 24,
    marginTop: 2,
  },
  good: {
    color: Colors.accentBlue,
  },
  bad: {
    color: Colors.error,
  },
});
