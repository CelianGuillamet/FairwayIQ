import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

type Props = {
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceTile({ label, description, selected = false, onPress }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}, ${description}` : label}
    >
      <View style={[styles.ring, selected && styles.ringSelected]}>
        <View style={[styles.dot, selected && styles.dotSelected]} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, selected && styles.descriptionSelected]}>{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tile: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      gap: 14,
    },
    tileSelected: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    pressed: {
      opacity: 0.85,
    },
    ring: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringSelected: {
      borderColor: colors.onInk,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: 'transparent',
    },
    dotSelected: {
      backgroundColor: colors.onInk,
    },
    content: {
      flex: 1,
    },
    label: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    labelSelected: {
      color: colors.onInk,
    },
    description: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: 2,
    },
    descriptionSelected: {
      color: colors.onInk,
      opacity: 0.8,
    },
  });
