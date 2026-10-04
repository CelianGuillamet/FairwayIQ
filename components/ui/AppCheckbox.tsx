import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from './Icon';

type Props = {
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  hint?: string;
};

export function AppCheckbox({ checked, onToggle, accessibilityLabel, children, hint }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          style={styles.target}
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={accessibilityLabel}
        >
          <View style={[styles.box, checked && styles.boxChecked]}>
            {checked ? <Icon name="check" size={16} strokeWidth={3} color={colors.onInk} /> : null}
          </View>
        </Pressable>
        <Text style={styles.label} onPress={onToggle}>
          {children}
        </Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    target: {
      width: 44,
      height: 44,
      marginLeft: -10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    label: {
      ...Typography.body,
      flex: 1,
      color: colors.ink2,
      paddingTop: 11,
    },
    hint: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: 2,
      marginLeft: 34,
    },
  });
