import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { analyzeRound, buildFallbackDiagnostic } from '../lib/claude';
import { saveDiagnostic } from '../lib/diagnostics';
import { useRoundsStore } from '../stores/rounds';
import { useAuthStore } from '../stores/auth';
import { Colors, Spacing, Typography } from '../constants';
import type { Round, RoundHole } from '../types';
import { HoleScorecard } from '../components/rounds/HoleScorecard';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { AppBadge } from '../components/ui/AppBadge';
import { PageHeader } from '../components/ui/PageHeader';
import {
  aggregateScorecard,
  buildRoundHoleInserts,
  buildRoundInsertFromScorecard,
  createSyntheticScorecardFromRound,
  getRoundPerformanceSummary,
  mapStoredHolesToDraft,
  sortRoundHoles,
  updateDraftHole,
  validateScorecard,
} from '../lib/rounds';

export default function RoundDetailScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const { rounds, upsertRound, removeRound } = useRoundsStore();
  const { user, profile } = useAuthStore();
  const storedRound = rounds.find((round) => round.id === roundId) ?? null;
  const insets = useSafeAreaInsets();

  const [round, setRound] = useState<Round | null>(storedRound);
  const [courseName, setCourseName] = useState(storedRound?.course_name ?? '');
  const [notes, setNotes] = useState(storedRound?.notes ?? '');
  const [scorecard, setScorecard] = useState(() => storedRound ? createSyntheticScorecardFromRound(storedRound) : []);
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
    () => scorecard.length > 0 ? aggregateScorecard(scorecard) : null,
    [scorecard]
  );

  const roundSummary = round ? getRoundPerformanceSummary(round) : null;
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
    const nextScorecard =
      roundHoles.length > 0
        ? mapStoredHolesToDraft(sortRoundHoles(roundHoles), resolvedRound.holes)
        : createSyntheticScorecardFromRound(resolvedRound);

    setRound(resolvedRound);
    setCourseName(resolvedRound.course_name ?? '');
    setNotes(resolvedRound.notes ?? '');
    setScorecard(nextScorecard);
    upsertRound(resolvedRound);
    setLoading(false);
  }

  const handleSave = async () => {
    if (!round) {
      return;
    }

    const validationError = validateScorecard(scorecard);

    if (validationError) {
      Alert.alert('Erreur', validationError);
      return;
    }

    setSaving(true);

    try {
      const roundPayload = buildRoundInsertFromScorecard({
        userId: round.user_id,
        playedAt: round.played_at,
        courseId: round.course_id,
        courseName: courseName.trim() || null,
        courseProvider: round.course_provider,
        providerCourseId: round.provider_course_id,
        teeKey: round.tee_key,
        teeSetId: round.tee_set_id,
        teeName: round.tee_name,
        teeColor: round.tee_color,
        notes: notes.trim() || null,
        scorecard,
      });

      const { data: updatedRound, error: roundError } = await supabase
        .from('rounds')
        .update(roundPayload)
        .eq('id', round.id)
        .select()
        .single();

      if (roundError) {
        throw roundError;
      }

      const { error: roundHolesError } = await supabase
        .from('round_holes')
        .upsert(buildRoundHoleInserts(round.id, round.user_id, scorecard), {
          onConflict: 'round_id,hole_number',
        });

      if (roundHolesError) {
        throw roundHolesError;
      }

      setRound(updatedRound as Round);
      upsertRound(updatedRound as Round);
      setEditing(false);
    } catch (currentError: any) {
      Alert.alert('Erreur', currentError?.message ?? 'Impossible de sauvegarder ce round.');
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
      const diagnosis = await analyzeRound(effectiveRound, profile, comparisonRounds, scorecard)
        .catch(() => buildFallbackDiagnostic(effectiveRound, profile, comparisonRounds, scorecard));

      await saveDiagnostic({
        userId: user.id,
        roundId: round.id,
        result: diagnosis,
      }).catch((currentError: any) => {
        console.warn('[diagnostic] save failed', currentError?.message ?? currentError);
      });

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
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <ActivityIndicator size="large" color={Colors.text} />
        <Text style={styles.loadingText}>Chargement du round...</Text>
      </View>
    );
  }

  if (!round || error) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <Text style={styles.errorText}>{error ?? 'Round introuvable.'}</Text>
        <AppButton label="Retour au dashboard" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    );
  }

  const scoreDiff = aggregate?.score_to_par ?? round.total_score - round.par;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
        <PageHeader
          eyebrow="Round detail"
          title={courseName.trim() || round.course_name || 'Parcours'}
          subtitle={`${format(new Date(round.played_at), 'EEEE d MMMM yyyy', { locale: fr })} · ${round.holes} trous`}
          trailing={<AppBadge label={editing ? 'Édition' : 'Lecture'} tone={editing ? 'primary' : 'neutral'} />}
        />

        <AppCard accent="highlight" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroScore}>{aggregate?.total_score ?? round.total_score}</Text>
              <Text style={[styles.heroDiff, scoreDiff <= 0 ? styles.good : styles.bad]}>
                {scoreDiff > 0 ? '+' : ''}
                {scoreDiff}
              </Text>
            </View>
            <View style={styles.heroStats}>
              <AppBadge label={`${round.holes} trous`} tone="neutral" />
              <AppBadge label={editing ? 'Modifiable' : 'Verrouillé'} tone={editing ? 'primary' : 'warning'} style={styles.heroBadgeSpacing} />
            </View>
          </View>

          <View style={styles.actionRow}>
            <AppButton
              label={saving ? 'Sauvegarde...' : editing ? 'Sauvegarder' : 'Modifier le round'}
              onPress={() => editing ? void handleSave() : setEditing(true)}
              loading={saving}
              style={styles.actionButton}
            />
            <AppButton
              label={reanalyzing ? 'Analyse...' : 'Relancer le diagnostic'}
              variant="secondary"
              onPress={() => void handleReanalyze()}
              disabled={reanalyzing}
              style={styles.actionButton}
            />
          </View>

          {!editing ? (
            <AppButton
              label="Débrief IA"
              variant="ghost"
              onPress={() => router.push({ pathname: '/debrief', params: { roundId } })}
              style={styles.debriefButton}
            />
          ) : null}
        </AppCard>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Putts"
            value={aggregate ? aggregate.putts.toString() : round.putts?.toString() ?? '--'}
            helper={aggregate ? `${aggregate.average_putts_per_hole}/trou` : roundSummary?.puttsPerHole != null ? `${roundSummary.puttsPerHole}/trou` : '—'}
          />
          <MetricCard
            label="GIR"
            value={aggregate ? `${aggregate.gir_percentage}%` : roundSummary?.girPercentage != null ? `${roundSummary.girPercentage}%` : '--'}
            helper={aggregate ? `${aggregate.gir}/${aggregate.holes}` : round.gir != null ? `${round.gir}/${round.holes}` : '—'}
          />
          <MetricCard
            label="Fairways"
            value={aggregate?.fairway_percentage != null ? `${aggregate.fairway_percentage}%` : roundSummary?.fairwayPercentage != null ? `${roundSummary.fairwayPercentage}%` : '--'}
            helper={aggregate ? `${aggregate.fairways_hit}/${aggregate.fairways_total}` : round.fairways_hit != null && round.fairways_total != null ? `${round.fairways_hit}/${round.fairways_total}` : '—'}
          />
          <MetricCard
            label="Pénalités"
            value={aggregate ? aggregate.penalties.toString() : (round.penalties ?? 0).toString()}
            helper="coups donnés"
          />
        </View>

        {aggregate ? (
          <AppCard style={styles.splitCard}>
            <Text style={styles.sectionTitle}>Split de score</Text>
            <SplitRow label="Aller" score={aggregate.front_nine_score} toPar={aggregate.front_nine_to_par} />
            {aggregate.back_nine_score != null && aggregate.back_nine_to_par != null ? (
              <SplitRow label="Retour" score={aggregate.back_nine_score} toPar={aggregate.back_nine_to_par} />
            ) : null}
          </AppCard>
        ) : null}

        <AppCard style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Infos round</Text>
          <Text style={styles.inputLabel}>Parcours</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              placeholder="Nom du parcours"
              placeholderTextColor={Colors.textDim}
            />
          ) : (
            <Text style={styles.readOnlyText}>{courseName.trim() || 'Parcours non précisé'}</Text>
          )}

          <Text style={[styles.inputLabel, styles.notesLabel]}>Notes</Text>
          {editing ? (
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Conditions, stratégie, sensations..."
              placeholderTextColor={Colors.textDim}
            />
          ) : (
            <Text style={styles.readOnlyText}>{notes.trim() || 'Aucune note pour ce round.'}</Text>
          )}
        </AppCard>

        <HoleScorecard
          title={round.holes === 18 ? 'Aller' : 'Carte de score'}
          holes={frontNine}
          editable={editing}
          onChangeHole={(holeNumber, patch) => setScorecard((currentScorecard) => updateDraftHole(currentScorecard, holeNumber, patch))}
        />

        {round.holes === 18 ? (
          <HoleScorecard
            title="Retour"
            holes={backNine}
            editable={editing}
            onChangeHole={(holeNumber, patch) => setScorecard((currentScorecard) => updateDraftHole(currentScorecard, holeNumber, patch))}
          />
        ) : null}

        {!editing ? (
          <AppButton label="Supprimer ce round" variant="secondary" onPress={handleDelete} style={styles.deleteButton} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <AppCard style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </AppCard>
  );
}

