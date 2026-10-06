import { StyleSheet, View } from 'react-native';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

type Props = {
  value: number;
  max: number;
  label: string;
};

export function ProgressBar({ value, max, label }: Props) {
  const styles = useThemedStyles(createStyles);
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(Math.max(value, 0), max) }}
    >
      {ratio > 0 ? <View style={[styles.fill, { width: `${ratio * 100}%` }]} /> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: colors.sunk,
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.green,
    },
  });
