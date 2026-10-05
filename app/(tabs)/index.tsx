import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useAuthStore } from '../../stores/auth';
import { useDrillsStore } from '../../stores/drills';
import { useRoundsStore } from '../../stores/rounds';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppButton } from '../../components/ui/AppButton';
import { Icon } from '../../components/ui/Icon';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextAction } from '../../components/ui/TextAction';
import { DrillResultSheet } from '../../components/drills/DrillResultSheet';
import { EmptyHome } from '../../components/home/EmptyHome';
import { EvolutionCard, type EvolutionSeries } from '../../components/home/EvolutionCard';
import { FocusBlock } from '../../components/home/FocusBlock';
import { IndexCard } from '../../components/home/IndexCard';
import { LeaksCard } from '../../components/home/LeaksCard';
import { MonthlyChallengeCard } from '../../components/home/MonthlyChallengeCard';
import { MonthlyChallengeSheet } from '../../components/home/MonthlyChallengeSheet';
import { PINNED_CTA_CLEARANCE, PinnedCta } from '../../components/home/PinnedCta';
import { PracticeCard } from '../../components/home/PracticeCard';
import { RemindersHint } from '../../components/home/RemindersHint';
import { RoundRow } from '../../components/home/RoundRow';
import { StatsStrip, type StatItem } from '../../components/home/StatsStrip';
import { useMonthlyChallenge } from '../../components/home/useMonthlyChallenge';
import { useWeeklyGoal } from '../../components/home/useWeeklyGoal';
import { WeeklyGoalCard } from '../../components/home/WeeklyGoalCard';
import { WeeklyGoalSheet } from '../../components/home/WeeklyGoalSheet';
import { useLeaks } from '../../components/leaks/useLeaks';
import type { Diagnostic, Drill } from '../../types';
import { fetchLatestDiagnostic } from '../../lib/diagnostics';
import { ensureRoundsLoaded } from '../../lib/ensure-loaded';
import { hapticSuccess } from '../../lib/haptics';
import { getDailyFocusDrill, isDrillDoneToday } from '../../lib/drill-library';
import type { DrillResult } from '../../lib/drill-results';
import { hasEnoughLeakData } from '../../lib/leaks';
import { countWeeklySessions, getWeekStart } from '../../lib/weekly-goal';
import {
  formatDecimalFr,
  formatHandicapValue,
  formatHomeDate,
  formatSignedFr,
  getFocusInsight,
  getSparklineValues,
  getTrendPill,
} from '../../lib/home';
import {
  getAveragePenaltyCount,
  getAveragePuttsPer18Holes,
  getAverageScoreToParPer18Holes,
  getBestRound,
  getHandicapIndexCard,
  getScoreToParTrend,
  normalizeTo18Holes,
} from '../../lib/rounds';

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

const PLACEHOLDER = '--';

