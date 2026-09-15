import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { useRoundsStore } from '../../stores/rounds';
import { useDrillsStore } from '../../stores/drills';
import { Colors, GOALS, PLAY_FREQUENCIES, Spacing, Typography } from '../../constants';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppBadge } from '../../components/ui/AppBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  getAveragePenaltyCount,
  getBestRound,
  getEstimatedHandicap,
} from '../../lib/rounds';

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { rounds } = useRoundsStore();
  const { getTotalDone, getStreak } = useDrillsStore();
  const insets = useSafeAreaInsets();

  const goalLabel = GOALS.find((goal) => goal.value === profile?.goal)?.label ?? profile?.goal ?? '--';
  const frequencyLabel = PLAY_FREQUENCIES.find((frequency) => frequency.value === profile?.play_frequency)?.label ?? '--';
  const estimatedHandicap = getEstimatedHandicap(rounds);
  const bestRound = getBestRound(rounds);
  const averagePenaltyCount = getAveragePenaltyCount(rounds);
  const scoringAverage = average(rounds.map((round) => round.total_score));
  const averageToPar = average(rounds.map((round) => round.total_score - round.par));

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <PageHeader
          eyebrow="Profil joueur"
          title={profile?.display_name ?? 'Joueur'}
          subtitle={`Handicap déclaré ${profile?.handicap ?? '--'} · ${frequencyLabel}`}
          trailing={<AppBadge label="Profil" tone="primary" />}
        />

        <AppCard accent="highlight" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroName}>{profile?.display_name ?? 'Joueur'}</Text>
              <Text style={styles.heroSub}>Objectif: {goalLabel}</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <AppButton label="Modifier le profil" variant="secondary" onPress={() => router.push('/edit-profile' as any)} style={styles.heroButton} />
            <AppButton label="Voir Premium" onPress={() => router.push('/paywall' as any)} style={styles.heroButton} />
          </View>
        </AppCard>

        <View style={styles.metricsGrid}>
          <MetricCard label="Rounds" value={rounds.length.toString()} helper="historique" />
          <MetricCard label="Handicap estimé" value={estimatedHandicap != null ? estimatedHandicap.toString() : '--'} helper="récents" />
          <MetricCard label="Meilleur score" value={bestRound ? `${bestRound.total_score}` : '--'} helper={bestRound ? `${bestRound.total_score - bestRound.par > 0 ? '+' : ''}${bestRound.total_score - bestRound.par}` : '—'} />
          <MetricCard label="Streak drills" value={getStreak().toString()} helper="jours" />
        </View>

        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Repères de jeu</Text>
          <InfoRow label="Score moyen" value={scoringAverage != null ? `${scoringAverage}` : '--'} />
          <InfoRow label="Moyenne vs par" value={averageToPar != null ? `${averageToPar > 0 ? '+' : ''}${averageToPar}` : '--'} />
          <InfoRow label="Pénalités moyennes" value={averagePenaltyCount != null ? `${averagePenaltyCount}` : '--'} />
          <InfoRow label="Drills complétés" value={getTotalDone().toString()} />
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Profil joueur</Text>
          <InfoRow label="Objectif" value={goalLabel} />
          <InfoRow label="Fréquence de jeu" value={frequencyLabel} />
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Application</Text>
          <InfoRow label="Abonnement" value="Premium disponible" accent />
          <InfoRow label="Version" value="1.0.0" />
        </AppCard>

        <AppButton label="Se déconnecter" variant="secondary" onPress={handleSignOut} style={styles.signOutButton} />
      </ScrollView>
    </View>
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

function InfoRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && styles.infoValueAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 110,
  },
  heroCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.display,
    color: Colors.background,
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  heroSub: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 4,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  heroButton: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
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
  section: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  infoLabel: {
    ...Typography.body,
    color: Colors.textMuted,
    flex: 1,
  },
  infoValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueAccent: {
    color: Colors.warning,
  },
  signOutButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
});
