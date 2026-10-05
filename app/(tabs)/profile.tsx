import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { useRoundsStore } from '../../stores/rounds';
import { useDrillsStore } from '../../stores/drills';
import { useBadgesStore } from '../../stores/badges';
import { useBagStore } from '../../stores/bag';
import { useSubscriptionStore } from '../../stores/subscription';
import {
  GOALS,
  Numerals,
  PLAY_FREQUENCIES,
  PRIVACY_POLICY_URL,
  Spacing,
  TERMS_OF_USE_URL,
  Typography,
} from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { capitalizeFirst, formatHandicapValue, formatSignedFr } from '../../lib/home';
import { countClubs, formatClubCount } from '../../lib/bag';
import { BADGES } from '../../lib/badges';
import { hapticWarning } from '../../lib/haptics';
import { openLegalUrl } from '../../lib/legal';
import { ensureCompletionsLoaded, ensureRoundsLoaded } from '../../lib/ensure-loaded';
import { MANAGE_SUBSCRIPTION_URL } from '../../lib/subscription';
import {
  describeSubscriptionPeriod,
  fetchSubscriptionPeriod,
  type SubscriptionPeriod,
} from '../../lib/subscription-period';
import { AppBadge } from '../../components/ui/AppBadge';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { Icon } from '../../components/ui/Icon';
import { TextAction } from '../../components/ui/TextAction';
import { ThemePreferenceControl } from '../../components/ui/ThemePreferenceControl';
import { StatsStrip } from '../../components/home/StatsStrip';
import {
  getAveragePenaltyCount,
  getAverageScorePer18Holes,
  getAverageScoreToParPer18Holes,
  getBestRound,
  getHandicapIndexCard,
} from '../../lib/rounds';

