import { StyleSheet, Text, View } from 'react-native';
import { Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeLoss, getLeakTrendPill, type Leak } from '../../lib/leaks';
import { useThemedStyles } from '../../lib/theme';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { TextAction } from '../ui/TextAction';

type Props = {
  rank: number;
  leak: Leak;
  onOpenDrills: () => void;
};

export function LeakCard({ rank, leak, onOpenDrills }: Props) {
  const styles = useThemedStyles(createStyles);
  const loss = describeLoss(leak.lossPer18);
  const trend = getLeakTrendPill(leak.trend);

  return (
    <AppCard>
      <View style={styles.header}>
        <View style={styles.rank} accessible accessibilityLabel={`Numéro ${rank}`}>
          <Text style={styles.rankText} allowFontScaling={false}>
            {rank}
          </Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {leak.title}
        </Text>
      </View>

      <View style={styles.lossRow} accessible accessibilityLabel={`${loss.value.replace('≈', 'environ')} ${loss.unit}`}>
        <Text style={styles.lossValue}>{loss.value}</Text>
        <Text style={styles.lossUnit}>{loss.unit}</Text>
      </View>

      <Text style={styles.explanation}>{leak.explanation}</Text>

      <View style={styles.footer}>
        <View accessible accessibilityLabel={trend.accessibilityLabel}>
          <AppBadge label={trend.label} tone={trend.tone} icon={trend.icon ?? undefined} />
        </View>
        <TextAction label="Voir les exercices" icon="chevron-right" onPress={onOpenDrills} />
      </View>
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    rank: {
      width: 32,
      height: 32,
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      ...Typography.heading,
      ...Numerals,
      fontFamily: Typography.titleMd.fontFamily,
      color: colors.ink,
      textAlign: 'center',
      includeFontPadding: false,
    },
    title: {
      ...Typography.heading,
      color: colors.ink,
      flex: 1,
    },
    lossRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      columnGap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    lossValue: {
      ...Typography.display,
      ...Numerals,
      color: colors.ink,
    },
    lossUnit: {
      ...Typography.body,
      color: colors.ink2,
    },
    explanation: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: Spacing.sm,
      marginTop: Spacing.xs,
    },
  });
