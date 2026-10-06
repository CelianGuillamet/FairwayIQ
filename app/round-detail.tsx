import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import {
  AiCoachLimitError,
  analyzeRound,
  buildFallbackDiagnostic,
  type DiagnosticResult,
} from '../lib/claude';
import { DIAGNOSTIC_SAVE_FAILED_MESSAGE, persistDiagnostic } from '../lib/diagnostics';
import { buildUpdateRoundArgs, getRoundSaveErrorMessage, updateRound } from '../lib/round-save';
import { useRoundsStore } from '../stores/rounds';
import { useAuthStore } from '../stores/auth';
import { useSubscriptionStore } from '../stores/subscription';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import type { Round, RoundDraftHole, RoundHole } from '../types';
import { HoleScorecard } from '../components/rounds/HoleScorecard';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { AppBadge } from '../components/ui/AppBadge';
import { AppInput } from '../components/ui/AppInput';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';
import { RoundDiagnosticCard } from '../components/rounds-detail/RoundDiagnosticCard';
import { ScorecardGrid } from '../components/rounds-detail/ScorecardGrid';
import { StatsRow } from '../components/rounds-detail/StatsRow';
import { useShareRound } from '../components/share/useShareRound';
import { hapticSuccess, hapticWarning } from '../lib/haptics';
import { goBackOrHome } from '../components/rounds-detail/navigation';
import {
  buildRoundStats,
  buildRoundSubtitle,
  describeScoreToPar,
  formatRoundDate,
} from '../components/rounds-detail/round-summary';
import { buildScorecardHalves } from '../components/rounds-detail/scorecard-model';
import {
  aggregateScorecard,
  mapStoredHolesToDraft,
  sortRoundHoles,
  updateDraftHole,
  validateScorecard,
} from '../lib/rounds';

