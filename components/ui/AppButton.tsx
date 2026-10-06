import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Fonts, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  icon,
  iconPosition = 'left',
  accessibilityHint,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;
  const isDimmed = disabled && !loading;
  const kind = variant === 'accent' ? 'primary' : variant;

  const labelColor = isDimmed
    ? colors.ink3
    : kind === 'primary'
      ? colors.onRed
      : colors.ink;

  const content = loading ? (
    <ActivityIndicator color={kind === 'primary' ? colors.onRed : colors.ink} />
  ) : (
    <View style={styles.content}>
      {icon && iconPosition === 'left' ? <Icon name={icon} size={20} color={labelColor} /> : null}
      <Text
        style={[styles.label, kind !== 'primary' && styles.labelCompact, { color: labelColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {icon && iconPosition === 'right' ? <Icon name={icon} size={20} color={labelColor} /> : null}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        kind === 'primary' && styles.primary,
        kind === 'secondary' && styles.secondary,
        kind === 'ghost' && styles.ghost,
        isDimmed && kind === 'primary' && styles.primaryDisabled,
        isDimmed && kind === 'secondary' && styles.secondaryDisabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      minHeight: 44,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    primary: {
      minHeight: 52,
      backgroundColor: colors.red,
    },
    primaryDisabled: {
      backgroundColor: colors.sunk,
    },
    secondary: {
      minHeight: 52,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.ink,
    },
    secondaryDisabled: {
      borderColor: colors.line,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    pressed: {
      opacity: 0.8,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    label: {
      ...Typography.heading,
    },
    labelCompact: {
      fontFamily: Fonts.sansBold,
      fontSize: 15,
      lineHeight: 20,
    },
  });