function SplitRow({ label, score, toPar }: { label: string; score: number; toPar: number }) {
  return (
    <View style={styles.splitRow}>
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={styles.splitScore}>{score}</Text>
      <Text style={[styles.splitDiff, toPar <= 0 ? styles.good : styles.bad]}>
        {toPar > 0 ? '+' : ''}
        {toPar}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
  loadingState: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  errorText: {
    ...Typography.bodyStrong,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  heroCard: {
    marginBottom: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  heroScore: {
    ...Typography.display,
    fontSize: 72,
    lineHeight: 78,
    color: Colors.text,
  },
  heroDiff: {
    ...Typography.titleMd,
    marginTop: 2,
  },
  heroStats: {
    alignItems: 'flex-end',
  },
  heroBadgeSpacing: {
    marginTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  debriefButton: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
  },
  metricValue: {
    ...Typography.display,
    color: Colors.text,
  },
  metricLabel: {
    ...Typography.label,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  metricHelper: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
  },
  splitCard: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  splitLabel: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  splitScore: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  splitDiff: {
    ...Typography.bodyStrong,
  },
  infoCard: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textDim,
    marginBottom: 8,
  },
  notesLabel: {
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 16,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  readOnlyText: {
    ...Typography.body,
    color: Colors.text,
  },
  deleteButton: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  good: {
    color: Colors.accentBlue,
  },
  bad: {
    color: Colors.error,
  },
});
