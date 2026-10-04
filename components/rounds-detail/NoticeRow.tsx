import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';

type Props = {
  message: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
};

export function NoticeRow({ message, title, style }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={title ? `${title}. ${message}` : message}
    >
      <View style={styles.icon}>
        <Icon name="alert" size={18} color={colors.warning} />
      </View>
      <View style={styles.copy}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.warningBg,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    icon: {
      height: 22,
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...Typography.bodyStrong,
      color: colors.warning,
    },
    message: {
      ...Typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.warning,
    },
  });
