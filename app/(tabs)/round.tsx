import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import { useAuthStore } from '../../stores/auth';
import { useRoundsStore } from '../../stores/rounds';
import { analyzeRound, buildFallbackDiagnostic } from '../../lib/claude';
import { saveDiagnostic } from '../../lib/diagnostics';
import { CourseSearch } from '../../components/ui/CourseSearch';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';
import { HoleNavigation } from '../../components/rounds/HoleNavigation';
import { HoleOverviewCard } from '../../components/rounds/HoleOverviewCard';
import { HoleScoringPanel } from '../../components/rounds/HoleScoringPanel';
import { AppBadge } from '../../components/ui/AppBadge';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { AppInput } from '../../components/ui/AppInput';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  getCourseById,
  getCourseParSequence,
  getDefaultTeeKey,
  getParForHoles,
  getTeeOptions,
  getValidTeeKey,
  hasCompleteCourseHoleDetails,
  type GolfCourse,
  type TeeKey,
} from '../../lib/golf-courses';
import { buildHoleViewData } from '../../lib/hole-view';
import { clearRoundDraft, loadRoundDraft, saveRoundDraft } from '../../lib/round-draft';
import { supabase } from '../../lib/supabase';
import type { RoundDraftHole } from '../../types';
import {
  aggregateScorecard,
  applyParSequenceToScorecard,
  applyTargetParToScorecard,
  buildRoundHoleInserts,
  buildRoundInsertFromScorecard,
  createDefaultScorecard,
  getScorecardProgress,
  resetDraftHole,
  resizeScorecard,
  updateDraftHole,
  validateScorecard,
} from '../../lib/rounds';

function getDefaultPar(holes: 9 | 18) {
  return holes === 18 ? 72 : 36;
}

function formatScoreToPar(value: number) {
  return value === 0 ? 'E' : `${value > 0 ? '+' : ''}${value}`;
}

