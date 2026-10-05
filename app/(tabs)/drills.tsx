import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useDrillsStore } from '../../stores/drills';
import { useAuthStore } from '../../stores/auth';
import type { Drill } from '../../types';
import { DRILL_CATEGORY_LABELS, DRILLS } from '../../lib/drill-library';
import { buildWeeklyPlan, isDrillDoneThisWeek } from '../../lib/drill-plan';
import { getResultThisWeek, type DrillResult } from '../../lib/drill-results';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppCard } from '../../components/ui/AppCard';
import { Icon } from '../../components/ui/Icon';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextAction } from '../../components/ui/TextAction';
import { CategoryFilter } from '../../components/drills/CategoryFilter';
import { DrillCard, type DrillCardResults } from '../../components/drills/DrillCard';
import { DrillResultSheet } from '../../components/drills/DrillResultSheet';
import { PlanCounter, PlanProgressBar } from '../../components/drills/PlanProgress';
import { PINNED_CTA_CLEARANCE, PinnedCta } from '../../components/home/PinnedCta';

const CATEGORIES = [
  { key: 'recommended', label: 'Focus' },
  { key: 'all', label: 'Tous' },
  { key: 'putting', label: 'Putting' },
  { key: 'short_game', label: 'Petit jeu' },
  { key: 'approach', label: 'Approches' },
  { key: 'driving', label: 'Mise en jeu' },
  { key: 'mental', label: 'Mental' },
] as const;

