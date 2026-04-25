import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  trailing?: ReactNode;
};

export function AppInput({ label, hint, trailing, style, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputShell}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textDim}
          {...props}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textMuted,
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 14,
  },
  trailing: {
    marginLeft: Spacing.sm,
  },
  hint: {
    color: Colors.textDim,
    ...Typography.caption,
    marginTop: 6,
  },
});
