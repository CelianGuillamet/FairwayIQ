import { StyleSheet, Text, View } from 'react-native';
import { Numerals, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import type { MetricRow } from '../../lib/leaks';
import { useThemedStyles } from '../../lib/theme';

type Props = {
  rows: readonly MetricRow[];
};

export function MetricList({ rows }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.row, index > 0 && styles.rowDivider]}
          accessible
          accessibilityLabel={`${row.label} : ${row.value}${row.unit ? ` ${row.unit}` : ''}`}
        >
          <Text style={styles.label}>{row.label}</Text>
          <View style={styles.valueBlock}>
            <Text style={styles.value}>{row.value}</Text>
            {row.unit ? <Text style={styles.unit}>{row.unit}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.line,
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    label: {
      ...Typography.body,
      color: colors.ink,
      flex: 1,
    },
    valueBlock: {
      alignItems: 'flex-end',
    },
    value: {
      ...Typography.titleMd,
      ...Numerals,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    unit: {
      ...Typography.caption,
      color: colors.ink3,
    },
  });