export default function DrillsScreen() {
  const [activeCategory, setActiveCategory] = useState<string>('recommended');
  const [showLibrary, setShowLibrary] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [resultDrill, setResultDrill] = useState<Drill | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const {
    completions,
    recommendedCategories,
    fetchCompletions,
    markDone,
    isDoneToday,
    getStreak,
    getLastResult,
    getBestResult,
    getSuccessRate,
  } = useDrillsStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);
  const planOffset = useRef(0);
  const cardOffsets = useRef<Record<string, number>>({});
  const libraryOffset = useRef<number | null>(null);
  const scrollToLibrary = useRef(false);
  const { category, focus } = useLocalSearchParams<{ category?: string; focus?: string }>();

  useEffect(() => {
    if (typeof category !== 'string' || !(category in DRILL_CATEGORY_LABELS)) {
      return;
    }

    setActiveCategory(category);

    if (showLibrary && libraryOffset.current != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, libraryOffset.current - Spacing.md), animated: true });
    } else {
      scrollToLibrary.current = true;
      setShowLibrary(true);
    }
  }, [category, focus]);

  useEffect(() => {
    void fetchCompletions().catch((error: any) => {
      Alert.alert('Erreur', error?.message ?? 'Impossible de charger tes drills complétés.');
    });
  }, [fetchCompletions]);

  const filtered = activeCategory === 'all'
    ? DRILLS
    : activeCategory === 'recommended'
      ? recommendedCategories.length > 0
        ? DRILLS.filter(d => recommendedCategories.includes(d.category))
        : DRILLS
      : DRILLS.filter(d => d.category === activeCategory);

  const streak = getStreak();
  const plan = buildWeeklyPlan({ categories: recommendedCategories, completions });
  const recommendedLabels = recommendedCategories.map(
    (category) => DRILL_CATEGORY_LABELS[category as keyof typeof DRILL_CATEGORY_LABELS] ?? category
  );

  const resultsFor = (drillId: string): DrillCardResults => ({
    last: getLastResult(drillId),
    best: getBestResult(drillId),
    rate: getSuccessRate(drillId),
    week: getResultThisWeek(drillId, completions),
  });

  const handleMarkDone = (drill: Drill) => {
    if (!user) {
      return;
    }

    setResultError(null);
    setResultDrill(drill);
  };

  const closeResultSheet = () => {
    setResultDrill(null);
    setResultError(null);
  };

  const recordCompletion = async (result: DrillResult | null) => {
    if (!user || !resultDrill || savingResult) {
      return;
    }

    setSavingResult(true);
    setResultError(null);

    try {
      await markDone(resultDrill.id, user.id, result);
      setResultDrill(null);
    } catch (error: any) {
      setResultError(error?.message ?? 'Impossible de marquer ce drill comme terminé.');
    } finally {
      setSavingResult(false);
    }
  };

  const handleStartNext = () => {
    if (!plan.next) {
      return;
    }

    const key = `plan:${plan.next.id}`;
    setExpandedKey(key);
    scrollRef.current?.scrollTo({
      y: Math.max(0, planOffset.current + (cardOffsets.current[key] ?? 0) - Spacing.md),
      animated: true,
    });
  };

  const toggle = (key: string) => setExpandedKey((current) => (current === key ? null : key));

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: (plan.next ? PINNED_CTA_CLEARANCE : Spacing.xl) + Spacing.md,
          },
        ]}
      >
        <PageHeader
          title="Exercices"
          subtitle="Plan de la semaine"
          trailing={<PlanCounter done={plan.doneCount} total={plan.total} />}
        />

        <View style={styles.intro}>
          <PlanProgressBar done={plan.doneCount} total={plan.total} />
          <Text style={styles.introText}>
            {recommendedLabels.length > 0
              ? `Choisis d’après ton dernier diagnostic : ${recommendedLabels.join(' · ')}.`
              : 'Un exercice par domaine pour commencer. Analyse un round pour obtenir un plan sur mesure.'}
          </Text>
          {streak > 0 ? (
            <Text style={styles.streak}>
              Série en cours : {streak} {streak > 1 ? 'jours' : 'jour'}
            </Text>
          ) : null}
        </View>

        <View style={styles.list} onLayout={(event) => { planOffset.current = event.nativeEvent.layout.y; }}>
          {plan.items.map(({ drill, status }) => {
            const key = `plan:${drill.id}`;

            return (
              <DrillCard
                key={key}
                drill={drill}
                status={status}
                expanded={expandedKey === key}
                doneToday={isDoneToday(drill.id)}
                totalCompletions={completions.filter(c => c.drill_id === drill.id).length}
                results={resultsFor(drill.id)}
                onToggle={() => toggle(key)}
                onMarkDone={() => handleMarkDone(drill)}
                onLayout={(event) => { cardOffsets.current[key] = event.nativeEvent.layout.y; }}
              />
            );
          })}
        </View>

        {plan.total > 0 && !plan.next ? (
          <View style={styles.complete} accessible accessibilityRole="text">
            <Icon name="check" size={18} strokeWidth={2.5} color={colors.green} />
            <Text style={styles.completeText}>Plan terminé pour cette semaine.</Text>
          </View>
        ) : null}

        <TextAction
          label={showLibrary ? 'Masquer tous les exercices' : 'Parcourir tous les exercices'}
          icon={showLibrary ? undefined : 'chevron-right'}
          tone="muted"
          onPress={() => setShowLibrary((current) => !current)}
          style={styles.libraryToggle}
        />

        {showLibrary ? (
          <View
            style={styles.library}
            onLayout={(event) => {
              libraryOffset.current = event.nativeEvent.layout.y;

              if (scrollToLibrary.current) {
                scrollToLibrary.current = false;
                scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - Spacing.md), animated: true });
              }
            }}
          >
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Tous les exercices
            </Text>
            <CategoryFilter options={CATEGORIES} value={activeCategory} onChange={setActiveCategory} />

            {filtered.map(drill => {
              const key = `lib:${drill.id}`;

              return (
                <DrillCard
                  key={key}
                  drill={drill}
                  status={isDrillDoneThisWeek(drill.id, completions) ? 'done' : 'todo'}
                  expanded={expandedKey === key}
                  doneToday={isDoneToday(drill.id)}
                  totalCompletions={completions.filter(c => c.drill_id === drill.id).length}
                  results={resultsFor(drill.id)}
                  onToggle={() => toggle(key)}
                  onMarkDone={() => handleMarkDone(drill)}
                />
              );
            })}

            {filtered.length === 0 ? (
              <AppCard accent="soft">
                <Text style={styles.emptyTitle}>Aucun exercice sur ce filtre</Text>
                <Text style={styles.emptyText}>Change de catégorie ou attends un nouveau diagnostic pour faire remonter une priorité.</Text>
              </AppCard>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <DrillResultSheet
        drill={resultDrill}
        saving={savingResult}
        error={resultError}
        onSave={(result) => void recordCompletion(result)}
        onSkip={() => void recordCompletion(null)}
        onClose={closeResultSheet}
      />

      {plan.next ? (
        <PinnedCta
          label={`Commencer ${plan.next.title}`}
          accessibilityHint="Affiche les détails de l’exercice et sa validation"
          onPress={handleStartNext}
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
    intro: {
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    introText: {
      ...Typography.body,
      color: colors.ink2,
    },
    streak: {
      ...Typography.label,
      color: colors.ink3,
    },
    list: {
      gap: 10,
    },
    complete: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.md,
    },
    completeText: {
      ...Typography.bodyStrong,
      color: colors.green,
    },
    libraryToggle: {
      marginTop: Spacing.sm,
    },
    library: {
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
    },
    emptyTitle: {
      ...Typography.heading,
      color: colors.ink,
      marginBottom: 6,
    },
    emptyText: {
      ...Typography.body,
      color: colors.ink2,
    },
  });
