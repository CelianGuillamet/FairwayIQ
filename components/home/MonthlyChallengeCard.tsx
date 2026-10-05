import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Numerals, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import {
  CHALLENGE_DONE_LABEL,
  describeChallengeProgress,
  describeDaysLeft,
  type Challenge,
  type ChallengeProgress,
} from '../../lib/monthly-challenge';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppCard } from '../ui/AppCard';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';

type Props = {
  challenge: Challenge;
  progress: ChallengeProgress;
  onPress: () => void;
};

export function MonthlyChallengeCard({ challenge, progress, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const count = describeChallengeProgress(progress);
  const daysLeft = describeDaysLeft(progress.daysLeft);
  const status = progress.done ? CHALLENGE_DONE_LABEL : `${count}. ${daysLeft}`;

  return (
    <Pressable
      style={({ pressed }) => pressed && styles.pressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Défi du mois : ${challenge.title}. ${status}`}
      accessibilityHint="Ouvre le détail du défi"
    >
      <AppCard>
        <Text style={styles.label}>Défi du mois</Text>
        <Text style={styles.title}>{challenge.title}</Text>
        <Text style={styles.description}>{challenge.description}</Text>
        <View style={styles.bar}>
          <ProgressBar value={progress.current} max={progress.target} label={count} />
        </View>
        {progress.done ? (
          <View style={styles.doneRow}>
            <Icon name="check" size={18} strokeWidth={2.25} color={colors.green} />
            <Text style={styles.done}>{CHALLENGE_DONE_LABEL}</Text>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text style={styles.count}>
              {progress.current}
              <Text style={styles.countTotal}> sur {progress.target}</Text>
            </Text>
            <Text style={styles.days}>{daysLeft}</Text>
          </View>
        )}
      </AppCard>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.6,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    title: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
      marginTop: 2,
    },
    description: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xxs,
    },
    bar: {
      marginTop: Spacing.sm,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    count: {
      ...Typography.titleMd,
      ...Numerals,
      fontSize: 22,
      lineHeight: 26,
      color: colors.ink,
    },
    countTotal: {
      ...Typography.body,
      color: colors.ink2,
    },
    days: {
      ...Typography.caption,
      color: colors.ink3,
    },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
      marginTop: Spacing.xs,
    },
    done: {
      ...Typography.bodyStrong,
      color: colors.green,
    },
  });
