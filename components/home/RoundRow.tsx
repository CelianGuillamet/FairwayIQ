import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Numerals, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeScoreToPar, formatRoundDay, formatRoundSubtitle, formatSignedFr } from '../../lib/home';
import { useThemedStyles } from '../../lib/theme';
import type { Round } from '../../types';

type Props = {
  round: Round;
  onPress: () => void;
};

export function RoundRow({ round, onPress }: Props) {
  const styles = useThemedStyles(createStyles);
  const scoreToPar = round.total_score - round.par;
  const date = formatRoundDay(round.played_at);
  const course = round.course_name ?? 'Parcours non précisé';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${course}, ${date.long}, ${round.total_score} coups, ${describeScoreToPar(scoreToPar)}`}
      accessibilityHint="Ouvre le détail du round"
    >
      <View style={styles.day}>
        <Text style={styles.dayNumber}>{date.day}</Text>
        <Text style={styles.dayMonth}>{date.month}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.course} numberOfLines={1}>
          {course}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {formatRoundSubtitle(round)}
        </Text>
      </View>
      <View style={styles.result}>
        <Text style={styles.score}>{round.total_score}</Text>
        <Text style={styles.toPar}>{formatSignedFr(scoreToPar, 0)}</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    pressed: {
      opacity: 0.6,
    },
    day: {
      width: 44,
      alignItems: 'center',
    },
    dayNumber: {
      ...Typography.titleMd,
      ...Numerals,
      fontSize: 22,
      lineHeight: 24,
      letterSpacing: 0,
      color: colors.ink,
    },
    dayMonth: {
      ...Typography.caption,
      color: colors.ink3,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    course: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    subtitle: {
      ...Typography.label,
      fontFamily: Typography.body.fontFamily,
      color: colors.ink3,
    },
    result: {
      alignItems: 'flex-end',
    },
    score: {
      ...Typography.title,
      ...Numerals,
      fontSize: 26,
      lineHeight: 28,
      color: colors.ink,
    },
    toPar: {
      ...Typography.label,
      ...Numerals,
      fontFamily: Typography.body.fontFamily,
      color: colors.ink2,
    },
  });
