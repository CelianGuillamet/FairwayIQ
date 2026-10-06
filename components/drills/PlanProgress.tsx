import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

type Props = {
  done: number;
  total: number;
};

export function PlanCounter({ done, total }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.counter} accessible accessibilityLabel={`${done} exercices faits sur ${total}`}>
      <Text style={styles.counterValue}>
        {done}
        <Text style={styles.counterTotal}> / {total}</Text>
      </Text>
      <Text style={styles.counterCaption}>faits</Text>
    </View>
  );
}

export function PlanProgressBar({ done, total }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.bar}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Progression du plan de la semaine"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.segment, index < done && styles.segmentDone]} />
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    counter: {
      alignItems: 'flex-end',
    },
    counterValue: {
      ...Typography.title,
      ...Numerals,
      fontSize: 30,
      lineHeight: 32,
      color: colors.ink,
    },
    counterTotal: {
      fontFamily: Fonts.sansMedium,
      fontSize: 16,
      letterSpacing: 0,
      color: colors.ink3,
    },
    counterCaption: {
      ...Typography.caption,
      color: colors.ink3,
    },
    bar: {
      flexDirection: 'row',
      gap: 5,
    },
    segment: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.sunk,
    },
    segmentDone: {
      backgroundColor: colors.green,
    },
  });
