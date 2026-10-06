import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useAuthStore } from '../../stores/auth';
import { useRoundsStore } from '../../stores/rounds';
import { useCourseMemoryStore } from '../../stores/course-memory';
import {
  AiCoachLimitError,
  analyzeRound,
  buildFallbackDiagnostic,
  type DiagnosticResult,
} from '../../lib/claude';
import { DIAGNOSTIC_SAVE_FAILED_MESSAGE, persistDiagnostic } from '../../lib/diagnostics';
import { buildDiagnosticParams } from '../../lib/diagnostic-shape';
import { CourseSearch } from '../../components/ui/CourseSearch';
import { HoleNavigation } from '../../components/rounds/HoleNavigation';
import { HoleOverviewCard } from '../../components/rounds/HoleOverviewCard';
import { HoleActionBar, HoleScoringPanel } from '../../components/rounds/HoleScoringPanel';
import { RecentCourses } from '../../components/rounds/RecentCourses';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { ChoiceTile } from '../../components/ui/ChoiceTile';
import { Icon } from '../../components/ui/Icon';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import {
  createPlaceholderCourse,
  getCourseById,
  getCourseParSequence,
  getDefaultTeeKey,
  getKnownCourse,
  getParForHoles,
  getTeeOptions,
  getValidTeeKey,
  hasCompleteCourseHoleDetails,
  type GolfCourse,
  type TeeKey,
} from '../../lib/golf-courses';
import { awardAfterRound } from '../../lib/badge-awards';
import { requestReviewAfterRound } from '../../lib/review-prompt';
import { buildHoleViewData } from '../../lib/hole-view';
import { getGreenDistances } from '../../lib/gps';
import { useClubAdvice } from '../../lib/use-club-advice';
import { clearRoundDraft, loadRoundDraft, saveRoundDraft } from '../../lib/round-draft';
import { getRememberedTee } from '../../lib/course-memory';
import { buildRecentCourses, getCourseKey, type RecentCourse } from '../../lib/recent-courses';
import { ensureRoundsLoaded } from '../../lib/ensure-loaded';
import { describeToPar, formatHolesPlayed, formatScoreToPar } from '../../lib/score-labels';
import { hapticSuccess, hapticWarning } from '../../lib/haptics';
import { formatTeeName } from '../../lib/tee-names';
import {
  buildSaveRoundArgs,
  createClientRequestId,
  getErrorCode,
  saveRound,
  type SaveRoundArgs,
} from '../../lib/round-save';
import { QUEUED_ROUND_TEXT, QUEUED_ROUND_TITLE, resolveSaveFailure } from '../../lib/round-save-flow';
import { useRoundQueueStore } from '../../stores/round-queue';
import { useBadgesStore } from '../../stores/badges';
import type { Round, RoundDraftHole } from '../../types';
import {
  aggregateScorecard,
  applyParSequenceToScorecard,
  applyTargetParToScorecard,
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

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export default function RoundScreen() {
  const { user, profile } = useAuthStore();
  const { upsertRound, rounds, initialized: roundsReady } = useRoundsStore();
  const courseMemoryReady = useCourseMemoryStore((state) => state.loaded);
  const loadCourseMemory  = useCourseMemoryStore((state) => state.load);
  const rememberCourse    = useCourseMemoryStore((state) => state.remember);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [courseName, setCourseName]         = useState('');
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [holes, setHoles]                   = useState<9 | 18>(18);
  const [teeKey, setTeeKey]                 = useState<TeeKey>(getDefaultTeeKey());
  const [currentHoleNumber, setCurrentHoleNumber] = useState(1);
  const [scorecard, setScorecard]           = useState<RoundDraftHole[]>(() => createDefaultScorecard(18));
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [analyzing, setAnalyzing]           = useState(false);
  const [queuedNotice, setQueuedNotice]     = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() => createClientRequestId());
  const [courseLoading, setCourseLoading]   = useState(false);
  const [draftHydrated, setDraftHydrated]   = useState(false);
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(null);
  const [setupExpanded, setSetupExpanded]   = useState(true);
  const [gpsPermission, setGpsPermission]   = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [livePosition, setLivePosition]     = useState<{ latitude: number; longitude: number } | null>(null);
  const courseRequestRef  = useRef(0);
  const savingRef         = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holeScrollRef     = useRef<ScrollView>(null);

  const progress   = useMemo(() => getScorecardProgress(scorecard), [scorecard]);
  const aggregate  = useMemo(() => aggregateScorecard(scorecard), [scorecard]);
  const teeOptions = useMemo(() => getTeeOptions(selectedCourse), [selectedCourse]);
  const recentCourses = useMemo(() => buildRecentCourses(rounds), [rounds]);
  const courseMemoryKey = useMemo(
    () => (selectedCourse ? getCourseKey(selectedCourse.id, selectedCourse.name) : null),
    [selectedCourse],
  );
  const courseHasOfficialHoleData = useMemo(
    () => selectedCourse ? hasCompleteCourseHoleDetails(selectedCourse, holes) : false,
    [holes, selectedCourse],
  );
  const holeViews = useMemo(
    () => buildHoleViewData({ course: selectedCourse, scorecard }),
    [scorecard, selectedCourse],
  );
  const courseHasAnyGpsData = useMemo(
    () => holeViews.some((hole) => hole.gpsAvailable),
    [holeViews],
  );

  const currentHole     = scorecard[currentHoleNumber - 1];
  const currentHoleView = holeViews[currentHoleNumber - 1];
  const liveGreenDistances = useMemo(
    () => getGreenDistances(currentHoleView?.gpsPoints, livePosition),
    [currentHoleView, livePosition],
  );
  const clubAdvice = useClubAdvice(liveGreenDistances?.center);
  const gpsHintLabel = useMemo(() => {
    if (!currentHoleView?.gpsAvailable) return null;
    if (gpsPermission === 'denied') return 'Active la localisation pour les distances réelles.';
    if (gpsPermission === 'granted' && !livePosition) return 'Recherche du signal GPS…';
    return null;
  }, [currentHoleView, gpsPermission, livePosition]);
  const teeLabel        = formatTeeName(teeOptions.find((tee) => tee.key === teeKey)?.label ?? teeOptions[0]?.label ?? teeKey);
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
    if (hasMeaningfulDraft) setQueuedNotice(false);
  }, [hasMeaningfulDraft]);

  useEffect(() => {
    holeScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentHoleNumber]);

  useEffect(() => {
    setTeeKey((current) => getValidTeeKey(selectedCourse, current));
  }, [selectedCourse]);

  useEffect(() => {
    if (user?.id) void loadCourseMemory(user.id);
  }, [user?.id, loadCourseMemory]);

  useEffect(() => {
    if (user?.id && !roundsReady) void ensureRoundsLoaded();
  }, [user?.id, roundsReady]);

  useEffect(() => {
    if (setupExpanded || !courseMemoryKey || !courseMemoryReady) return;
    rememberCourse(courseMemoryKey, { teeKey, holes });
  }, [setupExpanded, courseMemoryKey, courseMemoryReady, teeKey, holes, rememberCourse]);

  useEffect(() => {
    if (setupExpanded && progress.completedHoles > 0) {
      animateLayout();
      setSetupExpanded(false);
    }
  }, [progress.completedHoles, setupExpanded]);

  useFocusEffect(
    useCallback(() => {
      if (setupExpanded || !courseHasAnyGpsData) return;

      let cancelled = false;
      let subscription: Location.LocationSubscription | null = null;

      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          setGpsPermission(status === 'granted' ? 'granted' : 'denied');
          if (status !== 'granted') return;

          const sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
            (location) => {
              setLivePosition({ latitude: location.coords.latitude, longitude: location.coords.longitude });
            },
          );

          if (cancelled) { sub.remove(); return; }
          subscription = sub;
        } catch {
          if (!cancelled) setGpsPermission('denied');
        }
      })();

      return () => {
        cancelled = true;
        subscription?.remove();
      };
    }, [setupExpanded, courseHasAnyGpsData]),
  );

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
      if (draft.clientRequestId) setClientRequestId(draft.clientRequestId);
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
        clientRequestId,
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    clientRequestId, courseName, currentHoleNumber, draftHydrated, hasMeaningfulDraft,
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
    const courseKey = getCourseKey(course.id, course.name);
    const remembered = courseKey ? useCourseMemoryStore.getState().entries[courseKey] : undefined;
    const nextHoles = remembered?.holes ?? holes;
    const pickTee = (target: GolfCourse, curr: TeeKey) =>
      getRememberedTee(remembered, getTeeOptions(target)) ?? getValidTeeKey(target, curr);
    const firstTee = pickTee(course, teeKey);
    setCourseName(course.name);
    setSelectedCourse(course);
    setHoles(nextHoles);
    setTeeKey(firstTee);
    handleApplyCoursePar(nextHoles, course);
    setCourseLoading(true);
    try {
      const resolved = await getCourseById(course.id);
      if (courseRequestRef.current !== reqId || !resolved) return;
      setSelectedCourse(resolved);
      // A tee tapped while the course was loading wins over the remembered one.
      setTeeKey((curr) => (curr === firstTee ? pickTee(resolved, curr) : getValidTeeKey(resolved, curr)));
      handleApplyCoursePar(nextHoles, resolved);
    } finally {
      if (courseRequestRef.current === reqId) setCourseLoading(false);
    }
  };

  const handleRecentCourseSelect = (recent: RecentCourse) => {
    void handleCourseSelect(getKnownCourse(recent.courseId) ?? createPlaceholderCourse(recent.name, recent.courseId));
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

  const resetForm = () => {
    cancelAutoAdvance();
    setCourseName('');
    setSelectedCourse(null);
    setHoles(18);
    setTeeKey(getDefaultTeeKey());
    setCurrentHoleNumber(1);
    setScorecard(createDefaultScorecard(18));
    setNotes('');
    setRestoredDraftAt(null);
    setLivePosition(null);
    setSetupExpanded(true);
    setClientRequestId(createClientRequestId());
  };

  const handleSave = async (scorecardOverride?: RoundDraftHole[]) => {
    if (savingRef.current) return;

    if (!user || !profile) {
      Alert.alert('Erreur', 'Session introuvable. Reconnecte-toi puis réessaie.');
      return;
    }
    const effectiveScorecard = scorecardOverride ?? scorecard;
    const err = validateScorecard(effectiveScorecard);
    if (err) { Alert.alert('Erreur', err); return; }

    savingRef.current = true;
    cancelAutoAdvance();
    setLoading(true);

    const userId = user.id;
    const previousRounds = rounds.slice(0, 5);
    let round: Round;
    let saveArgs: SaveRoundArgs | null = null;

    try {
      const isCatalog       = selectedCourse != null && !selectedCourse.id.startsWith('custom-');
      const selectedTeeOpt  = teeOptions.find((t) => t.key === teeKey) ?? null;

      saveArgs = buildSaveRoundArgs({
        clientRequestId,
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
      round = await saveRound(saveArgs);
    } catch (error) {
      const failedArgs = saveArgs;
      const resolution = await resolveSaveFailure(
        error,
        async () => (failedArgs ? useRoundQueueStore.getState().enqueue(userId, failedArgs) : 'storage'),
      );

      if (resolution.queued) {
        hapticSuccess();
        resetForm();
        setQueuedNotice(true);

        try {
          await clearRoundDraft(userId);
        } catch (clearError) {
          console.warn('[round-draft] clear failed', getErrorCode(clearError));
        }
      } else {
        Alert.alert('Erreur', resolution.message);
      }

      savingRef.current = false;
      setLoading(false);
      return;
    }

    upsertRound(round);
    hapticSuccess();
    void awardAfterRound(round, effectiveScorecard).then(() =>
      requestReviewAfterRound({
        saveOutcome: 'online',
        getSavedRoundCount: () => useRoundsStore.getState().rounds.length,
        isCelebrationPending: () => useBadgesStore.getState().queue.length > 0,
      }),
    );
    resetForm();
    setAnalyzing(true);

    try {
      await clearRoundDraft(userId);
    } catch (clearError) {
      console.warn('[round-draft] clear failed', getErrorCode(clearError));
    }

    try {
      let diagnosis: DiagnosticResult;
      let isFallback = false;

      try {
        diagnosis = await analyzeRound(round, profile, previousRounds, effectiveScorecard);
      } catch (analysisError) {
        if (analysisError instanceof AiCoachLimitError) {
          Alert.alert('Limite atteinte', analysisError.message);
        }

        diagnosis = buildFallbackDiagnostic(round, profile, previousRounds, effectiveScorecard);
        isFallback = true;
      }

      const outcome = await persistDiagnostic({ userId, roundId: round.id, result: diagnosis, isFallback });
      if (outcome === 'failed') {
        Alert.alert('Diagnostic non enregistré', DIAGNOSTIC_SAVE_FAILED_MESSAGE);
      }

      router.push({
        pathname: '/diagnostic',
        params: buildDiagnosticParams({ roundId: round.id, diagnosis, isFallback }),
      });
    } catch (analysisFlowError) {
      console.warn('[round] post-save analysis failed', getErrorCode(analysisFlowError));
      Alert.alert(
        'Round enregistré',
        'Ton round est bien enregistré, mais le diagnostic n’a pas pu être généré. Tu peux le relancer depuis le détail du round.',
      );
    } finally {
      savingRef.current = false;
      setAnalyzing(false);
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
            hapticWarning();
            if (user?.id) void clearRoundDraft(user.id);
            resetForm();
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
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.setupContent, { paddingTop: insets.top + Spacing.lg }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.setupTitle} accessibilityRole="header">
              {setupLocked ? courseName.trim() || 'Round en cours' : 'Prépare ta partie'}
            </Text>

            {analyzing && (
              <View style={[styles.banner, styles.bannerGood]} accessibilityLiveRegion="polite">
                <Icon name="check" size={20} color={colors.green} />
                <View style={styles.bannerBody}>
                  <Text style={styles.bannerTitle}>Round enregistré</Text>
                  <Text style={styles.bannerText}>Analyse du round en cours…</Text>
                </View>
              </View>
            )}

            {queuedNotice && (
              <View style={[styles.banner, styles.bannerGood]} accessibilityLiveRegion="polite">
                <Icon name="check" size={20} color={colors.green} />
                <View style={styles.bannerBody}>
                  <Text style={styles.bannerTitle}>{QUEUED_ROUND_TITLE}</Text>
                  <Text style={styles.bannerText}>{QUEUED_ROUND_TEXT}</Text>
                </View>
              </View>
            )}

            {setupLocked && (
              <Pressable
                style={styles.resumeBtn}
                onPress={() => { cancelAutoAdvance(); animateLayout(); setSetupExpanded(false); }}
                accessibilityRole="button"
                accessibilityLabel="Reprendre le round"
              >
                <Icon name="chevron-left" size={20} color={colors.ink2} />
                <Text style={styles.resumeBtnLabel}>Reprendre le round</Text>
              </Pressable>
            )}

            {restoredDraftAt && (
              <View style={styles.banner}>
                <View style={styles.bannerBody}>
                  <Text style={styles.bannerTitle}>Brouillon restauré</Text>
                  <Text style={styles.bannerText}>
                    {restoredDraftLabel ? `Repris le ${restoredDraftLabel}` : 'Repris automatiquement'}
                  </Text>
                </View>
                <Pressable
                  style={styles.bannerAction}
                  onPress={handleDiscardDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Effacer le brouillon"
                >
                  <Text style={styles.bannerActionLabel}>Effacer</Text>
                </Pressable>
              </View>
            )}

            {!setupLocked && (
              <View style={styles.setupSection}>
                <Text style={styles.setupLabel}>Format</Text>
                <SegmentedControl
                  accessibilityLabel="Nombre de trous"
                  options={[
                    { value: '9', label: '9 trous' },
                    { value: '18', label: '18 trous' },
                  ]}
                  value={String(holes)}
                  onChange={(value) => handleHolesToggle(value === '9' ? 9 : 18)}
                />
              </View>
            )}

            {!setupLocked && (
              <View style={[styles.setupSection, styles.courseSection]}>
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
                {courseName.trim().length === 0 && (
                  <RecentCourses courses={recentCourses} onSelect={handleRecentCourseSelect} />
                )}
              </View>
            )}

            {!setupLocked && selectedCourse && teeOptions.length > 1 && (
              <View style={styles.setupSection} accessibilityRole="radiogroup" accessibilityLabel="Départ">
                <Text style={styles.setupLabel}>Départ</Text>
                {teeOptions.map((tee) => (
                  <ChoiceTile
                    key={tee.key}
                    label={formatTeeName(tee.label)}
                    selected={tee.key === teeKey}
                    onPress={() => { cancelAutoAdvance(); setTeeKey(tee.key); }}
                  />
                ))}
              </View>
            )}

            {setupLocked && (
              <View style={styles.lockedCard}>
                <LockedRow label="Parcours" value={courseName.trim() || 'Libre'} />
                <LockedRow label="Format" value={`${holes} trous`} />
                <LockedRow label="Départ" value={teeLabel} last />
              </View>
            )}

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

            <AppButton
              label={progress.completedHoles > 0
                ? `Reprendre · trou ${currentHoleNumber}`
                : 'Commencer le round'}
              icon="chevron-right"
              iconPosition="right"
              onPress={() => { cancelAutoAdvance(); animateLayout(); setSetupExpanded(false); }}
              style={styles.startBtn}
            />

            {hasMeaningfulDraft && !setupLocked && (
              <Pressable
                style={styles.discardLink}
                onPress={handleDiscardDraft}
                accessibilityRole="button"
                accessibilityLabel="Réinitialiser la saisie"
              >
                <Text style={styles.discardLinkLabel}>Réinitialiser</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Scoring mode ──────────────────────────────────────────────────────────
  const toParValue = progress.completedHoles > 0 ? formatScoreToPar(progress.liveScoreToPar) : '–';
  const toParLabel = progress.completedHoles > 0
    ? `${describeToPar(progress.liveScoreToPar)} ${formatHolesPlayed(progress.completedHoles)}`
    : 'Aucun trou joué';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerCourse} numberOfLines={1} accessibilityRole="header">
            {courseName.trim() || 'Score rapide'}
          </Text>
          <Text style={styles.headerMeta} numberOfLines={1}>{holes} trous · départ {teeLabel}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.toPar} accessible accessibilityLabel={toParLabel}>
            <Text style={styles.toParValue}>{toParValue}</Text>
            <Text style={styles.toParCaption}>{formatHolesPlayed(progress.completedHoles)}</Text>
          </View>
          <Pressable
            style={styles.gearBtn}
            onPress={() => { cancelAutoAdvance(); animateLayout(); setSetupExpanded(true); }}
            accessibilityRole="button"
            accessibilityLabel="Réglages du round"
          >
            <Icon name="settings" size={22} color={colors.ink2} />
          </Pressable>
        </View>
      </View>

      <HoleNavigation
        currentHole={currentHoleNumber}
        scorecard={scorecard}
        onSelectHole={goToHole}
      />

      {currentHole && currentHoleView ? (
        <>
          <View style={styles.holeArea} {...swipeResponder.panHandlers}>
            <ScrollView
              ref={holeScrollRef}
              style={styles.flex}
              contentContainerStyle={styles.holeAreaContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <HoleOverviewCard
                hole={currentHole}
                holeView={currentHoleView}
                teeKey={teeKey}
                teeOptions={teeOptions}
                onSelectTee={(next) => { cancelAutoAdvance(); setTeeKey(next); }}
                liveGreenDistances={liveGreenDistances}
                gpsHintLabel={gpsHintLabel}
                clubAdvice={clubAdvice}
              />
              <HoleScoringPanel
                hole={currentHole}
                onApplyScore={handleApplyScore}
                onChangeHole={handleChangeCurrentHole}
                onResetHole={handleResetCurrentHole}
              />
            </ScrollView>
          </View>

          <HoleActionBar
            hole={currentHole}
            canGoNext={canGoNext}
            canSave={canSave}
            loading={loading}
            remainingHoles={progress.remainingHoles}
            onNextHole={() => goToHole(currentHoleNumber + 1)}
            onSave={() => void handleSave()}
          />
        </>
      ) : null}
    </View>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────

function LockedRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.lockedRow, !last && styles.lockedRowDivider]} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.lockedLabel}>{label}</Text>
      <Text style={styles.lockedValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },

    loadingView: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      ...Typography.body,
      color: colors.ink3,
    },

    setupContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    setupTitle: {
      ...Typography.title,
      color: colors.ink,
      marginBottom: Spacing.lg,
    },
    resumeBtn: {
      alignSelf: 'flex-start',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginLeft: -4,
      marginBottom: Spacing.sm,
    },
    resumeBtnLabel: {
      ...Typography.bodyStrong,
      color: colors.ink2,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingVertical: Spacing.sm,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    bannerGood: {
      borderColor: colors.greenBg,
      backgroundColor: colors.greenBg,
      paddingRight: Spacing.md,
    },
    bannerBody: {
      flex: 1,
    },
    bannerTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    bannerText: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: 2,
    },
    bannerAction: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerActionLabel: {
      ...Typography.bodyStrong,
      color: colors.error,
    },
    setupSection: {
      marginBottom: Spacing.lg,
    },
    courseSection: {
      zIndex: 10,
    },
    setupLabel: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: Spacing.xs,
    },
    setupHint: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: 6,
    },
    lockedCard: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.lg,
    },
    lockedRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    lockedRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    lockedLabel: {
      ...Typography.body,
      color: colors.ink3,
    },
    lockedValue: {
      ...Typography.bodyStrong,
      flex: 1,
      textAlign: 'right',
      color: colors.ink,
    },
    notesInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    startBtn: {
      marginTop: Spacing.sm,
    },
    discardLink: {
      alignSelf: 'center',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    discardLinkLabel: {
      ...Typography.bodyStrong,
      color: colors.ink2,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.xs,
      paddingBottom: Spacing.xs,
    },
    headerLeft: {
      flex: 1,
      paddingTop: Spacing.xxs,
    },
    headerCourse: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    headerMeta: {
      ...Typography.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink2,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    toPar: {
      alignItems: 'flex-end',
      paddingTop: Spacing.xxs,
      paddingRight: Spacing.xs,
    },
    toParValue: {
      ...Typography.title,
      ...Numerals,
      color: colors.ink,
    },
    toParCaption: {
      ...Typography.caption,
      color: colors.ink3,
    },
    gearBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    holeArea: {
      flex: 1,
    },
    holeAreaContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.lg,
      gap: Spacing.lg,
    },
  });
