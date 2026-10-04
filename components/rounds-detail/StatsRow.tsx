import { StyleSheet, Text, View } from 'react-native';
import { Numerals, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';
import type { RoundStat } from './round-summary';

type Props = {
  stats: RoundStat[];
};

export function StatsRow({ stats }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => {
        const missing = stat.suffix == null && stat.value === '–';

        return (
          <View
            key={stat.key}
            accessible
            accessibilityLabel={stat.accessibilityLabel}
            style={[styles.cell, index > 0 && styles.divided]}
          >
            <Text style={[styles.value, missing && styles.valueMissing]} maxFontSizeMultiplier={1.3}>
              {stat.value}
              {stat.suffix ? <Text style={styles.suffix}>{stat.suffix}</Text> : null}
            </Text>
            <Text style={styles.label}>{stat.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.line,
    },
    cell: {
      flex: 1,
      gap: 2,
      paddingVertical: 12,
      paddingLeft: 10,
    },
    divided: {
      borderLeftWidth: 1,
      borderLeftColor: colors.line,
    },
    value: {
      ...Typography.title,
      lineHeight: 30,
      color: colors.ink,
      fontVariant: Numerals.fontVariant,
    },
    valueMissing: {
      color: colors.ink3,
    },
    suffix: {
      fontSize: 15,
      lineHeight: 16,
      letterSpacing: 0,
      color: colors.ink3,
    },
    label: {
      ...Typography.caption,
      lineHeight: 15,
      color: colors.ink2,
    },
  });
