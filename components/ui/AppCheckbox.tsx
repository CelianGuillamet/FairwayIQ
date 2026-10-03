import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';

type Props = {
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  hint?: string;
};

export function AppCheckbox({ checked, onToggle, accessibilityLabel, children, hint }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.box, checked && styles.boxChecked]}
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={accessibilityLabel}
          hitSlop={Spacing.xs}
        >
          {checked ? <Text style={styles.check}>✓</Text> : null}
        </TouchableOpacity>
        <Text style={styles.label} onPress={onToggle}>
          {children}
        </Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  check: {
    color: Colors.background,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  label: {
    flex: 1,
    color: Colors.textMuted,
    ...Typography.label,
    fontWeight: '400',
    lineHeight: 20,
  },
  hint: {
    color: Colors.textDim,
    ...Typography.caption,
    marginTop: 6,
    marginLeft: 34,
  },
});
