import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon, type IconName } from './Icon';

type Tone = 'neutral' | 'good' | 'warn' | 'danger';

type Props = {
  label: string;
  tone?: Tone | 'primary' | 'warning';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

const LEGACY_TONES = { primary: 'good', warning: 'warn' } as const;

export function AppBadge({ label, tone = 'neutral', icon, style }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const resolved: Tone = tone === 'primary' || tone === 'warning' ? LEGACY_TONES[tone] : tone;
  const textColor = {
    neutral: colors.ink2,
    good: colors.green,
    warn: colors.warning,
    danger: colors.error,
  }[resolved];

  return (
    <View style={[styles.base, !icon && styles.baseNoIcon, styles[resolved], style]}>
      {icon ? <Icon name={icon} size={16} strokeWidth={2} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: Radius.full,
      paddingVertical: 4,
      paddingLeft: 8,
      paddingRight: 10,
    },
    baseNoIcon: {
      paddingLeft: 10,
    },
    neutral: { backgroundColor: colors.sunk },
    good: { backgroundColor: colors.greenBg },
    warn: { backgroundColor: colors.warningBg },
    danger: { backgroundColor: colors.errorBg },
    label: {
      ...Typography.label,
    },
  });