const PLACEHOLDER = '--';

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuthStore();
  const { rounds, initialized: roundsReady } = useRoundsStore();
  const { getTotalDone, getStreak, initialized: drillsReady } = useDrillsStore();
  const bagCount = useBagStore((state) => (state.loaded ? countClubs(state.distances) : null));
  const loadBag = useBagStore((state) => state.load);
  const trophyCount = useBadgesStore((state) => (state.loaded ? Object.keys(state.earned).length : null));
  const isPremium = useSubscriptionStore((state) => state.isPremium);
  const subscriptionLoading = useSubscriptionStore((state) => state.loading);
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [period, setPeriod] = useState<SubscriptionPeriod | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!isPremium || !userId) {
      setPeriod(null);
      return;
    }

    let active = true;

    void fetchSubscriptionPeriod(userId).then((value) => {
      if (active) setPeriod(value);
    });

    return () => {
      active = false;
    };
  }, [isPremium, userId]);

  useEffect(() => {
    if (userId) void loadBag(userId);
  }, [userId, loadBag]);

  useEffect(() => {
    if (userId && !roundsReady) void ensureRoundsLoaded();
  }, [userId, roundsReady]);

  useEffect(() => {
    if (userId && !drillsReady) void ensureCompletionsLoaded();
  }, [userId, drillsReady]);

  const goalLabel = GOALS.find((goal) => goal.value === profile?.goal)?.label ?? profile?.goal ?? PLACEHOLDER;
  const frequencyLabel = PLAY_FREQUENCIES.find((frequency) => frequency.value === profile?.play_frequency)?.label ?? PLACEHOLDER;
  const handicapIndexCard = getHandicapIndexCard(rounds);
  const bestRound = getBestRound(rounds);
  const averagePenaltyCount = getAveragePenaltyCount(rounds);
  const scoringAverage = getAverageScorePer18Holes(rounds);
  const averageToPar = getAverageScoreToParPer18Holes(rounds);
  const { planLabel, until } = describeSubscriptionPeriod(period);
  const displayName = profile?.display_name ?? 'Joueur';

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: () => {
          hapticWarning();
          void signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.identity}>
          <View style={styles.avatar} accessible={false} importantForAccessibility="no-hide-descendants">
            <Text style={styles.avatarText}>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>
              {displayName}
            </Text>
            <Text style={styles.identitySub}>Handicap déclaré {profile?.handicap ?? PLACEHOLDER}</Text>
          </View>
        </View>

        <StatsStrip
          columns={4}
          items={[
            { label: 'Rounds', value: rounds.length.toString() },
            { label: 'Index estimé', value: formatHandicapValue(handicapIndexCard.value) },
            {
              label: 'Meilleur score',
              value: bestRound ? `${bestRound.total_score}` : PLACEHOLDER,
            },
            { label: 'Jours de série', value: getStreak().toString() },
          ]}
        />

        <Section title="Abonnement">
          <AppCard>
            {isPremium ? (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusTitle}>Premium</Text>
                  <AppBadge label="Actif" tone="good" icon="check" />
                </View>
                {planLabel || until ? (
                  <Text style={styles.statusText}>
                    {planLabel ? [planLabel, until].filter(Boolean).join(' · ') : capitalizeFirst(until ?? '')}
                  </Text>
                ) : null}
                <TextAction
                  label="Gérer mon abonnement"
                  role="link"
                  tone="muted"
                  underline
                  onPress={() => void openLegalUrl(MANAGE_SUBSCRIPTION_URL)}
                  accessibilityHint="Ouvre les réglages d’abonnement Apple"
                />
              </>
            ) : subscriptionLoading ? (
              <Text style={styles.statusText}>Vérification de l’abonnement…</Text>
            ) : (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusTitle}>Gratuit</Text>
                </View>
                <Text style={styles.statusText}>
                  Passe à Premium pour le débrief conversationnel et le coach IA étendu.
                </Text>
                <AppButton
                  label="Voir Premium"
                  variant="secondary"
                  onPress={() => router.push('/paywall' as any)}
                  style={styles.premiumButton}
                />
              </>
            )}
          </AppCard>
        </Section>

        <Section title="Profil de joueur">
          <AppCard style={styles.listCard}>
            <InfoRow label="Objectif" value={goalLabel} first />
            <InfoRow label="Fréquence de jeu" value={frequencyLabel} />
            <LinkRow label="Modifier le profil" onPress={() => router.push('/edit-profile' as any)} />
          </AppCard>
        </Section>

        <Section title="Repères de jeu">
          <AppCard style={styles.listCard}>
            <InfoRow label="Score moyen (18 trous)" value={scoringAverage != null ? `${scoringAverage}`.replace('.', ',') : PLACEHOLDER} first />
            <InfoRow label="Moyenne vs par (18 trous)" value={averageToPar != null ? formatSignedFr(averageToPar) : PLACEHOLDER} />
            <InfoRow label="Pénalités moyennes (18 trous)" value={averagePenaltyCount != null ? `${averagePenaltyCount}`.replace('.', ',') : PLACEHOLDER} />
            <InfoRow label="Exercices réalisés" value={getTotalDone().toString()} />
          </AppCard>
        </Section>

        <Section title="Mon jeu">
          <AppCard style={styles.listCard}>
            <LinkRow
              label="Mon sac"
              value={bagCount != null ? formatClubCount(bagCount) : undefined}
              first
              onPress={() => router.push('/bag' as any)}
            />
            <LinkRow
              label="Trophées"
              value={trophyCount != null ? `${trophyCount} sur ${BADGES.length}` : undefined}
              onPress={() => router.push('/trophies' as any)}
            />
          </AppCard>
        </Section>

        <Section title="Apparence">
          <ThemePreferenceControl />
          <Text style={styles.caption}>Auto suit le réglage de ton téléphone.</Text>
        </Section>

        <Section title="Rappels">
          <AppCard style={styles.listCard}>
            <LinkRow label="Notifications" first onPress={() => router.push('/notifications' as any)} />
          </AppCard>
        </Section>

        <Section title="Informations légales">
          <AppCard style={styles.listCard}>
            <LinkRow
              label="Conditions d’utilisation"
              first
              role="link"
              onPress={() => void openLegalUrl(TERMS_OF_USE_URL)}
            />
            <LinkRow
              label="Politique de confidentialité"
              role="link"
              onPress={() => void openLegalUrl(PRIVACY_POLICY_URL)}
            />
          </AppCard>
        </Section>

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
        >
          <Text style={styles.signOutLabel}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.row, !first && styles.rowDivider]} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function LinkRow({
  label,
  value,
  onPress,
  first = false,
  role = 'button',
}: {
  label: string;
  value?: string;
  onPress: () => void;
  first?: boolean;
  role?: 'button' | 'link';
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      {value ? <Text style={styles.linkValue}>{value}</Text> : null}
      <Icon name="chevron-right" size={20} color={colors.ink3} />
    </Pressable>
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
      gap: Spacing.xl,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...Typography.title,
      color: colors.onInk,
    },
    identityCopy: {
      flex: 1,
    },
    name: {
      ...Typography.title,
      color: colors.ink,
    },
    identitySub: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: 2,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    statusTitle: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    statusText: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xxs,
    },
    premiumButton: {
      marginTop: Spacing.md,
    },
    listCard: {
      paddingVertical: 0,
    },
    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    rowLabel: {
      ...Typography.body,
      color: colors.ink2,
      flex: 1,
    },
    rowValue: {
      ...Typography.bodyStrong,
      ...Numerals,
      color: colors.ink,
      textAlign: 'right',
      flexShrink: 1,
    },
    linkLabel: {
      ...Typography.bodyStrong,
      color: colors.ink,
      flex: 1,
    },
    linkValue: {
      ...Typography.body,
      color: colors.ink2,
      flexShrink: 1,
      textAlign: 'right',
    },
    caption: {
      ...Typography.caption,
      color: colors.ink3,
    },
    signOut: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    pressed: {
      opacity: 0.6,
    },
    signOutLabel: {
      ...Typography.bodyStrong,
      color: colors.error,
    },
    version: {
      ...Typography.caption,
      color: colors.ink3,
      textAlign: 'center',
      marginTop: -Spacing.md,
    },
  });
