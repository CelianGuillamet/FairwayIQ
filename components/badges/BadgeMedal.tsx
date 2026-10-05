import { StyleSheet, View } from 'react-native';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon, type IconName } from '../ui/Icon';

type Props = {
  icon: IconName;
  earned?: boolean;
  size?: number;
};

export function BadgeMedal({ icon, earned = true, size = 48 }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.base, earned ? styles.earned : styles.locked, { width: size, height: size, borderRadius: size / 2 }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name={icon} size={Math.round(size * 0.46)} color={earned ? colors.onInk : colors.ink3} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    earned: {
      backgroundColor: colors.ink,
    },
    locked: {
      backgroundColor: colors.sunk,
    },
  });
