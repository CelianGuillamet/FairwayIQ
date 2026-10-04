import { StyleSheet, Text, View } from 'react-native';
import { Numerals, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

export type StatItem = {
  label: string;
  value: string;
  unit?: string;
};

type Props = {
  items: StatItem[];
  columns?: number;
};

export function StatsStrip({ items, columns = 3 }: Props) {
  const styles = useThemedStyles(createStyles);
  const rows: StatItem[][] = [];

  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return (
    <View style={styles.strip}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, rowIndex > 0 && styles.rowDivider]}>
          {Array.from({ length: columns }, (_, columnIndex) => {
            const item = row[columnIndex];

            if (!item) return <View key={columnIndex} style={styles.cell} />;

            return (
              <View
                key={item.label}
                style={[styles.cell, columnIndex === 0 ? styles.cellFirst : styles.cellDivider]}
                accessible
                accessibilityLabel={`${item.label} : ${item.value}${item.unit ? ` ${item.unit}` : ''}`}
              >
                <Text style={styles.value}>
                  {item.value}
                  {item.unit ? <Text style={styles.unit}> {item.unit}</Text> : null}
                </Text>
                <Text style={styles.label}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strip: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.line,
    },
    row: {
      flexDirection: 'row',
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    cell: {
      flex: 1,
      gap: 2,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 4,
    },
    cellFirst: {
      paddingLeft: 0,
    },
    cellDivider: {
      borderLeftWidth: 1,
      borderLeftColor: colors.line,
    },
    value: {
      ...Typography.title,
      ...Numerals,
      lineHeight: 32,
      color: colors.ink,
    },
    unit: {
      ...Typography.body,
      color: colors.ink3,
    },
    label: {
      ...Typography.caption,
      color: colors.ink2,
      lineHeight: 16,
    },
  });
