import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import type { DiagnosticResult } from '../lib/claude';
import { useDrillsStore } from '../stores/drills';
import { useRoundsStore } from '../stores/rounds';
import { useSubscriptionStore } from '../stores/subscription';
import { fetchDiagnosticByRound } from '../lib/diagnostics';
import { parseDiagnosisParam, parseDiagnosticResult } from '../lib/diagnostic-shape';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { InsightList } from '../components/rounds-detail/InsightList';
import { NoticeRow } from '../components/rounds-detail/NoticeRow';
import { PlanText } from '../components/rounds-detail/PlanText';
import { goBackOrHome } from '../components/rounds-detail/navigation';
import { formatSigned } from '../components/rounds-detail/round-summary';

const CATEGORY_LABELS: Record<string, string> = {
  putting: 'Putting',
  short_game: 'Petit jeu',
  approach: 'Approches',
  driving: 'Mise en jeu',
  mental: 'Mental',
};

const UNSAVED_TITLE = 'Diagnostic non enregistré';
const UNSAVED_MESSAGE =
  'Il a été établi sans le coach IA (hors ligne) ou n’a pas pu être sauvegardé. Il disparaît à la fermeture de l’écran : relance-le depuis le détail du round pour le retrouver.';

export default function DiagnosticScreen() {
  const { roundId: roundIdParam, diagnosis } = useLocalSearchParams<{
    roundId?: string | string[];
    diagnosis?: string | string[];
  }>();
  const roundId = typeof roundIdParam === 'string' ? roundIdParam : undefined;
  const { setRecommendedCategories } = useDrillsStore();
  const round = useRoundsStore((state) => state.rounds.find((entry) => entry.id === roundId));
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const subscriptionLoading = useSubscriptionStore((state) => state.loading);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const paramDiagnosis = useMemo(() => parseDiagnosisParam(diagnosis), [diagnosis]);

  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      if (!roundId) {
        setLoading(false);
        setError('Diagnostic introuvable.');
        return;
      }

      setLoading(true);
      setError(null);

      // The saved diagnostic is authoritative. The URL param is only a fallback for when it
      // could not be loaded, and only for one of this user's rounds, so a crafted link
      // cannot inject content.
      const fallback = useRoundsStore.getState().rounds.some((round) => round.id === roundId)
        ? paramDiagnosis
        : null;

      try {
        const diagnostic = await fetchDiagnosticByRound(roundId);
        if (cancelled) return;

        const stored = diagnostic ? parseDiagnosticResult(diagnostic) : null;
        const shown = stored ?? fallback;
        if (shown) {
          setResult(shown);
          setUnsaved(!stored);
        } else {
          setError(diagnostic ? 'Diagnostic illisible.' : 'Aucun diagnostic enregistré pour ce round.');
        }
      } catch (currentError: any) {
        if (cancelled) return;

        if (fallback) {
          setResult(fallback);
          setUnsaved(true);
        } else {
          setError(currentError?.message ?? 'Impossible de charger le diagnostic.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDiagnostic();

    return () => {
      cancelled = true;
    };
  }, [paramDiagnosis, roundId]);

  useEffect(() => {
    if (result?.recommended_categories?.length) {
      setRecommendedCategories(result.recommended_categories);
    }
  }, [result, setRecommendedCategories]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Chargement du diagnostic...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Diagnostic introuvable.'}</Text>
        <AppButton label="Retour à l’accueil" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    );
  }

  const debriefLocked = !isPremium && !subscriptionLoading;
  const subtitle = round
    ? `${round.course_name ?? 'Parcours'} · ${round.total_score} coups (${formatSigned(round.total_score - round.par)})`
    : undefined;
  const hasStrengths = result.strengths?.length > 0;
  const hasWeaknesses = result.weaknesses?.length > 0;
  const hasCategories = result.recommended_categories?.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xs }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader onBack={goBackOrHome} title="Diagnostic du round" subtitle={subtitle} />

        {unsaved ? <NoticeRow title={UNSAVED_TITLE} message={UNSAVED_MESSAGE} style={styles.notice} /> : null}

        <Section title="Lecture globale" first>
          <PlanText text={result.raw_analysis} size="lead" />
        </Section>

        {hasStrengths ? (
          <Section title="Points forts">
            <InsightList items={result.strengths} tone="strength" />
          </Section>
        ) : null}

        {hasWeaknesses ? (
          <Section title="Axes d’amélioration">
            <InsightList items={result.weaknesses} tone="weakness" />
          </Section>
        ) : null}

        <AppCard style={styles.planCard}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Plan de la semaine</Text>
          <PlanText text={result.weekly_plan} />
        </AppCard>

        {hasCategories ? (
          <Section title="Priorités d’entraînement" plain>
            <View style={styles.chips}>
              {result.recommended_categories.map((category) => {
                const label = CATEGORY_LABELS[category] ?? category;

                return (
                  <Pressable
                    key={category}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    onPress={() => router.push('/(tabs)/drills')}
                    accessibilityRole="link"
                    accessibilityLabel={`${label}, ouvrir les exercices`}
                  >
                    <Text style={styles.chipLabel}>{label}</Text>
                    <Icon name="chevron-right" size={16} color={colors.ink3} />
                  </Pressable>
                );
              })}
            </View>
          </Section>
        ) : null}

        <View style={styles.secondary}>
          <AppButton
            label="Ouvrir le débrief"
            variant="secondary"
            icon={debriefLocked ? 'lock' : undefined}
            accessibilityHint={debriefLocked ? 'Réservé aux abonnés Premium' : undefined}
            onPress={() => router.push({ pathname: '/debrief', params: { roundId } })}
          />
          <AppButton
            label="Voir le round en détail"
            variant="ghost"
            onPress={() => router.push({ pathname: '/round-detail', params: { roundId } })}
          />
          <AppButton
            label="Retour à l’accueil"
            variant="ghost"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <AppButton label="Voir les exercices" onPress={() => router.push('/(tabs)/drills')} />
      </View>
    </View>
  );
}

function Section({
  title,
  first = false,
  plain = false,
  children,
}: {
  title: string;
  first?: boolean;
  plain?: boolean;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.section, !first && !plain && styles.sectionDivided, plain && styles.sectionPlain]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
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
      paddingBottom: Spacing.xl,
    },
    centered: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    loadingText: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.sm,
    },
    errorText: {
      ...Typography.bodyStrong,
      color: colors.error,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    notice: {
      marginBottom: Spacing.lg,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionDivided: {
      marginTop: Spacing.lg,
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    sectionPlain: {
      marginTop: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    planCard: {
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
      minHeight: 44,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
    },
    chipLabel: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    pressed: {
      opacity: 0.7,
    },
    secondary: {
      marginTop: Spacing.xl,
      gap: Spacing.xxs,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.bg,
    },
  });