export default function RoundDetailScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const { rounds, upsertRound, removeRound } = useRoundsStore();
  const { user, profile } = useAuthStore();
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const subscriptionLoading = useSubscriptionStore((state) => state.loading);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const storedRound = rounds.find((round) => round.id === roundId) ?? null;
  const insets = useSafeAreaInsets();

  const [round, setRound] = useState<Round | null>(storedRound);
  const [courseName, setCourseName] = useState(storedRound?.course_name ?? '');
  const [notes, setNotes] = useState(storedRound?.notes ?? '');
  const [scorecard, setScorecard] = useState<RoundDraftHole[]>([]);
  const [hasStoredHoles, setHasStoredHoles] = useState(false);
  const [holesDirty, setHolesDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId) {
      setError('Round introuvable.');
      setLoading(false);
      return;
    }

    void loadRound();
  }, [roundId]);

  const aggregate = useMemo(
    () => hasStoredHoles && scorecard.length > 0 ? aggregateScorecard(scorecard) : null,
    [hasStoredHoles, scorecard]
  );

  const scorecardHalves = useMemo(
    () => hasStoredHoles && round ? buildScorecardHalves(scorecard, round.holes) : [],
    [hasStoredHoles, scorecard, round]
  );

  const { share, capturing, shareCard } = useShareRound({ round, aggregate, halves: scorecardHalves });

  const frontNine = scorecard.slice(0, 9);
  const backNine = scorecard.length === 18 ? scorecard.slice(9, 18) : [];

  async function loadRound() {
    if (!roundId) {
      return;
    }

    setLoading(true);
    setError(null);

    const [roundResponse, roundHolesResponse] = await Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).maybeSingle(),
      supabase.from('round_holes').select('*').eq('round_id', roundId).order('hole_number', { ascending: true }),
    ]);

    if (roundResponse.error && !storedRound) {
      setError(roundResponse.error.message);
      setLoading(false);
      return;
    }

    if (roundResponse.error) {
      console.warn('[round-detail] load round failed', roundResponse.error.message);
    }

    if (roundHolesResponse.error) {
      console.warn('[round-detail] load holes failed', roundHolesResponse.error.message);
    }

    const resolvedRound = (roundResponse.data as Round | null) ?? storedRound;

    if (!resolvedRound) {
      setError('Round introuvable.');
      setLoading(false);
      return;
    }

    const roundHoles = (roundHolesResponse.data as RoundHole[] | null) ?? [];
    const storedHoles = !roundHolesResponse.error && roundHoles.length > 0;

    setRound(resolvedRound);
    setCourseName(resolvedRound.course_name ?? '');
    setNotes(resolvedRound.notes ?? '');
    setHasStoredHoles(storedHoles);
    setHolesDirty(false);
    setScorecard(storedHoles ? mapStoredHolesToDraft(sortRoundHoles(roundHoles), resolvedRound.holes) : []);
    upsertRound(resolvedRound);
    setLoading(false);
  }

  const handleChangeHole = (holeNumber: number, patch: Partial<RoundDraftHole>) => {
    setHolesDirty(true);
    setScorecard((currentScorecard) => updateDraftHole(currentScorecard, holeNumber, patch));
  };

  const handleSave = async () => {
    if (!round || saving) {
      return;
    }

    const includeHoles = hasStoredHoles && holesDirty;

    if (includeHoles) {
      const validationError = validateScorecard(scorecard);

      if (validationError) {
        Alert.alert('Erreur', validationError);
        return;
      }
    }

    setSaving(true);

    try {
      const updatedRound = await updateRound(buildUpdateRoundArgs({
        roundId: round.id,
        courseName: courseName.trim() || null,
        notes: notes.trim() || null,
        scorecard: includeHoles ? scorecard : undefined,
      }));

      setRound(updatedRound);
      upsertRound(updatedRound);
      setHolesDirty(false);
      setEditing(false);
      hapticSuccess();
    } catch (currentError) {
      Alert.alert('Erreur', getRoundSaveErrorMessage(currentError, 'update'));
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async () => {
    if (!round || !user || !profile) {
      Alert.alert('Erreur', 'Session ou round introuvable.');
      return;
    }

    setReanalyzing(true);

    try {
      const effectiveRound = aggregate
        ? {
            ...round,
            course_name: courseName.trim() || null,
            notes: notes.trim() || null,
            total_score: aggregate.total_score,
            par: aggregate.par,
            holes: aggregate.holes,
            putts: aggregate.putts,
            gir: aggregate.gir,
            fairways_hit: aggregate.fairways_hit,
            fairways_total: aggregate.fairways_total,
            penalties: aggregate.penalties,
          }
        : round;

      const comparisonRounds = rounds.filter((entry) => entry.id !== round.id).slice(0, 5);
      const scorecardForAnalysis = hasStoredHoles ? scorecard : undefined;
      let diagnosis: DiagnosticResult;
      let isFallback = false;

      try {
        diagnosis = await analyzeRound(effectiveRound, profile, comparisonRounds, scorecardForAnalysis);
      } catch (analysisError) {
        if (analysisError instanceof AiCoachLimitError) {
          Alert.alert('Limite atteinte', analysisError.message);
        }

        diagnosis = buildFallbackDiagnostic(effectiveRound, profile, comparisonRounds, scorecardForAnalysis);
        isFallback = true;
      }

      const outcome = await persistDiagnostic({
        userId: user.id,
        roundId: round.id,
        result: diagnosis,
        isFallback,
      });

      if (outcome === 'failed') {
        Alert.alert('Diagnostic non enregistré', DIAGNOSTIC_SAVE_FAILED_MESSAGE);
      }

      router.push({
        pathname: '/diagnostic',
        params: {
          roundId: round.id,
          diagnosis: JSON.stringify(diagnosis),
        },
      });
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDelete = () => {
    if (!round) {
      return;
    }

    Alert.alert(
      'Supprimer ce round ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            hapticWarning();
            const { error: deleteError } = await supabase
              .from('rounds')
              .delete()
              .eq('id', round.id);

            if (deleteError) {
              Alert.alert('Erreur', deleteError.message);
              return;
            }

            removeRound(round.id);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Chargement du round...</Text>
      </View>
    );
  }

  if (!round || error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Round introuvable.'}</Text>
        <AppButton label="Retour à l’accueil" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    );
  }

  const scoreDiff = aggregate?.score_to_par ?? round.total_score - round.par;
  const heroScore = aggregate?.total_score ?? round.total_score;
  const heroPar = aggregate?.par ?? round.par;
  const heroSummary = describeScoreToPar(scoreDiff);
  const stats = buildRoundStats(round, aggregate);
  const debriefLocked = !isPremium && !subscriptionLoading;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xs, paddingBottom: Spacing.display + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          onBack={goBackOrHome}
          eyebrow={formatRoundDate(round.played_at) || undefined}
          title={courseName.trim() || round.course_name || 'Parcours'}
          subtitle={buildRoundSubtitle(round)}
          trailing={
            editing ? (
              <AppBadge label="Modification" tone="neutral" />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.quietAction, pressed && styles.pressed]}
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Modifier le round"
              >
                <Text style={styles.quietActionLabel}>Modifier</Text>
              </Pressable>
            )
          }
        />

        <View
          style={styles.hero}
          accessible
          accessibilityLabel={`${heroScore} coups, ${heroSummary}`}
        >
          <Text style={styles.heroScore} maxFontSizeMultiplier={1.2}>{heroScore}</Text>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroDiff, scoreDiff <= 0 && styles.heroDiffGood]}>{heroSummary}</Text>
            <Text style={styles.heroCaption}>{`Par ${heroPar}`}</Text>
          </View>
        </View>

        {!editing ? (
          <TextAction
            label="Partager"
            icon="share"
            tone="muted"
            onPress={() => void share()}
            loading={capturing}
            accessibilityLabel="Partager ce round"
            accessibilityHint="Crée une image du round à partager"
            style={styles.shareAction}
          />
        ) : null}

        {editing ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Infos du round</Text>
            <AppInput
              label="Parcours"
              value={courseName}
              onChangeText={setCourseName}
              placeholder="Nom du parcours"
            />
            <AppInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Conditions, stratégie, sensations..."
              style={styles.notesInput}
            />
          </View>
        ) : null}

        {hasStoredHoles ? (
          editing ? (
            <>
              <HoleScorecard
                title={round.holes === 18 ? 'Aller' : 'Carte de score'}
                holes={frontNine}
                editable={editing}
                onChangeHole={handleChangeHole}
              />

              {round.holes === 18 ? (
                <HoleScorecard
                  title="Retour"
                  holes={backNine}
                  editable={editing}
                  onChangeHole={handleChangeHole}
                />
              ) : null}
            </>
          ) : (
            <View style={styles.block}>
              <ScorecardGrid halves={scorecardHalves} />
            </View>
          )
        ) : (
          <AppCard accent="soft" style={styles.block}>
            <Text style={styles.sectionTitle}>Carte de score</Text>
            <Text style={styles.mutedText}>
              Le détail trou par trou n’est pas disponible pour ce round.
            </Text>
          </AppCard>
        )}

        <View style={styles.block}>
          <StatsRow stats={stats} />
        </View>

        <View style={styles.block}>
          <RoundDiagnosticCard
            reanalyzing={reanalyzing}
            showDebrief={!editing}
            debriefLocked={debriefLocked}
            onOpenDiagnostic={() => router.push({ pathname: '/diagnostic', params: { roundId: round.id } })}
            onReanalyze={() => void handleReanalyze()}
            onOpenDebrief={() => router.push({ pathname: '/debrief', params: { roundId } })}
          />
        </View>

        {!editing ? (
          <>
            <View style={styles.block}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {notes.trim() ? (
                <Text style={styles.noteText}>{notes.trim()}</Text>
              ) : (
                <Text style={styles.mutedText}>Aucune note pour ce round.</Text>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [styles.deleteAction, pressed && styles.deletePressed]}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Supprimer ce round"
            >
              <Icon name="trash" size={18} color={colors.error} />
              <Text style={styles.deleteLabel}>Supprimer ce round</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {shareCard}

      {editing ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
          <AppButton
            label={saving ? 'Sauvegarde...' : 'Sauvegarder'}
            onPress={() => void handleSave()}
            loading={saving}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
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
    block: {
      marginBottom: Spacing.lg,
    },
    quietAction: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xs,
    },
    quietActionLabel: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    pressed: {
      opacity: 0.7,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 14,
      marginBottom: Spacing.lg,
    },
    shareAction: {
      marginTop: -Spacing.sm,
      marginBottom: Spacing.xs,
    },
    heroScore: {
      ...Typography.numeralXL,
      fontSize: 76,
      lineHeight: 80,
      color: colors.ink,
    },
    heroCopy: {
      flex: 1,
      paddingBottom: Spacing.xs,
    },
    heroDiff: {
      ...Typography.heading,
      color: colors.ink,
    },
    heroDiffGood: {
      color: colors.green,
    },
    heroCaption: {
      ...Typography.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink2,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
      marginBottom: Spacing.xs,
    },
    mutedText: {
      ...Typography.body,
      color: colors.ink2,
    },
    noteText: {
      ...Typography.body,
      color: colors.ink,
    },
    notesInput: {
      minHeight: 92,
      textAlignVertical: 'top',
    },
    deleteAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      minHeight: 48,
      borderRadius: 14,
    },
    deletePressed: {
      backgroundColor: colors.errorBg,
    },
    deleteLabel: {
      ...Typography.bodyStrong,
      color: colors.error,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.bg,
    },
  });