export default function DashboardScreen() {
  const { profile, user } = useAuthStore();
  const { rounds, fetchRounds, fetchMoreRounds, loading, loadingMore, hasMore, initialized, error } = useRoundsStore();
  const { completions, fetchCompletions, markDone, setRecommendedCategories } = useDrillsStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [latestDiagnostic, setLatestDiagnostic] = useState<Diagnostic | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [resultDrill, setResultDrill] = useState<Drill | null>(null);
  const [markingFocusDone, setMarkingFocusDone] = useState(false);
  const [focusCompletionError, setFocusCompletionError] = useState<string | null>(null);
  const [visibleRoundsCount, setVisibleRoundsCount] = useState(6);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [challengeSheetOpen, setChallengeSheetOpen] = useState(false);
  const leaks = useLeaks();
  const monthlyChallenge = useMonthlyChallenge(leaks);
  const weeklyGoal = useWeeklyGoal(user?.id, profile?.play_frequency);
  const weekStart = getWeekStart().getTime();
  const weeklySessions = useMemo(
    () => countWeeklySessions({ rounds, completions }),
    [rounds, completions, weekStart],
  );

  useEffect(() => {
    if (!initialized) {
      void ensureRoundsLoaded();
    }
  }, [initialized]);

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

  const focusInsight = getFocusInsight(rounds);
  const handicapIndexCard = getHandicapIndexCard(rounds);
  const hasHandicapIndex = handicapIndexCard.value !== PLACEHOLDER;
  const bestRound = getBestRound(rounds);
  const averagePenaltyCount = getAveragePenaltyCount(rounds);
  const trendPill = getTrendPill(getScoreToParTrend(rounds));
  const sparkValues = useMemo(() => getSparklineValues(rounds), [rounds]);

  const scoreRounds = useMemo(() => rounds.slice(0, 10).reverse(), [rounds]);
  const scoreData = scoreRounds.map((round) => normalizeTo18Holes(round.total_score - round.par, round.holes));
  const scoreLabels = scoreRounds.map((round) => format(new Date(round.played_at), 'dd/MM'));

  const puttRounds = scoreRounds.filter((round) => round.putts != null);
  const puttsData = puttRounds.map((round) => normalizeTo18Holes(round.putts as number, round.holes));
  const puttsLabels = puttRounds.map((round) => format(new Date(round.played_at), 'dd/MM'));

  const girRounds = scoreRounds.filter((round) => round.gir != null);
  const girData = girRounds.map((round) => Math.round(((round.gir as number) / round.holes) * 100));
  const girLabels = girRounds.map((round) => format(new Date(round.played_at), 'dd/MM'));

  const averageScoreToPar = getAverageScoreToParPer18Holes(rounds);
  const averagePutts = getAveragePuttsPer18Holes(rounds);
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

  const handleMarkFocusDrillDone = () => {
    if (!user || !focusDrill || focusDrillDoneToday || markingFocusDone) {
      return;
    }

    setFocusCompletionError(null);
    setResultDrill(focusDrill);
  };

  const recordFocusCompletion = async (result: DrillResult | null) => {
    if (!user || !resultDrill || markingFocusDone) {
      return;
    }

    setMarkingFocusDone(true);
    setFocusCompletionError(null);

    try {
      await markDone(resultDrill.id, user.id, result);
      hapticSuccess();
      setResultDrill(null);
    } catch (currentError: any) {
      setFocusCompletionError(currentError?.message ?? 'Impossible de valider ce drill.');
    } finally {
      setMarkingFocusDone(false);
    }
  };

  const evolutionSeries: EvolutionSeries[] = [
    {
      key: 'score',
      tabLabel: 'Score',
      title: 'Score par rapport au par',
      hint: 'Plus bas est meilleur. Lecture sur les 10 derniers rounds, ramenée à 18 trous.',
      data: scoreData,
      labels: scoreLabels,
      accessibilityLabel: `Score par rapport au par sur les ${scoreData.length} derniers rounds, de ${formatSignedFr(scoreData[0] ?? 0, 0)} à ${formatSignedFr(scoreData[scoreData.length - 1] ?? 0, 0)}`,
    },
    {
      key: 'putts',
      tabLabel: 'Putts',
      title: 'Putts par round',
      hint: 'Plus bas est meilleur. Putts ramenés à 18 trous.',
      data: puttsData,
      labels: puttsLabels,
      accessibilityLabel: `Putts ramenés à 18 trous, de ${Math.round(puttsData[0] ?? 0)} à ${Math.round(puttsData[puttsData.length - 1] ?? 0)}`,
    },
    {
      key: 'gir',
      tabLabel: 'Greens',
      title: 'Greens en régulation',
      hint: 'Pourcentage de greens touchés.',
      data: girData,
      labels: girLabels,
      accessibilityLabel: `Greens en régulation, de ${girData[0] ?? 0} % à ${girData[girData.length - 1] ?? 0} %`,
    },
  ].filter((item) => item.data.length >= 2);

  const stats: StatItem[] = [
    {
      label: 'Score vs par',
      value: averageScoreToPar != null ? formatSignedFr(averageScoreToPar) : PLACEHOLDER,
    },
    {
      label: 'Putts',
      value: averagePutts != null ? formatDecimalFr(averagePutts) : PLACEHOLDER,
    },
    {
      label: 'Pénalités',
      value: averagePenaltyCount != null ? formatDecimalFr(averagePenaltyCount) : PLACEHOLDER,
    },
    {
      label: 'Greens en rég.',
      value: averageGirPct != null ? formatDecimalFr(averageGirPct) : PLACEHOLDER,
      unit: averageGirPct != null ? '%' : undefined,
    },
    {
      label: 'Fairways',
      value: averageFairwayPct != null ? formatDecimalFr(averageFairwayPct) : PLACEHOLDER,
      unit: averageFairwayPct != null ? '%' : undefined,
    },
    {
      label: 'Meilleur round',
      value: bestRound ? `${bestRound.total_score}` : PLACEHOLDER,
      unit: bestRound ? formatSignedFr(bestRound.total_score - bestRound.par, 0) : undefined,
    },
  ];

  if (loading && !initialized) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Chargement de ton cockpit de jeu…</Text>
      </View>
    );
  }

  if (error && rounds.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Impossible de charger tes rounds</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <AppButton label="Réessayer" onPress={() => void fetchRounds()} style={styles.retryButton} />
      </View>
    );
  }

  const hasRounds = rounds.length > 0;
  const topLeak = leaks.status === 'ready' && hasEnoughLeakData(leaks.analysis) ? leaks.analysis.leaks[0] : null;
  const displayName = profile?.display_name?.trim();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: PINNED_CTA_CLEARANCE + Spacing.md },
        ]}
      >
        <PageHeader
          eyebrow={formatHomeDate(new Date())}
          title={displayName ? `Bonjour ${displayName}` : 'Bonjour'}
          trailing={(
            <Pressable
              style={({ pressed }) => [styles.premiumChip, pressed && styles.pressed]}
              onPress={() => router.push('/paywall' as any)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Premium"
              accessibilityHint="Ouvre l’offre Premium"
            >
              <Icon name="sparkles" size={16} color={colors.ink} />
              <Text style={styles.premiumChipLabel}>Premium</Text>
            </Pressable>
          )}
        />

        {hasRounds ? (
          <View style={styles.sections}>
            <IndexCard
              value={formatHandicapValue(handicapIndexCard.value)}
              helper={handicapIndexCard.helper}
              hasIndex={hasHandicapIndex}
              sparkValues={sparkValues}
              trend={trendPill}
            />

            <RemindersHint />

            {weeklyGoal.loaded ? (
              <WeeklyGoalCard sessions={weeklySessions} goal={weeklyGoal.goal} onPress={() => setGoalSheetOpen(true)} />
            ) : null}

            {monthlyChallenge.status === 'ready' ? (
              <MonthlyChallengeCard
                challenge={monthlyChallenge.challenge}
                progress={monthlyChallenge.progress}
                onPress={() => setChallengeSheetOpen(true)}
              />
            ) : null}

            <FocusBlock insight={focusInsight} onAction={() => router.push(focusInsight.actionRoute)} />

            <PracticeCard
              loading={diagnosticLoading}
              error={diagnosticError}
              diagnostic={latestDiagnostic}
              drill={focusDrill}
              doneToday={focusDrillDoneToday}
              markingDone={markingFocusDone}
              completionError={resultDrill ? null : focusCompletionError}
              onRetry={() => void loadLatestDiagnostic()}
              onMarkDone={handleMarkFocusDrillDone}
              onOpenDrills={() => router.push('/(tabs)/drills')}
              onOpenDiagnostic={() => {
                if (latestDiagnostic?.round_id) {
                  router.push({ pathname: '/diagnostic', params: { roundId: latestDiagnostic.round_id } });
                } else {
                  router.push('/(tabs)/round');
                }
              }}
            />

            {topLeak ? <LeaksCard leak={topLeak} onOpen={() => router.push('/leaks')} /> : null}

            <View>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Statistiques
              </Text>
              <Text style={styles.sectionCaption}>Moyennes ramenées à 18 trous</Text>
              <StatsStrip items={stats} />
            </View>

            <EvolutionCard series={evolutionSeries} />

            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  Derniers rounds
                </Text>
                <TextAction label="Actualiser" tone="muted" onPress={() => void fetchRounds()} style={styles.sectionAction} />
              </View>
              {recentRounds.map((round) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  onPress={() => router.push({ pathname: '/round-detail', params: { roundId: round.id } } as any)}
                />
              ))}
              {canShowMoreRounds ? (
                <View style={styles.showMore}>
                  <AppButton
                    label={loadingMore ? 'Chargement…' : 'Voir plus de rounds'}
                    variant="secondary"
                    loading={loadingMore}
                    onPress={() => void handleShowMoreRounds()}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <EmptyHome declaredHandicap={profile?.handicap ?? null} />
        )}
      </ScrollView>

      <PinnedCta
        label={hasRounds ? 'Nouveau round' : 'Enregistrer mon premier round'}
        icon="plus"
        accessibilityHint="Ouvre l’onglet Score pour saisir un round"
        onPress={() => router.push('/(tabs)/round')}
      />

      <WeeklyGoalSheet
        visible={goalSheetOpen}
        goal={weeklyGoal.goal}
        recommended={weeklyGoal.recommended}
        isCustom={weeklyGoal.isCustom}
        onSelect={(goal) => {
          weeklyGoal.setGoal(goal);
          setGoalSheetOpen(false);
        }}
        onReset={() => {
          weeklyGoal.resetGoal();
          setGoalSheetOpen(false);
        }}
        onClose={() => setGoalSheetOpen(false)}
      />

      <DrillResultSheet
        drill={resultDrill}
        saving={markingFocusDone}
        error={focusCompletionError}
        onSave={(result) => void recordFocusCompletion(result)}
        onSkip={() => void recordFocusCompletion(null)}
        onClose={() => setResultDrill(null)}
      />

      {monthlyChallenge.status === 'ready' ? (
        <MonthlyChallengeSheet
          visible={challengeSheetOpen}
          challenge={monthlyChallenge.challenge}
          progress={monthlyChallenge.progress}
          canChange={monthlyChallenge.canChange}
          changeUsed={monthlyChallenge.changeUsed}
          onChange={() => {
            monthlyChallenge.change();
            setChallengeSheetOpen(false);
          }}
          onClose={() => setChallengeSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: Spacing.lg,
    },
    sections: {
      gap: Spacing.xl,
    },
    centered: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    loadingText: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    errorTitle: {
      ...Typography.titleMd,
      color: colors.ink,
      textAlign: 'center',
    },
    errorSubtitle: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    retryButton: {
      marginTop: Spacing.md,
      minWidth: 160,
    },
    premiumChip: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.lineStrong,
    },
    premiumChipLabel: {
      ...Typography.label,
      color: colors.ink,
    },
    pressed: {
      opacity: 0.6,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
    },
    sectionCaption: {
      ...Typography.caption,
      color: colors.ink3,
      marginBottom: Spacing.sm,
    },
    sectionAction: {
      alignSelf: 'center',
    },
    showMore: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: Spacing.sm,
    },
  });
