import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
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
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { AppInput } from '../../components/ui/AppInput';
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getDefaultPar(holes: 9 | 18) {
  return holes === 18 ? 72 : 36;
}

function formatScoreToPar(value: number) {
  return value === 0 ? 'E' : `${value > 0 ? '+' : ''}${value}`;
}

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
  const [loading, setLoading] = useState(false);
  const [courseLoading, setCourseLoading] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const [setupExpanded, setSetupExpanded] = useState(true);
  const courseRequestRef = useRef(0);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const setupLocked = progress.completedHoles > 0;
  const missingHoleNumbers = useMemo(
    () => scorecard.filter((hole) => !hole.completed).map((hole) => hole.hole_number),
    [scorecard]
  );
  const nextMissingHole = useMemo(
    () => scorecard.find((hole) => !hole.completed) ?? null,
    [scorecard]
  );
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

  useEffect(() => () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (currentHoleNumber > holes) {
      setCurrentHoleNumber(holes);
    }
  }, [currentHoleNumber, holes]);

  useEffect(() => {
    setTeeKey((currentTeeKey) => getValidTeeKey(selectedCourse, currentTeeKey));
  }, [selectedCourse]);

  useEffect(() => {
    if (setupExpanded && progress.completedHoles > 0) {
      animateLayout();
      setSetupExpanded(false);
    }
  }, [progress.completedHoles, setupExpanded]);

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

  const cancelAutoAdvance = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  const goToHole = (holeNumber: number) => {
    cancelAutoAdvance();
    animateLayout();
    setCurrentHoleNumber(Math.max(1, Math.min(holeNumber, scorecard.length)));
  };

  const handleCourseNameChange = (text: string) => {
    if (setupLocked) {
      return;
    }

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
    if (setupLocked) {
      return;
    }

    cancelAutoAdvance();

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
    if (setupLocked || holes === nextHoles) {
      return;
    }

    cancelAutoAdvance();
    setHoles(nextHoles);
    handleApplyCoursePar(nextHoles, selectedCourse);
  };

  const handleChangeCurrentHole = (patch: Partial<RoundDraftHole>) => {
    cancelAutoAdvance();

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

  const handleApplyScore = (score: number, options?: { autoAdvance?: boolean }) => {
    cancelAutoAdvance();

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

    if (!options?.autoAdvance || currentHoleNumber >= scorecard.length) {
      return;
    }

    autoAdvanceTimerRef.current = setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      animateLayout();
      setCurrentHoleNumber((currentValue) => Math.min(scorecard.length, currentValue + 1));
    }, 650);
  };

  const handleResetCurrentHole = () => {
    cancelAutoAdvance();
    setScorecard((currentScorecard) => resetDraftHole(currentScorecard, currentHoleNumber));
  };

  const handleSave = async (scorecardOverride?: RoundDraftHole[]) => {
    if (!user || !profile) {
      Alert.alert('Erreur', 'Session introuvable. Reconnecte-toi puis réessaie.');
      return;
    }

    const effectiveScorecard = scorecardOverride ?? scorecard;
    const validationError = validateScorecard(effectiveScorecard);

    if (validationError) {
      Alert.alert('Erreur', validationError);
      return;
    }

    cancelAutoAdvance();
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
        scorecard: effectiveScorecard,
      });

      const round = await addRound(roundPayload);
      const roundHoleInserts = buildRoundHoleInserts(round.id, user.id, effectiveScorecard);

      const { error: roundHolesError } = await supabase.from('round_holes').insert(roundHoleInserts);

      if (roundHolesError) {
        await supabase.from('rounds').delete().eq('id', round.id);
        removeRound(round.id);
        throw roundHolesError;
      }

      const diagnosis = await analyzeRound(round, profile, rounds.slice(0, 5), effectiveScorecard)
        .catch(() => buildFallbackDiagnostic(round, profile, rounds.slice(0, 5), effectiveScorecard));

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
            cancelAutoAdvance();

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
            setRestoredDraftAt(null);
            setSetupExpanded(true);
          },
        },
      ]
    );
  };

  const swipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => (
        Math.abs(gestureState.dx) > 14 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx <= -50 && canGoNext) {
          goToHole(currentHoleNumber + 1);
          return;
        }

        if (gestureState.dx >= 50 && canGoPrevious) {
          goToHole(currentHoleNumber - 1);
        }
      },
    }),
    [canGoNext, canGoPrevious, currentHoleNumber, scorecard.length]
  );

  const headerSubtitle =
    courseName.trim().length > 0
      ? `${courseName.trim()} · ${holes} trous · départ ${teeLabel}`
      : `Scoring express · ${holes} trous · départ ${teeLabel}`;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DecorativeBackground />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Round scoring</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {courseName.trim() || 'Fast score'}
            </Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>

          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              cancelAutoAdvance();
              animateLayout();
              setSetupExpanded((currentValue) => !currentValue);
            }}
          >
            <Text style={styles.headerActionLabel}>{setupExpanded ? 'Masquer' : 'Setup'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.liveMetricsRow}>
          <HeaderMetric label="Live" value={progress.completedHoles > 0 ? `${progress.liveScore}` : '--'} accent />
          <HeaderMetric label="Vs par" value={progress.completedHoles > 0 ? formatScoreToPar(progress.liveScoreToPar) : '—'} />
          <HeaderMetric label="Trous" value={`${progress.completedHoles}/${progress.totalHoles}`} />
        </View>

        {restoredDraftAt ? (
          <AppCard accent="soft" style={styles.bannerCard}>
            <View style={styles.bannerRow}>
              <View style={styles.bannerCopy}>
                <Text style={styles.bannerTitle}>Brouillon restauré</Text>
                <Text style={styles.bannerText}>
                  {restoredDraftLabel
                    ? `Carte reprise automatiquement le ${restoredDraftLabel}.`
                    : 'Carte reprise automatiquement sur cet appareil.'}
                </Text>
              </View>
              <TouchableOpacity style={styles.bannerAction} onPress={handleDiscardDraft}>
                <Text style={styles.bannerActionLabel}>Effacer</Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        ) : null}

        {setupExpanded ? (
          <AppCard accent="soft" style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <View style={styles.setupHeaderCopy}>
                <Text style={styles.setupEyebrow}>Round setup</Text>
                <Text style={styles.setupTitle}>
                  {setupLocked ? 'Le cadre du round est verrouillé pour protéger la carte.' : 'Prépare le round une fois, puis laisse l’écran vivre la partie.'}
                </Text>
              </View>
              {!setupLocked && hasMeaningfulDraft ? (
                <TouchableOpacity style={styles.setupGhostButton} onPress={handleDiscardDraft}>
                  <Text style={styles.setupGhostButtonLabel}>Réinitialiser</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!setupLocked ? (
              <>
                <View style={styles.modeToggle}>
                  {([9, 18] as const).map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.modeToggleButton, holes === value && styles.modeToggleButtonActive]}
                      onPress={() => handleHolesToggle(value)}
                    >
                      <Text style={[styles.modeToggleLabel, holes === value && styles.modeToggleLabelActive]}>
                        {value} trous
                      </Text>
                    </TouchableOpacity>
                  ))}
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
                      ? 'Synchronisation du parcours...'
                      : selectedCourse
                        ? `${selectedCourse.city} · ${selectedCourse.region} · ${courseHasOfficialHoleData ? 'données officielles complètes' : 'fallback premium'}`
                        : 'Parcours optionnel. Si absent, la saisie reste immédiate.'}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.lockedSetupPanel}>
                <LockedSetupPill label="Parcours" value={courseName.trim() || 'Libre'} />
                <LockedSetupPill label="Format" value={`${holes} trous`} />
                <LockedSetupPill label="Départ" value={teeLabel} />
              </View>
            )}

            <AppInput
              label="Notes"
              hint="Vent, stratégie, feeling. Optionnel."
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notesInput}
            />

            {setupLocked ? (
              <Text style={styles.setupLockHint}>
                Le parcours et le nombre de trous sont figés après le premier trou saisi pour éviter les incohérences de par.
              </Text>
            ) : null}
          </AppCard>
        ) : null}

        <HoleNavigation
          currentHole={currentHoleNumber}
          scorecard={scorecard}
          onSelectHole={goToHole}
          onPreviousHole={() => goToHole(currentHoleNumber - 1)}
          onNextHole={() => goToHole(currentHoleNumber + 1)}
        />

        {currentHole && currentHoleView ? (
          <View {...swipeResponder.panHandlers}>
            <HoleOverviewCard
              courseName={courseName.trim() || 'Parcours non précisé'}
              hole={currentHole}
              holeView={currentHoleView}
              teeKey={teeKey}
              teeOptions={teeOptions}
              onSelectTee={(nextTeeKey) => {
                cancelAutoAdvance();
                setTeeKey(nextTeeKey);
              }}
            />

            <HoleScoringPanel
              hole={currentHole}
              onApplyScore={handleApplyScore}
              onChangeHole={handleChangeCurrentHole}
              onResetHole={handleResetCurrentHole}
            />
          </View>
        ) : null}

        {canSave ? (
          <AppCard accent="highlight" style={styles.finishCard}>
            <Text style={styles.finishEyebrow}>Round prêt</Text>
            <Text style={styles.finishTitle}>
              {aggregate.total_score} coups · {formatScoreToPar(aggregate.score_to_par)}
            </Text>
            <Text style={styles.finishSubtitle}>
              {aggregate.putts} putts · {aggregate.gir} GIR · {aggregate.fairways_hit}/{aggregate.fairways_total} fairways · {aggregate.penalties} pénalités
            </Text>
          </AppCard>
        ) : null}

        {!canSave && nextMissingHole && nextMissingHole.hole_number !== currentHoleNumber ? (
          <AppButton
            label={`Reprendre au trou ${nextMissingHole.hole_number}`}
            variant="secondary"
            onPress={() => goToHole(nextMissingHole.hole_number)}
            style={styles.secondaryActionButton}
          />
        ) : null}

        {canSave ? (
          <AppButton
            label={loading ? 'Enregistrement...' : 'Finaliser le round'}
            onPress={() => void handleSave()}
            disabled={loading}
            style={styles.primaryActionButton}
          />
        ) : (
          <Text style={styles.helperText}>
            {missingHoleNumbers.length > 0
              ? `Score rapide actif. Trous restants : ${missingHoleNumbers.join(', ')}.`
              : 'Score rapide actif.'}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HeaderMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.headerMetricTile, accent && styles.headerMetricTileAccent]}>
      <Text style={[styles.headerMetricValue, accent && styles.headerMetricValueAccent]}>{value}</Text>
      <Text style={styles.headerMetricLabel}>{label}</Text>
    </View>
  );
}

function LockedSetupPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.lockedSetupTile}>
      <Text style={styles.lockedSetupLabel}>{label}</Text>
      <Text style={styles.lockedSetupValue}>{value}</Text>
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
  header: {
    marginHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  headerTitle: {
    ...Typography.title,
    color: Colors.text,
    marginTop: 4,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  headerAction: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceElevated,
  },
  headerActionLabel: {
    ...Typography.label,
    color: Colors.text,
  },
  liveMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerMetricTile: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  headerMetricTileAccent: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.primary,
  },
  headerMetricValue: {
    ...Typography.heading,
    color: Colors.text,
  },
  headerMetricValueAccent: {
    color: Colors.primary,
  },
  headerMetricLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  bannerCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerCopy: {
    flex: 1,
  },
  bannerTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  bannerText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 4,
  },
  bannerAction: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundSoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  bannerActionLabel: {
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
    alignItems: 'flex-start',
  },
  setupHeaderCopy: {
    flex: 1,
  },
  setupEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  setupTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: 6,
  },
  setupGhostButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  setupGhostButtonLabel: {
    ...Typography.label,
    color: Colors.text,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modeToggleButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  modeToggleButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  modeToggleLabel: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  modeToggleLabelActive: {
    color: Colors.background,
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
  lockedSetupPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  lockedSetupTile: {
    minWidth: '30%',
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  lockedSetupLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lockedSetupValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  setupLockHint: {
    ...Typography.caption,
    color: Colors.warning,
    marginTop: Spacing.xs,
  },
  finishCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  finishEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  finishTitle: {
    ...Typography.titleMd,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  finishSubtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  primaryActionButton: {
    marginHorizontal: Spacing.md,
  },
  secondaryActionButton: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textDim,
    marginHorizontal: Spacing.md,
  },
});
