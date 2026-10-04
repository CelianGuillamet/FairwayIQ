import { StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { capitalizeFirst, describeSparkline, getSparklineTone, type TrendPill } from '../../lib/home';
import { useThemedStyles } from '../../lib/theme';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { Sparkline } from './Sparkline';

type Props = {
  value: string;
  helper: string;
  hasIndex: boolean;
  sparkValues: number[];
  trend: TrendPill;
};

export function IndexCard({ value, helper, hasIndex, sparkValues, trend }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <AppCard>
      <View style={styles.top}>
        <View style={styles.indexColumn}>
          <Text style={styles.label}>Index estimé</Text>
          <Text style={[styles.value, !hasIndex && styles.valueEmpty]}>{value}</Text>
        </View>
        {sparkValues.length >= 2 ? (
          <View style={styles.spark}>
            <Sparkline
              values={sparkValues}
              tone={getSparklineTone(sparkValues)}
              accessibilityLabel={describeSparkline(sparkValues)}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.foot}>
        <View accessible accessibilityLabel={trend.accessibilityLabel}>
          <AppBadge label={trend.label} tone={trend.tone} icon={trend.icon ?? undefined} />
        </View>
        <Text style={styles.caption}>{capitalizeFirst(helper)}</Text>
      </View>
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: Spacing.sm,
    },
    indexColumn: {
      flexShrink: 1,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    value: {
      ...Typography.numeralXL,
      fontSize: 68,
      lineHeight: 72,
      color: colors.ink,
      marginTop: 6,
    },
    valueEmpty: {
      color: colors.ink3,
    },
    spark: {
      marginBottom: Spacing.xs,
    },
    foot: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
      marginTop: 14,
    },
    caption: {
      ...Typography.caption,
      color: colors.ink2,
    },
  });
