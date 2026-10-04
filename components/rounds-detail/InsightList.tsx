import { StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';

type Props = {
  items: string[];
  tone: 'strength' | 'weakness';
};

export function InsightList({ items, tone }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const strength = tone === 'strength';

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.row}>
          <View style={[styles.marker, strength ? styles.markerStrength : styles.markerWeakness]}>
            <Icon
              name={strength ? 'check' : 'arrow-up'}
              size={13}
              strokeWidth={2.5}
              color={strength ? colors.green : colors.warning}
            />
          </View>
          <Text style={styles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    marker: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerStrength: {
      backgroundColor: colors.greenBg,
    },
    markerWeakness: {
      backgroundColor: colors.warningBg,
    },
    text: {
      ...Typography.body,
      flex: 1,
      color: colors.ink,
    },
  });
