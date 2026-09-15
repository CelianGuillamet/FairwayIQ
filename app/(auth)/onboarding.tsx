import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { Colors, HANDICAP_LEVELS, PLAY_FREQUENCIES, GOALS } from '../../constants';
import { requestNotificationPermissions, scheduleWeeklyNotifications } from '../../lib/notifications';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { ChoiceTile } from '../../components/ui/ChoiceTile';


const STEPS = ['name', 'level', 'frequency', 'goal'] as const;
type Step = typeof STEPS[number];

const STEP_CONTENT: Record<Step, { eyebrow: string; title: string; subtitle: string; icon: string }> = {
  name: {
    eyebrow: 'Étape 1',
    title: 'Présente-toi',
    subtitle: 'On personnalise les messages, le ton et les recommandations dès le départ.',
    icon: '✦',
  },
  level: {
    eyebrow: 'Étape 2',
    title: 'Calibrons ton niveau',
    subtitle: 'Un handicap approximatif suffit pour adapter les diagnostics et les drills.',
    icon: '🏌️',
  },
  frequency: {
    eyebrow: 'Étape 3',
    title: 'Comprendre ton rythme',
    subtitle: 'La fréquence de jeu permet de proposer un coaching réaliste et tenable.',
    icon: '◔',
  },
  goal: {
    eyebrow: 'Étape 4',
    title: 'Choisir le bon cap',
    subtitle: 'On priorisera ensuite les leviers les plus utiles pour ton jeu.',
    icon: '◎',
  },
};

export default function OnboardingScreen() {
  const { user, fetchProfile, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('name');
  const [displayName, setDisplayName] = useState('');
  const [handicap, setHandicap] = useState<number | null>(null);
  const [playFrequency, setPlayFrequency] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentIndex = STEPS.indexOf(step);
  const progress = (currentIndex + 1) / STEPS.length;
  const stepContent = STEP_CONTENT[step];

  const selectedSummary = useMemo(() => ({
    handicap: HANDICAP_LEVELS.find((level) => level.value === handicap)?.label ?? 'À définir',
    frequency: PLAY_FREQUENCIES.find((item) => item.value === playFrequency)?.label ?? 'À définir',
    goal: GOALS.find((item) => item.value === goal)?.label ?? 'À définir',
  }), [goal, handicap, playFrequency]);

  const canAdvance = () => {
    if (step === 'name') return displayName.trim().length >= 2;
    if (step === 'level') return handicap !== null;
    if (step === 'frequency') return playFrequency !== null;
    if (step === 'goal') return goal !== null;
    return false;
  };

  const handleNext = async () => {
    if (step !== 'goal') {
      setStep(STEPS[currentIndex + 1]);
      return;
    }
    if (!user || handicap === null || !playFrequency || !goal) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      user_id: user.id,
      display_name: displayName.trim(),
      handicap,
      play_frequency: playFrequency,
      goal,
      onboarding_complete: true,
    }, { onConflict: 'user_id' });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      await fetchProfile();
      const granted = await requestNotificationPermissions();
      if (granted) await scheduleWeeklyNotifications();
      router.replace('/paywall' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DecorativeBackground />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>Configuration joueur</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              Étape {currentIndex + 1} / {STEPS.length}
            </Text>
          </View>

          {currentIndex === 0 ? (
            <TouchableOpacity style={styles.signOutLink} onPress={signOut}>
              <Text style={styles.signOutLinkText}>Se déconnecter</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <AppCard accent="highlight" style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{stepContent.icon}</Text>
          </View>
          <Text style={styles.heroEyebrow}>{stepContent.eyebrow}</Text>
          <Text style={styles.heroTitle}>{stepContent.title}</Text>
          <Text style={styles.heroSubtitle}>{stepContent.subtitle}</Text>
        </AppCard>

        <AppCard style={styles.stepCard}>
          {step === 'name' ? (
            <AppInput
              label="Prénom"
              placeholder="Ton prénom"
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              autoCapitalize="words"
              hint="Utilisé pour personnaliser les messages et les débriefs."
            />
          ) : null}

          {step === 'level'
            ? HANDICAP_LEVELS.map((level) => (
                <ChoiceTile
                  key={level.value}
                  label={level.label}
                  selected={handicap === level.value}
                  onPress={() => setHandicap(level.value)}
                />
              ))
            : null}

          {step === 'frequency'
            ? PLAY_FREQUENCIES.map((frequency) => (
                <ChoiceTile
                  key={frequency.value}
                  label={frequency.label}
                  selected={playFrequency === frequency.value}
                  onPress={() => setPlayFrequency(frequency.value)}
                />
              ))
            : null}

          {step === 'goal'
            ? GOALS.map((currentGoal) => (
                <ChoiceTile
                  key={currentGoal.value}
                  label={currentGoal.label}
                  selected={goal === currentGoal.value}
                  onPress={() => setGoal(currentGoal.value)}
                />
              ))
            : null}
        </AppCard>

        <AppCard accent="soft" style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Résumé du profil</Text>
          <SummaryRow label="Joueur" value={displayName.trim() || 'À définir'} />
          <SummaryRow label="Niveau" value={selectedSummary.handicap} />
          <SummaryRow label="Fréquence" value={selectedSummary.frequency} />
          <SummaryRow label="Objectif" value={selectedSummary.goal} />
        </AppCard>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {currentIndex > 0 ? (
          <AppButton
            label="Retour"
            variant="secondary"
            onPress={() => setStep(STEPS[currentIndex - 1])}
            style={styles.secondaryAction}
          />
        ) : null}
        <AppButton
          label={loading ? 'Chargement...' : step === 'goal' ? 'Terminer' : 'Continuer'}
          onPress={() => void handleNext()}
          disabled={!canAdvance()}
          loading={loading}
          style={styles.primaryAction}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  progressWrap: {
    flex: 1,
  },
  progressLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: 999,
  },
  progressText: {
    color: Colors.textDim,
    fontSize: 12,
    marginTop: 8,
  },
  signOutLink: {
    paddingTop: 2,
  },
  signOutLinkText: {
    color: Colors.textDim,
    fontSize: 13,
  },
  heroCard: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroBadgeText: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  heroEyebrow: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  stepCard: {
    marginBottom: 16,
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
    paddingLeft: 12,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    backgroundColor: Colors.background,
  },
  secondaryAction: {
    flex: 1,
  },
  primaryAction: {
    flex: 2,
  },
});
