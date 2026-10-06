import { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Numerals, Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { BADGES, computeBadgeStats, formatBadgeDate, type BadgeDefinition, type BadgeStats } from '../lib/badges';
import { syncBadges } from '../lib/badge-awards';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useAuthStore } from '../stores/auth';
import { useBadgesStore } from '../stores/badges';
import { useDrillsStore } from '../stores/drills';
import { useRoundsStore } from '../stores/rounds';
import { BadgeMedal } from '../components/badges/BadgeMedal';
import { useWeeklyGoal } from '../components/home/useWeeklyGoal';
import { goBackOrHome } from '../components/rounds-detail/navigation';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { PageHeader } from '../components/ui/PageHeader';

type CellProps = {
  badge: BadgeDefinition;
  earnedAt: string | undefined;
  stats: BadgeStats;
};

function TrophyCell({ badge, earnedAt, stats }: CellProps) {
  const styles = useThemedStyles(createStyles);
  const detail = earnedAt ? formatBadgeDate(earnedAt) : badge.hint(stats);

  return (
    <AppCard style={styles.cell}>
      <View
        style={styles.cellBody}
        accessible
        accessibilityLabel={earnedAt ? `${badge.title}, obtenu. ${detail}` : `${badge.title}, à débloquer. ${detail}`}
      >
        <BadgeMedal icon={badge.icon} earned={!!earnedAt} />
        <Text style={[styles.cellTitle, !earnedAt && styles.cellTitleLocked]}>{badge.title}</Text>
        {detail ? <Text style={styles.cellDetail}>{detail}</Text> : null}
      </View>
    </AppCard>
  );
}

export default function TrophiesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((state) => state.user?.id);
  const playFrequency = useAuthStore((state) => state.profile?.play_frequency);
  const earned = useBadgesStore((state) => state.earned);
  const loaded = useBadgesStore((state) => state.loaded);
  const loading = useBadgesStore((state) => state.loading);
  const rounds = useRoundsStore((state) => state.rounds);
  const completions = useDrillsStore((state) => state.completions);
  const streak = useDrillsStore((state) => state.getStreak());
  const { goal } = useWeeklyGoal(userId, playFrequency);

  useEffect(() => {
    void syncBadges();
  }, []);

  const stats = useMemo(
    () => computeBadgeStats({ rounds, completions, streak, weeklyGoal: goal }),
    [rounds, completions, streak, goal],
  );
  const earnedCount = BADGES.filter((badge) => earned[badge.id]).length;
  const pairs = useMemo(
    () => Array.from({ length: Math.ceil(BADGES.length / 2) }, (_, index) => BADGES.slice(index * 2, index * 2 + 2)),
    [],
  );

  const renderBody = () => {
    if (!loaded && loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      );
    }

    if (!loaded) {
      return (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>Impossible de charger tes trophées</Text>
          <Text style={styles.stateText}>Vérifie ta connexion puis réessaie.</Text>
          <AppButton label="Réessayer" variant="secondary" onPress={() => void syncBadges()} style={styles.stateButton} />
        </View>
      );
    }

    return (
      <>
        <Text
          style={styles.counter}
          accessible
          accessibilityLabel={`${earnedCount} trophées sur ${BADGES.length}`}
        >
          {earnedCount}
          <Text style={styles.counterTotal}>{` sur ${BADGES.length}`}</Text>
        </Text>

        <View style={styles.grid}>
          {pairs.map((pair) => (
            <View key={pair[0].id} style={styles.gridRow}>
              {pair.map((badge) => (
                <View key={badge.id} style={styles.gridCell}>
                  <TrophyCell badge={badge} earnedAt={earned[badge.id]} stats={stats} />
                </View>
              ))}
              {pair.length < 2 ? <View style={styles.gridCell} /> : null}
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.display },
        ]}
      >
        <PageHeader onBack={goBackOrHome} title="Trophées" />
        {renderBody()}
      </ScrollView>
    </View>
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
    counter: {
      ...Typography.display,
      ...Numerals,
      color: colors.ink,
      marginBottom: Spacing.md,
    },
    counterTotal: {
      ...Typography.titleMd,
      ...Numerals,
      color: colors.ink2,
    },
    grid: {
      gap: Spacing.sm,
    },
    gridRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    gridCell: {
      flex: 1,
    },
    cell: {
      flex: 1,
      padding: Spacing.md,
    },
    cellBody: {
      gap: Spacing.xxs,
    },
    cellTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
      marginTop: Spacing.xs,
    },
    cellTitleLocked: {
      color: colors.ink2,
    },
    cellDetail: {
      ...Typography.caption,
      color: colors.ink3,
    },
    centered: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      gap: Spacing.xs,
    },
    stateTitle: {
      ...Typography.titleMd,
      color: colors.ink,
      textAlign: 'center',
    },
    stateText: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
    },
    stateButton: {
      marginTop: Spacing.sm,
      minWidth: 160,
    },
  });
