import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth';
import { HANDICAP_LEVELS, PLAY_FREQUENCIES, GOALS, Radius, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { ChoiceTile } from '../../components/ui/ChoiceTile';
import { Icon, type IconName } from '../../components/ui/Icon';


const STEPS = ['name', 'level', 'frequency', 'goal'] as const;
type Step = typeof STEPS[number];

const STEP_CONTENT: Record<Step, { title: string; subtitle: string; icon: IconName }> = {
  name: {
    title: 'Présente-toi',
    subtitle: 'On personnalise les messages, le ton et les recommandations dès le départ.',
    icon: 'user',
  },
  level: {
    title: 'Calibrons ton niveau',
    subtitle: 'Un handicap approximatif suffit pour adapter les diagnostics et les drills.',
    icon: 'flag',
  },
  frequency: {
    title: 'Comprendre ton rythme',
    subtitle: 'La fréquence de jeu permet de proposer un coaching réaliste et tenable.',
    icon: 'clock',
  },
  goal: {
    title: 'Choisir le bon cap',
    subtitle: 'On priorisera ensuite les leviers les plus utiles pour ton jeu.',
    icon: 'target',
  },
};

export default function OnboardingScreen() {
  const { user, completeOnboarding, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [step, setStep] = useState<Step>('name');
  const [displayName, setDisplayName] = useState('');
  const [handicap, setHandicap] = useState<number | null>(null);
  const [playFrequency, setPlayFrequency] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentIndex = STEPS.indexOf(step);
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
    if (loading) return;
    setLoading(true);
    try {
      const outcome = await completeOnboarding({
        display_name: displayName.trim(),
        handicap,
        play_frequency: playFrequency,
        goal,
      });

      if (outcome === 'already_complete') {
        Alert.alert('Profil déjà configuré', 'Ton profil existe déjà, il n’a pas été modifié.');
        router.replace('/');
        return;
      }

      router.replace('/paywall' as any);
    } catch (error: any) {
      Alert.alert('Erreur', error?.message ?? 'Impossible d’enregistrer ton profil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>Configuration joueur</Text>
            <View
              style={styles.progressTrack}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Étape ${currentIndex + 1} sur ${STEPS.length}`}
              accessibilityValue={{ min: 1, max: STEPS.length, now: currentIndex + 1 }}
            >
              {STEPS.map((item, index) => (
                <View
                  key={item}
                  style={[styles.progressSegment, index <= currentIndex && styles.progressSegmentDone]}
                />
              ))}
            </View>
            <Text style={styles.progressText}>
              Étape {currentIndex + 1} / {STEPS.length}
            </Text>
          </View>

          {currentIndex === 0 ? (
            <Pressable
              style={styles.signOutLink}
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Se déconnecter"
            >
              <Text style={styles.signOutLinkText}>Se déconnecter</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Icon name={stepContent.icon} size={24} color={colors.ink} />
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {stepContent.title}
          </Text>
          <Text style={styles.heroSubtitle}>{stepContent.subtitle}</Text>
        </View>

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
          <Text style={styles.summaryTitle} accessibilityRole="header">
            Résumé du profil
          </Text>
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
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.summaryRow} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
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
      marginBottom: 24,
    },
    progressWrap: {
      flex: 1,
    },
    progressLabel: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: 8,
    },
    progressTrack: {
      flexDirection: 'row',
      gap: 5,
    },
    progressSegment: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.sunk,
    },
    progressSegmentDone: {
      backgroundColor: colors.green,
    },
    progressText: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: 8,
    },
    signOutLink: {
      minHeight: 44,
      justifyContent: 'center',
    },
    signOutLinkText: {
      ...Typography.label,
      color: colors.ink2,
      textDecorationLine: 'underline',
    },
    hero: {
      marginBottom: 20,
    },
    heroBadge: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: colors.sunk,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    heroTitle: {
      ...Typography.title,
      color: colors.ink,
    },
    heroSubtitle: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: 8,
    },
    stepCard: {
      marginBottom: 16,
    },
    summaryCard: {
      marginBottom: 12,
    },
    summaryTitle: {
      ...Typography.heading,
      color: colors.ink,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    summaryLabel: {
      ...Typography.body,
      color: colors.ink2,
    },
    summaryValue: {
      ...Typography.bodyStrong,
      color: colors.ink,
      flexShrink: 1,
      textAlign: 'right',
      paddingLeft: 12,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 16,
      gap: 12,
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    secondaryAction: {
      flex: 1,
    },
    primaryAction: {
      flex: 2,
    },
  });
