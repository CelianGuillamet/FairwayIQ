import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

export type ChipOption<T extends string | number> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type Props<T extends string | number> = {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: Props<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.group, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    group: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    chip: {
      minHeight: 44,
      minWidth: 52,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.sunk,
    },
    chipSelected: {
      borderColor: colors.ink,
      backgroundColor: colors.ink,
    },
    pressed: {
      opacity: 0.7,
    },
    label: {
      ...Typography.bodyStrong,
      fontSize: 14,
      color: colors.ink2,
    },
    labelSelected: {
      color: colors.onInk,
    },
  });