export default function RoundScreen() {
  const { user, profile } = useAuthStore();
  const { addRound, removeRound, rounds } = useRoundsStore();
  const insets = useSafeAreaInsets();

  const [courseName, setCourseName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [holes, setHoles] = useState<9 | 18>(18);
  const [teeKey, setTeeKey] = useState<TeeKey>(getDefaultTeeKey());
  const [currentHoleNumber, setCurrentHoleNumber] = useState(1);
  const [scorecard, setScorecard] = useState<RoundDraftHole[]>(() => createDefaultScorecard(18));
  const [notes, setNotes] = useState('');
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courseLoading, setCourseLoading] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const courseRequestRef = useRef(0);

  const progress = useMemo(() => getScorecardProgress(scorecard), [scorecard]);
  const aggregate = useMemo(() => aggregateScorecard(scorecard), [scorecard]);
  const teeOptions = useMemo(() => getTeeOptions(selectedCourse), [selectedCourse]);
  const courseHasOfficialHoleData = useMemo(
    () => selectedCourse ? hasCompleteCourseHoleDetails(selectedCourse, holes) : false,
    [holes, selectedCourse]
  );
  const holeViews = useMemo(
    () => buildHoleViewData({ course: selectedCourse, scorecard }),
    [scorecard, selectedCourse]
  );
  const currentHole = scorecard[currentHoleNumber - 1];
  const currentHoleView = holeViews[currentHoleNumber - 1];
  const teeLabel = teeOptions.find((tee) => tee.key === teeKey)?.label ?? teeOptions[0]?.label ?? teeKey;
  const canGoPrevious = currentHoleNumber > 1;
  const canGoNext = currentHoleNumber < scorecard.length;
  const canSave = progress.completedHoles === scorecard.length && scorecard.length > 0;
  const hasMeaningfulDraft = useMemo(
    () => (
      courseName.trim().length > 0
      || notes.trim().length > 0
      || progress.completedHoles > 0
      || currentHoleNumber > 1
      || holes !== 18
      || teeKey !== getDefaultTeeKey(selectedCourse)
    ),
    [courseName, notes, progress.completedHoles, currentHoleNumber, holes, selectedCourse, teeKey]
  );
  const restoredDraftLabel = useMemo(() => {
    if (!restoredDraftAt) {
      return null;
    }

    const restoredDate = new Date(restoredDraftAt);

    if (Number.isNaN(restoredDate.getTime())) {
      return null;
    }

    return restoredDate.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [restoredDraftAt]);

  useEffect(() => {
    if (currentHoleNumber > holes) {
      setCurrentHoleNumber(holes);
    }
  }, [currentHoleNumber, holes]);

  useEffect(() => {
    setMetricsExpanded(false);
  }, [currentHoleNumber]);

  useEffect(() => {
    setTeeKey((currentTeeKey) => getValidTeeKey(selectedCourse, currentTeeKey));
  }, [selectedCourse]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateDraft() {
      if (!user?.id) {
        if (isMounted) {
          setDraftHydrated(true);
        }
        return;
      }

      const draft = await loadRoundDraft(user.id);

      if (!isMounted) {
        return;
      }

      if (!draft) {
        setDraftHydrated(true);
        return;
      }

      const restoredCourse = await getCourseById(draft.courseId);

      setCourseName(draft.courseName);
      setSelectedCourse(restoredCourse);
      setHoles(draft.holes);
      setTeeKey(getValidTeeKey(restoredCourse, draft.teeKey));
      setCurrentHoleNumber(Math.max(1, Math.min(draft.currentHoleNumber, draft.scorecard.length || draft.holes)));
      setScorecard(draft.scorecard);
      setNotes(draft.notes);
      setRestoredDraftAt(draft.savedAt);
      setDraftHydrated(true);
    }

    void hydrateDraft();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!draftHydrated || !user?.id || loading) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!hasMeaningfulDraft) {
        void clearRoundDraft(user.id);
        return;
      }

      void saveRoundDraft(user.id, {
        courseId: selectedCourse && !selectedCourse.id.startsWith('custom-') ? selectedCourse.id : null,
        courseName,
        holes,
        teeKey,
        currentHoleNumber,
        notes,
        scorecard,
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    courseName,
    currentHoleNumber,
    draftHydrated,
    hasMeaningfulDraft,
    holes,
    loading,
    notes,
    scorecard,
    selectedCourse,
    teeKey,
    user?.id,
  ]);

  const handleCourseNameChange = (text: string) => {
    setCourseName(text);

    if (selectedCourse && text.trim() !== selectedCourse.name) {
      setSelectedCourse(null);
    }
  };

  const handleApplyCoursePar = (nextHoles: 9 | 18, course?: GolfCourse | null) => {
    const targetPar = course ? getParForHoles(course, nextHoles) : getDefaultPar(nextHoles);
    const courseParSequence = course ? getCourseParSequence(course, nextHoles) : null;

    setScorecard((currentScorecard) => {
      const resizedScorecard = resizeScorecard(currentScorecard, nextHoles);

      if (courseParSequence) {
        return applyParSequenceToScorecard(resizedScorecard, courseParSequence);
      }

      return applyTargetParToScorecard(resizedScorecard, targetPar);
    });
  };

  const handleCourseSelect = async (course: GolfCourse) => {
    const requestId = courseRequestRef.current + 1;
    courseRequestRef.current = requestId;

    setCourseName(course.name);
    setSelectedCourse(course);
    setTeeKey((currentTeeKey) => getValidTeeKey(course, currentTeeKey));
    handleApplyCoursePar(holes, course);
    setCourseLoading(true);

    try {
      const resolvedCourse = await getCourseById(course.id);

      if (courseRequestRef.current !== requestId) {
        return;
      }

      if (!resolvedCourse) {
        return;
      }

      setSelectedCourse(resolvedCourse);
      setTeeKey((currentTeeKey) => getValidTeeKey(resolvedCourse, currentTeeKey));
      handleApplyCoursePar(holes, resolvedCourse);
    } finally {
      if (courseRequestRef.current === requestId) {
        setCourseLoading(false);
      }
    }
  };

  const handleHolesToggle = (nextHoles: 9 | 18) => {
    setHoles(nextHoles);
    handleApplyCoursePar(nextHoles, selectedCourse);
  };

  const handleChangeCurrentHole = (patch: Partial<RoundDraftHole>) => {
    setScorecard((currentScorecard) => {
      const currentDraftHole = currentScorecard[currentHoleNumber - 1];

      if (!currentDraftHole) {
        return currentScorecard;
      }

      const nextPatch = { ...patch };

      if (typeof nextPatch.putts === 'number') {
        nextPatch.putts = Math.max(0, Math.min(nextPatch.putts, currentDraftHole.score));
      }

      return updateDraftHole(currentScorecard, currentHoleNumber, nextPatch);
    });
  };

  const handleApplyScore = (score: number) => {
    setScorecard((currentScorecard) => {
      const hole = currentScorecard[currentHoleNumber - 1];

      if (!hole) {
        return currentScorecard;
      }

      return updateDraftHole(currentScorecard, currentHoleNumber, {
        score,
        putts: Math.min(hole.putts, score),
        completed: true,
      });
    });
  };

  const handleResetCurrentHole = () => {
    setScorecard((currentScorecard) => resetDraftHole(currentScorecard, currentHoleNumber));
  };

  const handleSave = async () => {
    if (!user || !profile) {
      Alert.alert('Erreur', 'Session introuvable. Reconnecte-toi puis réessaie.');
      return;
    }

    const validationError = validateScorecard(scorecard);

    if (validationError) {
      Alert.alert('Erreur', validationError);
      return;
    }

    setLoading(true);

    try {
      const isCatalogCourse = selectedCourse != null && !selectedCourse.id.startsWith('custom-');
      const selectedTeeOption = teeOptions.find((teeOption) => teeOption.key === teeKey) ?? null;
      const roundPayload = buildRoundInsertFromScorecard({
        userId: user.id,
        playedAt: new Date().toISOString(),
        courseId: isCatalogCourse ? selectedCourse?.id ?? null : null,
        courseName: courseName.trim() || null,
        courseProvider: isCatalogCourse ? selectedCourse?.provider ?? null : null,
        providerCourseId: isCatalogCourse ? selectedCourse?.providerCourseId ?? null : null,
        teeKey,
        teeSetId: isCatalogCourse ? selectedTeeOption?.id ?? null : null,
        teeName: selectedTeeOption?.label ?? null,
        teeColor: selectedTeeOption?.color ?? null,
        notes: notes.trim() || null,
        scorecard,
      });

      const round = await addRound(roundPayload);
      const roundHoleInserts = buildRoundHoleInserts(round.id, user.id, scorecard);

      const { error: roundHolesError } = await supabase.from('round_holes').insert(roundHoleInserts);

      if (roundHolesError) {
        await supabase.from('rounds').delete().eq('id', round.id);
        removeRound(round.id);
        throw roundHolesError;
      }

      const diagnosis = await analyzeRound(round, profile, rounds.slice(0, 5), scorecard)
        .catch(() => buildFallbackDiagnostic(round, profile, rounds.slice(0, 5), scorecard));

      await saveDiagnostic({ userId: user.id, roundId: round.id, result: diagnosis }).catch((error: any) => {
        console.warn('[diagnostic] save failed', error?.message ?? error);
      });

      await clearRoundDraft(user.id);
      setRestoredDraftAt(null);

      router.push({
        pathname: '/diagnostic',
        params: { roundId: round.id, diagnosis: JSON.stringify(diagnosis) },
      });
    } catch (error: any) {
      Alert.alert('Erreur', error?.message ?? 'Une erreur est survenue pendant la création du round.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardDraft = () => {
    Alert.alert(
      'Effacer le brouillon ?',
      'La saisie trou par trou sauvegardée sur cet appareil sera supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            if (user?.id) {
              void clearRoundDraft(user.id);
            }

            setCourseName('');
            setSelectedCourse(null);
            setHoles(18);
            setTeeKey(getDefaultTeeKey());
            setCurrentHoleNumber(1);
            setScorecard(createDefaultScorecard(18));
            setNotes('');
            setMetricsExpanded(false);
            setRestoredDraftAt(null);
          },
        },
      ]
    );
  };

  const handlePrimaryAction = () => {
    if (canSave && !canGoNext) {
      void handleSave();
      return;
    }

    if (canGoNext) {
      setCurrentHoleNumber((currentValue) => Math.min(scorecard.length, currentValue + 1));
    }
  };

  const primaryActionLabel =
    canSave && !canGoNext
      ? loading
        ? 'Enregistrement...'
        : 'Finaliser le round'
      : 'Trou suivant';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">
        <PageHeader
          eyebrow="Performance scoring"
          title="Round control center"
          subtitle={
            courseName.trim()
              ? `${courseName.trim()} · ${holes} trous · départ ${teeLabel}`
              : `Scoring trou par trou · ${holes} trous · départ ${teeLabel}`
          }
          trailing={<AppBadge label={`${progress.completedHoles}/${progress.totalHoles}`} tone="primary" />}
        />

        {restoredDraftAt ? (
          <AppCard accent="soft" style={styles.draftCard}>
            <View style={styles.draftHeader}>
              <View style={styles.draftCopy}>
                <Text style={styles.draftTitle}>Brouillon restauré</Text>
                <Text style={styles.draftText}>
                  {restoredDraftLabel
                    ? `Reprise automatique de la carte sauvegardée le ${restoredDraftLabel}.`
                    : 'Reprise automatique de la dernière carte enregistrée sur cet appareil.'}
                </Text>
              </View>

              <TouchableOpacity style={styles.draftResetButton} onPress={handleDiscardDraft}>
                <Text style={styles.draftResetLabel}>Effacer</Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        ) : null}

        <AppCard accent="highlight" style={styles.setupCard}>
          <View style={styles.setupHeader}>
            <View style={styles.setupCopy}>
              <Text style={styles.setupEyebrow}>Préparation</Text>
              <Text style={styles.setupTitle}>Configure le round et garde la même référence pendant toute la partie.</Text>
            </View>

            <View style={styles.modeToggle}>
              {([9, 18] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.modeToggleButton, holes === value && styles.modeToggleButtonActive]}
                  onPress={() => handleHolesToggle(value)}
                >
                  <Text style={[styles.modeToggleLabel, holes === value && styles.modeToggleLabelActive]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.setupTelemetry}>
            <SetupTelemetryTile label="Départ" value={teeLabel} />
            <SetupTelemetryTile label="Live" value={progress.completedHoles > 0 ? formatScoreToPar(progress.liveScoreToPar) : '—'} />
            <SetupTelemetryTile label="Restants" value={`${progress.remainingHoles}`} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Parcours</Text>
            <CourseSearch
              value={courseName}
              onChangeText={handleCourseNameChange}
              onSelect={handleCourseSelect}
            />
            <Text style={styles.fieldHint}>
              {courseLoading
                ? 'Synchronisation du parcours et de ses départs...'
                : selectedCourse
                ? `${selectedCourse.city} · ${selectedCourse.region} · ${courseHasOfficialHoleData ? 'tees et distances officiels' : 'tees standards, distances estimées'}`
                : 'Si le parcours manque, saisis-le manuellement. La vue de trou reste crédible avec fallback premium.'}
            </Text>
          </View>

          <AppInput
            label="Notes de round"
            hint="Vent, stratégie, feeling du jour."
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.notesInput}
          />
        </AppCard>

        <HoleNavigation
          currentHole={currentHoleNumber}
          scorecard={scorecard}
          onSelectHole={setCurrentHoleNumber}
          onPreviousHole={() => setCurrentHoleNumber((value) => Math.max(1, value - 1))}
          onNextHole={() => setCurrentHoleNumber((value) => Math.min(scorecard.length, value + 1))}
        />

        <View style={styles.summaryGrid}>
          <SummaryTile label="Score live" value={progress.completedHoles > 0 ? `${progress.liveScore}` : '--'} />
          <SummaryTile label="Vs par" value={progress.completedHoles > 0 ? formatScoreToPar(progress.liveScoreToPar) : '--'} accent />
          <SummaryTile label="Putt moy." value={`${aggregate.average_putts_per_hole}`} />
          <SummaryTile label="GIR" value={`${aggregate.gir_percentage}%`} />
        </View>

        {currentHole && currentHoleView ? (
          <>
            <HoleOverviewCard
              courseName={courseName.trim() || 'Parcours non précisé'}
              hole={currentHole}
              holeView={currentHoleView}
              teeKey={teeKey}
              teeOptions={teeOptions}
              onSelectTee={setTeeKey}
            />

            <HoleScoringPanel
              hole={currentHole}
              metricsExpanded={metricsExpanded}
              onToggleMetrics={() => setMetricsExpanded((value) => !value)}
              onApplyScore={handleApplyScore}
              onChangeHole={handleChangeCurrentHole}
              onResetHole={handleResetCurrentHole}
            />
          </>
        ) : null}

        <AppCard accent="soft" style={styles.aggregateCard}>
          <View style={styles.aggregateHeader}>
            <View>
              <Text style={styles.aggregateEyebrow}>Carte globale</Text>
              <Text style={styles.aggregateTitle}>Projection du round</Text>
            </View>
            <AppBadge label={formatScoreToPar(aggregate.score_to_par)} tone={aggregate.score_to_par <= 0 ? 'primary' : 'warning'} />
          </View>

          <Text style={styles.aggregateScore}>
            {aggregate.total_score} coups · Par {aggregate.par}
          </Text>
          <Text style={styles.aggregateSplit}>
            Aller {aggregate.front_nine_score} ({formatScoreToPar(aggregate.front_nine_to_par)})
            {aggregate.back_nine_score != null && aggregate.back_nine_to_par != null
              ? ` · Retour ${aggregate.back_nine_score} (${formatScoreToPar(aggregate.back_nine_to_par)})`
              : ''}
          </Text>
        </AppCard>

        {!canSave ? (
          <Text style={styles.helperText}>
            Finalisation débloquée quand tous les trous sont validés.
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          <AppButton
            label="Trou précédent"
            variant="secondary"
            onPress={() => setCurrentHoleNumber((value) => Math.max(1, value - 1))}
            disabled={!canGoPrevious}
            style={styles.footerButton}
          />
          <AppButton
            label={primaryActionLabel}
            onPress={handlePrimaryAction}
            disabled={loading}
            style={styles.footerPrimaryButton}
          />
        </View>

        {canSave && canGoNext ? (
          <AppButton
            label="Finaliser maintenant"
            variant="secondary"
            onPress={() => void handleSave()}
            disabled={loading}
            style={styles.finalizeButton}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SetupTelemetryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.setupTelemetryTile}>
      <Text style={styles.setupTelemetryLabel}>{label}</Text>
      <Text style={styles.setupTelemetryValue}>{value}</Text>
    </View>
  );
}

function SummaryTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.summaryTile, accent && styles.summaryTileAccent]}>
      <Text style={[styles.summaryValue, accent && styles.summaryValueAccent]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 126,
  },
  draftCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    alignItems: 'center',
  },
  draftCopy: {
    flex: 1,
  },
  draftTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  draftText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 4,
  },
  draftResetButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundSoft,
  },
  draftResetLabel: {
    ...Typography.label,
    color: Colors.text,
  },
  setupCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  setupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  setupCopy: {
    flex: 1,
  },
  setupEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  setupTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: 6,
  },
  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: 4,
    gap: 4,
  },
  modeToggleButton: {
    minWidth: 48,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeToggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeToggleLabel: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  modeToggleLabelActive: {
    color: Colors.background,
  },
  setupTelemetry: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  setupTelemetryTile: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  setupTelemetryLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  setupTelemetryValue: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  fieldGroup: {
    marginTop: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  fieldHint: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 6,
  },
  notesInput: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryTile: {
    flex: 1,
    minWidth: '45%',
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  summaryTileAccent: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.primary,
  },
  summaryValue: {
    ...Typography.display,
    color: Colors.text,
  },
  summaryValueAccent: {
    color: Colors.primary,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  aggregateCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  aggregateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  aggregateEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aggregateTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: 4,
  },
  aggregateScore: {
    ...Typography.titleMd,
    color: Colors.primary,
    marginTop: Spacing.lg,
  },
  aggregateSplit: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.warning,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  footerButton: {
    flex: 1,
  },
  footerPrimaryButton: {
    flex: 1.15,
  },
  finalizeButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
});
