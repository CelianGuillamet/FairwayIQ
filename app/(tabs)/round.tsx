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

  const [courseName, setCourseName]         = useState('');
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [holes, setHoles]                   = useState<9 | 18>(18);
  const [teeKey, setTeeKey]                 = useState<TeeKey>(getDefaultTeeKey());
  const [currentHoleNumber, setCurrentHoleNumber] = useState(1);
  const [scorecard, setScorecard]           = useState<RoundDraftHole[]>(() => createDefaultScorecard(18));
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [courseLoading, setCourseLoading]   = useState(false);
  const [draftHydrated, setDraftHydrated]   = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const [setupExpanded, setSetupExpanded]   = useState(true);
  const courseRequestRef  = useRef(0);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress   = useMemo(() => getScorecardProgress(scorecard), [scorecard]);
  const aggregate  = useMemo(() => aggregateScorecard(scorecard), [scorecard]);
  const teeOptions = useMemo(() => getTeeOptions(selectedCourse), [selectedCourse]);
  const courseHasOfficialHoleData = useMemo(
    () => selectedCourse ? hasCompleteCourseHoleDetails(selectedCourse, holes) : false,
    [holes, selectedCourse],
  );
  const holeViews = useMemo(
    () => buildHoleViewData({ course: selectedCourse, scorecard }),
    [scorecard, selectedCourse],
  );

  const currentHole     = scorecard[currentHoleNumber - 1];
  const currentHoleView = holeViews[currentHoleNumber - 1];
  const teeLabel        = teeOptions.find((tee) => tee.key === teeKey)?.label ?? teeOptions[0]?.label ?? teeKey;
  const canGoPrevious   = currentHoleNumber > 1;
  const canGoNext       = currentHoleNumber < scorecard.length;
  const canSave         = progress.completedHoles === scorecard.length && scorecard.length > 0;
  const setupLocked     = progress.completedHoles > 0;

  const hasMeaningfulDraft = useMemo(
    () => (
      courseName.trim().length > 0
      || notes.trim().length > 0
      || progress.completedHoles > 0
      || currentHoleNumber > 1
      || holes !== 18
      || teeKey !== getDefaultTeeKey(selectedCourse)
    ),
    [courseName, notes, progress.completedHoles, currentHoleNumber, holes, selectedCourse, teeKey],
  );

  const restoredDraftLabel = useMemo(() => {
    if (!restoredDraftAt) return null;
    const d = new Date(restoredDraftAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }, [restoredDraftAt]);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
  }, []);

  useEffect(() => {
    if (currentHoleNumber > holes) setCurrentHoleNumber(holes);
  }, [currentHoleNumber, holes]);

  useEffect(() => {
    setTeeKey((current) => getValidTeeKey(selectedCourse, current));
  }, [selectedCourse]);

  useEffect(() => {
    if (setupExpanded && progress.completedHoles > 0) {
      animateLayout();
      setSetupExpanded(false);
    }
  }, [progress.completedHoles, setupExpanded]);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      if (!user?.id) { if (mounted) setDraftHydrated(true); return; }
      const draft = await loadRoundDraft(user.id);
      if (!mounted) return;
      if (!draft) { setDraftHydrated(true); return; }

      const restored = await getCourseById(draft.courseId);
      setCourseName(draft.courseName);
      setSelectedCourse(restored);
      setHoles(draft.holes);
      setTeeKey(getValidTeeKey(restored, draft.teeKey));
      setCurrentHoleNumber(Math.max(1, Math.min(draft.currentHoleNumber, draft.scorecard.length || draft.holes)));
      setScorecard(draft.scorecard);
      setNotes(draft.notes);
      setRestoredDraftAt(draft.savedAt);
      setDraftHydrated(true);
    }

    void hydrate();
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!draftHydrated || !user?.id || loading) return;

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
    courseName, currentHoleNumber, draftHydrated, hasMeaningfulDraft,
    holes, loading, notes, scorecard, selectedCourse, teeKey, user?.id,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────

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
    if (setupLocked) return;
    setCourseName(text);
    if (selectedCourse && text.trim() !== selectedCourse.name) setSelectedCourse(null);
  };

  const handleApplyCoursePar = (nextHoles: 9 | 18, course?: GolfCourse | null) => {
    const targetPar        = course ? getParForHoles(course, nextHoles) : getDefaultPar(nextHoles);
    const courseParSeq     = course ? getCourseParSequence(course, nextHoles) : null;
    setScorecard((curr) => {
      const resized = resizeScorecard(curr, nextHoles);
      return courseParSeq
        ? applyParSequenceToScorecard(resized, courseParSeq)
        : applyTargetParToScorecard(resized, targetPar);
    });
  };

  const handleCourseSelect = async (course: GolfCourse) => {
    if (setupLocked) return;
    cancelAutoAdvance();
    const reqId = ++courseRequestRef.current;
    setCourseName(course.name);
    setSelectedCourse(course);
    setTeeKey((curr) => getValidTeeKey(course, curr));
    handleApplyCoursePar(holes, course);
    setCourseLoading(true);
    try {
      const resolved = await getCourseById(course.id);
      if (courseRequestRef.current !== reqId || !resolved) return;
      setSelectedCourse(resolved);
      setTeeKey((curr) => getValidTeeKey(resolved, curr));
      handleApplyCoursePar(holes, resolved);
    } finally {
      if (courseRequestRef.current === reqId) setCourseLoading(false);
    }
  };

  const handleHolesToggle = (nextHoles: 9 | 18) => {
    if (setupLocked || holes === nextHoles) return;
    cancelAutoAdvance();
    setHoles(nextHoles);
    handleApplyCoursePar(nextHoles, selectedCourse);
  };

  const handleChangeCurrentHole = (patch: Partial<RoundDraftHole>) => {
    cancelAutoAdvance();
    setScorecard((curr) => {
      const hole = curr[currentHoleNumber - 1];
      if (!hole) return curr;
      const next = { ...patch };
      if (typeof next.putts === 'number') next.putts = Math.max(0, Math.min(next.putts, hole.score));
      return updateDraftHole(curr, currentHoleNumber, next);
    });
  };

  const handleApplyScore = (score: number, options?: { autoAdvance?: boolean }) => {
    cancelAutoAdvance();
    setScorecard((curr) => {
      const hole = curr[currentHoleNumber - 1];
      if (!hole) return curr;
      return updateDraftHole(curr, currentHoleNumber, {
        score,
        putts: Math.min(hole.putts, score),
        completed: true,
      });
    });
    if (!options?.autoAdvance || currentHoleNumber >= scorecard.length) return;
    autoAdvanceTimerRef.current = setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      animateLayout();
      setCurrentHoleNumber((v) => Math.min(scorecard.length, v + 1));
    }, 650);
  };

  const handleResetCurrentHole = () => {
    cancelAutoAdvance();
    setScorecard((curr) => resetDraftHole(curr, currentHoleNumber));
  };

  const handleSave = async (scorecardOverride?: RoundDraftHole[]) => {
    if (!user || !profile) {
      Alert.alert('Erreur', 'Session introuvable. Reconnecte-toi puis réessaie.');
      return;
    }
    const effectiveScorecard = scorecardOverride ?? scorecard;
    const err = validateScorecard(effectiveScorecard);
    if (err) { Alert.alert('Erreur', err); return; }

    cancelAutoAdvance();
    setLoading(true);
    try {
      const isCatalog       = selectedCourse != null && !selectedCourse.id.startsWith('custom-');
      const selectedTeeOpt  = teeOptions.find((t) => t.key === teeKey) ?? null;
      const roundPayload    = buildRoundInsertFromScorecard({
        userId: user.id,
        playedAt: new Date().toISOString(),
        courseId: isCatalog ? selectedCourse?.id ?? null : null,
        courseName: courseName.trim() || null,
        courseProvider: isCatalog ? selectedCourse?.provider ?? null : null,
        providerCourseId: isCatalog ? selectedCourse?.providerCourseId ?? null : null,
        teeKey,
        teeSetId: isCatalog ? selectedTeeOpt?.id ?? null : null,
        teeName: selectedTeeOpt?.label ?? null,
        teeColor: selectedTeeOpt?.color ?? null,
        notes: notes.trim() || null,
        scorecard: effectiveScorecard,
      });

      const round         = await addRound(roundPayload);
      const holeInserts   = buildRoundHoleInserts(round.id, user.id, effectiveScorecard);
      const { error: holesErr } = await supabase.from('round_holes').insert(holeInserts);
      if (holesErr) {
        await supabase.from('rounds').delete().eq('id', round.id);
        removeRound(round.id);
        throw holesErr;
      }

      const diagnosis = await analyzeRound(round, profile, rounds.slice(0, 5), effectiveScorecard)
        .catch(() => buildFallbackDiagnostic(round, profile, rounds.slice(0, 5), effectiveScorecard));

      await saveDiagnostic({ userId: user.id, roundId: round.id, result: diagnosis }).catch((e: any) => {
        console.warn('[diagnostic] save failed', e?.message ?? e);
      });

      await clearRoundDraft(user.id);
      setRestoredDraftAt(null);

      router.push({
        pathname: '/diagnostic',
        params: { roundId: round.id, diagnosis: JSON.stringify(diagnosis) },
      });
    } catch (error: any) {
      Alert.alert('Erreur', error?.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardDraft = () => {
    Alert.alert(
      'Effacer le brouillon ?',
      'La saisie trou par trou sauvegardée sera supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            cancelAutoAdvance();
            if (user?.id) void clearRoundDraft(user.id);
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
      ],
    );
  };

  const swipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -50 && canGoNext)     { goToHole(currentHoleNumber + 1); return; }
        if (g.dx >=  50 && canGoPrevious) { goToHole(currentHoleNumber - 1); }
      },
    }),
    [canGoNext, canGoPrevious, currentHoleNumber, scorecard.length],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!draftHydrated) {
    return (
      <View style={styles.container}>
        <DecorativeBackground />
        <View style={styles.loadingView}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  // ── Setup mode ────────────────────────────────────────────────────────────
  if (setupExpanded) {
    return (
      <View style={styles.container}>
        <DecorativeBackground />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.setupContent, { paddingTop: insets.top + 20, paddingBottom: 96 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Text style={styles.setupEyebrow}>Round scoring</Text>
            <Text style={styles.setupTitle}>
              {setupLocked ? courseName.trim() || 'Round en cours' : 'Prépare ta partie'}
            </Text>

            {setupLocked && (
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={() => { cancelAutoAdvance(); animateLayout(); setSetupExpanded(false); }}
              >
                <Text style={styles.resumeBtnLabel}>← Reprendre le round</Text>
              </TouchableOpacity>
            )}

            {/* Draft banner */}
            {restoredDraftAt && (
              <View style={styles.draftBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.draftBannerTitle}>Brouillon restauré</Text>
                  <Text style={styles.draftBannerText}>
                    {restoredDraftLabel ? `Repris le ${restoredDraftLabel}` : 'Repris automatiquement'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleDiscardDraft}>
                  <Text style={styles.draftBannerClear}>Effacer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Holes toggle */}
            {!setupLocked && (
              <View style={styles.setupSection}>
                <Text style={styles.setupLabel}>Format</Text>
                <View style={styles.holesRow}>
                  {([9, 18] as const).map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.holesBtn, holes === value && styles.holesBtnActive]}
                      onPress={() => handleHolesToggle(value)}
                    >
                      <Text style={[styles.holesBtnLabel, holes === value && styles.holesBtnLabelActive]}>
                        {value} trous
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Course search */}
            {!setupLocked && (
              <View style={styles.setupSection}>
                <Text style={styles.setupLabel}>Parcours</Text>
                <CourseSearch
                  value={courseName}
                  onChangeText={handleCourseNameChange}
                  onSelect={handleCourseSelect}
                />
                <Text style={styles.setupHint}>
                  {courseLoading
                    ? 'Chargement du parcours...'
                    : selectedCourse
                      ? `${selectedCourse.city} · ${selectedCourse.region} · ${courseHasOfficialHoleData ? 'données complètes' : 'données partielles'}`
                      : 'Optionnel — la saisie reste disponible sans parcours.'}
                </Text>
              </View>
            )}

            {/* Locked pills */}
            {setupLocked && (
              <View style={styles.lockedRow}>
                <LockedPill label="Parcours" value={courseName.trim() || 'Libre'} />
                <LockedPill label="Format"   value={`${holes} trous`} />
                <LockedPill label="Départ"   value={teeLabel} />
              </View>
            )}

            {/* Notes */}
            <View style={styles.setupSection}>
              <AppInput
                label="Notes"
                hint="Vent, stratégie, feeling."
                value={notes}
                onChangeText={setNotes}
                multiline
                style={styles.notesInput}
              />
            </View>

            {/* CTA */}
            <AppButton
              label={progress.completedHoles > 0
                ? `Reprendre · trou ${currentHoleNumber}`
                : 'Commencer le round →'}
              onPress={() => { cancelAutoAdvance(); animateLayout(); setSetupExpanded(false); }}
              style={styles.startBtn}
            />

            {hasMeaningfulDraft && !setupLocked && (
              <TouchableOpacity style={styles.discardLink} onPress={handleDiscardDraft}>
                <Text style={styles.discardLinkLabel}>Réinitialiser</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Scoring mode ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <DecorativeBackground />

      <View style={styles.scoringLayout}>
        {/* Status bar */}
        <View style={[styles.statusBar, { paddingTop: insets.top + 6 }]}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusCourse} numberOfLines={1}>
              {courseName.trim() || 'Fast score'}
            </Text>
            <Text style={styles.statusMeta}>{holes} trous · départ {teeLabel}</Text>
          </View>
          <View style={styles.statusRight}>
            {progress.completedHoles > 0 && (
              <Text style={[
                styles.statusScore,
                progress.liveScoreToPar < 0 ? styles.statusScoreUnder :
                progress.liveScoreToPar > 0 ? styles.statusScoreOver  :
                styles.statusScoreEven,
              ]}>
                {formatScoreToPar(progress.liveScoreToPar)}
              </Text>
            )}
            <Text style={styles.statusHoles}>
              {progress.completedHoles}/{progress.totalHoles}
            </Text>
            <TouchableOpacity
              style={styles.gearBtn}
              onPress={() => { cancelAutoAdvance(); animateLayout(); setSetupExpanded(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.gearLabel}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hole progress strip */}
        <HoleNavigation
          currentHole={currentHoleNumber}
          scorecard={scorecard}
          onSelectHole={goToHole}
          onPreviousHole={() => goToHole(currentHoleNumber - 1)}
          onNextHole={() => goToHole(currentHoleNumber + 1)}
        />

        {/* Hole info — flex:1, scrollable on tiny screens */}
        {currentHole && currentHoleView ? (
          <>
            <View style={styles.holeArea} {...swipeResponder.panHandlers}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.holeAreaContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
              <HoleOverviewCard
                courseName={courseName.trim()}
                hole={currentHole}
                holeView={currentHoleView}
                teeKey={teeKey}
                teeOptions={teeOptions}
                onSelectTee={(next) => { cancelAutoAdvance(); setTeeKey(next); }}
              />
              </ScrollView>
            </View>

            {/* Score panel pinned above tab bar (tab bar: bottom 12 + height 72 + insets.bottom) */}
            <View style={{ paddingBottom: 96 + insets.bottom }}>
              <HoleScoringPanel
                hole={currentHole}
                canGoNext={canGoNext}
                canSave={canSave}
                loading={loading}
                onApplyScore={handleApplyScore}
                onChangeHole={handleChangeCurrentHole}
                onResetHole={handleResetCurrentHole}
                onNextHole={() => goToHole(currentHoleNumber + 1)}
                onSave={() => void handleSave()}
              />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────

function LockedPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.lockedPill}>
      <Text style={styles.lockedPillLabel}>{label}</Text>
      <Text style={styles.lockedPillValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Loading
  loadingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textDim,
  },

  // ── Setup ──
  setupContent: {
    paddingHorizontal: Spacing.md,
  },
  setupEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  setupTitle: {
    ...Typography.title,
    color: Colors.text,
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  resumeBtn: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
  },
  resumeBtnLabel: {
    ...Typography.bodyStrong,
    color: Colors.primary,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  draftBannerTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  draftBannerText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 2,
  },
  draftBannerClear: {
    ...Typography.label,
    color: Colors.error,
  },
  setupSection: {
    marginBottom: Spacing.lg,
  },
  setupLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  setupHint: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 6,
  },
  holesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  holesBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holesBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  holesBtnLabel: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  holesBtnLabelActive: {
    color: Colors.background,
  },
  lockedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  lockedPill: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    minWidth: '30%',
  },
  lockedPillLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  lockedPillValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: 4,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  startBtn: {
    marginTop: Spacing.sm,
  },
  discardLink: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  discardLinkLabel: {
    ...Typography.label,
    color: Colors.textDim,
  },

  // ── Scoring ──
  scoringLayout: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  statusCourse: {
    ...Typography.heading,
    color: Colors.text,
  },
  statusMeta: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 2,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusScore: {
    ...Typography.titleMd,
    lineHeight: 28,
  },
  statusScoreUnder: { color: Colors.primary },
  statusScoreOver:  { color: Colors.error },
  statusScoreEven:  { color: Colors.text },
  statusHoles: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearLabel: {
    fontSize: 15,
    lineHeight: 17,
  },
  holeArea: {
    flex: 1,
    overflow: 'hidden',
  },
  holeAreaContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
