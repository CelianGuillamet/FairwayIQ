import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import type { FocusInsight } from '../../lib/home';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';

type Props = {
  insight: FocusInsight;
  onAction: () => void;
};

export function FocusBlock({ insight, onAction }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Focus de la semaine</Text>
      <Text style={styles.title} accessibilityRole="header">
        {insight.title}
      </Text>
      <Text style={styles.body}>{insight.description}</Text>
      <Pressable
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={insight.actionLabel}
      >
        <Text style={styles.linkLabel}>{insight.actionLabel}</Text>
        <Icon name="chevron-right" size={22} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    block: {
      gap: Spacing.xs,
      paddingHorizontal: 2,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
    },
    link: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.line,
      marginTop: Spacing.xxs,
    },
    pressed: {
      opacity: 0.6,
    },
    linkLabel: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
  });
