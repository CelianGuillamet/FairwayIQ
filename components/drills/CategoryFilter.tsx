import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

export type CategoryOption = {
  key: string;
  label: string;
};

type Props = {
  options: readonly CategoryOption[];
  value: string;
  onChange: (key: string) => void;
};

export function CategoryFilter({ options, value, onChange }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      accessibilityRole="radiogroup"
      accessibilityLabel="Filtrer par catégorie"
    >
      {options.map((option) => {
        const selected = option.key === value;

        return (
          <Pressable
            key={option.key}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option.key)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginHorizontal: -Spacing.lg,
    },
    content: {
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
    },
    chip: {
      minHeight: 44,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
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
