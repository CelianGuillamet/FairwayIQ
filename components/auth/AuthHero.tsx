import { StyleSheet, Text, View } from 'react-native';
import { Radius, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon, type IconName } from '../ui/Icon';

type Props = {
  icon: IconName;
  title: string;
  subtitle: string;
  compact?: boolean;
};

export function AuthHero({ icon, title, subtitle, compact = false }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.hero}>
      <View style={styles.badge}>
        <Icon name={icon} size={24} color={colors.ink} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      marginBottom: 24,
    },
    badge: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      backgroundColor: colors.sunk,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      ...Typography.display,
      color: colors.ink,
    },
    titleCompact: {
      ...Typography.title,
    },
    subtitle: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: 8,
    },
  });
