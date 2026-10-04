import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'default' | 'muted' | 'danger';
  role?: 'button' | 'link';
  underline?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function TextAction({
  label,
  onPress,
  icon,
  tone = 'default',
  role = 'button',
  underline = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const color = disabled ? colors.ink3 : { default: colors.ink, muted: colors.ink2, danger: colors.error }[tone];

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : null}
      <Text style={[styles.label, underline && styles.underline, { color }]}>{label}</Text>
      {icon && !loading ? <Icon name={icon} size={18} color={color} /> : null}
    </Pressable>
  );
}

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: Spacing.xs,
    },
    pressed: {
      opacity: 0.6,
    },
    label: {
      ...Typography.bodyStrong,
    },
    underline: {
      textDecorationLine: 'underline',
    },
  });
