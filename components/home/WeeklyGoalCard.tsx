import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeWeeklyBreakdown, describeWeeklyProgress, type WeeklySessions } from '../../lib/weekly-goal';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { ProgressRing } from '../ui/ProgressRing';

type Props = {
  sessions: WeeklySessions;
  goal: number;
  onPress: () => void;
};

export function WeeklyGoalCard({ sessions, goal, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reached = sessions.total >= goal;
  const label = describeWeeklyProgress(sessions.total, goal);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Ouvre le réglage de l’objectif de la semaine"
    >
      <ProgressRing value={sessions.total} max={goal} label={label} size={56} strokeWidth={6}>
        {reached ? <Icon name="check" size={22} strokeWidth={2.25} color={colors.green} /> : null}
      </ProgressRing>
      <View style={styles.copy}>
        <Text style={styles.label}>Cette semaine</Text>
        <Text style={styles.title}>
          {sessions.total}
          <Text style={styles.goal}> / {goal} {goal > 1 ? 'séances' : 'séance'}</Text>
        </Text>
        <Text style={[styles.caption, reached && styles.captionReached]}>{describeWeeklyBreakdown(sessions, goal)}</Text>
      </View>
      <Text style={styles.edit}>Modifier</Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.line,
    },
    pressed: {
      opacity: 0.6,
    },
    copy: {
      flex: 1,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    title: {
      ...Typography.titleMd,
      ...Numerals,
      fontSize: 22,
      lineHeight: 26,
      color: colors.ink,
    },
    goal: {
      ...Typography.body,
      color: colors.ink2,
    },
    caption: {
      ...Typography.caption,
      color: colors.ink3,
    },
    captionReached: {
      color: colors.green,
    },
    edit: {
      ...Typography.bodyStrong,
      color: colors.ink2,
    },
  });
