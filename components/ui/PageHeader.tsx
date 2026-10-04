import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from './Icon';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
};

export function PageHeader({ eyebrow, title, subtitle, trailing, onBack, backLabel = 'Retour' }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      {onBack ? (
        <Pressable
          style={styles.back}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={Spacing.xs}
        >
          <Icon name="chevron-left" size={20} color={colors.ink2} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.content}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: Spacing.lg,
    },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: 44,
      marginLeft: -4,
      gap: 2,
    },
    backLabel: {
      ...Typography.label,
      fontSize: 14,
      color: colors.ink2,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    content: {
      flex: 1,
    },
    eyebrow: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: 4,
    },
    title: {
      ...Typography.title,
      color: colors.ink,
    },
    subtitle: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xxs,
    },
    trailing: {
      alignItems: 'flex-end',
    },
  });
