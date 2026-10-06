import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../lib/theme';
import { getRingGeometry } from '../../lib/progress-ring';

type Props = {
  value: number;
  max: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
};

export function ProgressRing({ value, max, label, size = 56, strokeWidth = 6, children }: Props) {
  const { colors } = useTheme();
  const { center, radius, circumference, dashOffset, progress } = getRingGeometry(size, strokeWidth, max > 0 ? value / max : 0);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} stroke={colors.line} strokeWidth={strokeWidth} fill="none" />
        {progress > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.green}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            origin={`${center}, ${center}`}
            fill="none"
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
