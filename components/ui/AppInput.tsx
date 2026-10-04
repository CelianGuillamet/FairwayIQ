import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
};

export function AppInput({
  label,
  hint,
  error,
  trailing,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          error ? styles.inputShellError : null,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.ink}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint ?? error ?? hint}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: Spacing.md,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: Spacing.xs,
    },
    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.line,
      borderRadius: Radius.md,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
    },
    inputShellFocused: {
      borderColor: colors.ink,
    },
    inputShellError: {
      borderColor: colors.error,
    },
    input: {
      ...Typography.body,
      flex: 1,
      color: colors.ink,
      fontSize: 16,
      paddingVertical: 12,
    },
    trailing: {
      marginLeft: Spacing.sm,
    },
    hint: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: 6,
    },
    error: {
      ...Typography.caption,
      color: colors.error,
      marginTop: 6,
    },
  });
