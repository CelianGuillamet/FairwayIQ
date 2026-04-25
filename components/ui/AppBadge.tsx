import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';

type Props = {
  label: string;
  tone?: 'primary' | 'warning' | 'neutral' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function AppBadge({ label, tone = 'neutral', style }: Props) {
  return (
    <View
      style={[
        styles.base,
        tone === 'primary' && styles.primary,
        tone === 'warning' && styles.warning,
        tone === 'danger' && styles.danger,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'primary' && styles.labelPrimary,
          tone === 'warning' && styles.labelWarning,
          tone === 'danger' && styles.labelDanger,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceElevated,
  },
  primary: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  warning: {
    backgroundColor: 'rgba(244, 196, 83, 0.14)',
    borderColor: Colors.warning,
  },
  danger: {
    backgroundColor: 'rgba(243, 122, 122, 0.14)',
    borderColor: Colors.error,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelPrimary: {
    color: Colors.primary,
  },
  labelWarning: {
    color: Colors.warning,
  },
  labelDanger: {
    color: Colors.error,
  },
});
