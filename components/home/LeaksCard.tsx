import { StyleSheet, Text, View } from 'react-native';
import { Numerals, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeLoss, getLeakTrendPill, type Leak } from '../../lib/leaks';
import { useThemedStyles } from '../../lib/theme';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { TextAction } from '../ui/TextAction';

type Props = {
  leak: Leak;
  onOpen: () => void;
};

export function LeaksCard({ leak, onOpen }: Props) {
  const styles = useThemedStyles(createStyles);
  const loss = describeLoss(leak.lossPer18);
  const trend = getLeakTrendPill(leak.trend);

  return (
    <AppCard>
      <Text style={styles.label}>Où tu perds des coups</Text>
      <View style={styles.top}>
        <Text style={styles.title} accessibilityRole="header">
          {leak.title}
        </Text>
        <View style={styles.loss} accessible accessibilityLabel={`${loss.value.replace('≈', 'environ')} ${loss.unit}`}>
          <Text style={styles.lossValue}>{loss.value}</Text>
          <Text style={styles.lossUnit}>{loss.unit}</Text>
        </View>
      </View>
      <Text style={styles.body}>{leak.explanation}</Text>
      <View style={styles.foot}>
        <View accessible accessibilityLabel={trend.accessibilityLabel}>
          <AppBadge label={trend.label} tone={trend.tone} icon={trend.icon ?? undefined} />
        </View>
        <TextAction label="Voir le détail" icon="chevron-right" onPress={onOpen} />
      </View>
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: 2,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
      flexShrink: 1,
    },
    loss: {
      alignItems: 'flex-end',
    },
    lossValue: {
      ...Typography.title,
      ...Numerals,
      color: colors.ink,
    },
    lossUnit: {
      ...Typography.caption,
      color: colors.ink3,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    foot: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: Spacing.sm,
      marginTop: Spacing.xs,
    },
  });
