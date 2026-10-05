import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Numerals, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { BADGES } from '../../lib/badges';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useBadgesStore } from '../../stores/badges';
import { Icon } from '../ui/Icon';

export function TrophiesRow({ first = false }: { first?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const count = useBadgesStore((state) => Object.keys(state.earned).length);
  const loaded = useBadgesStore((state) => state.loaded);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
      onPress={() => router.push('/trophies' as any)}
      accessibilityRole="button"
      accessibilityLabel={loaded ? `Trophées, ${count} sur ${BADGES.length}` : 'Trophées'}
    >
      <Text style={styles.label}>Trophées</Text>
      {loaded ? <Text style={styles.value}>{`${count} sur ${BADGES.length}`}</Text> : null}
      <Icon name="chevron-right" size={20} color={colors.ink3} />
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    pressed: {
      opacity: 0.6,
    },
    label: {
      ...Typography.bodyStrong,
      color: colors.ink,
      flex: 1,
    },
    value: {
      ...Typography.bodyStrong,
      ...Numerals,
      color: colors.ink2,
    },
  });
