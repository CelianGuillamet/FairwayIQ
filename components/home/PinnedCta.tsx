import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppButton } from '../ui/AppButton';
import type { IconName } from '../ui/Icon';

export const PINNED_CTA_CLEARANCE = 112;

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  accessibilityHint?: string;
};

export function PinnedCta({ label, onPress, icon, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="pinnedCtaFade" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0.62" stopColor={colors.bg} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.bg} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pinnedCtaFade)" />
        </Svg>
      </View>
      <AppButton label={label} onPress={onPress} icon={icon} accessibilityHint={accessibilityHint} />
    </View>
  );
}

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 36,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
  });
