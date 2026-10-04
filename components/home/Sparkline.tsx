import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../../lib/theme';
import { computeSparkline } from '../../lib/sparkline';

const WIDTH = 124;
const HEIGHT = 48;
const PADDING = 5;

type Props = {
  values: number[];
  tone: 'good' | 'neutral';
  accessibilityLabel: string;
};

export function Sparkline({ values, tone, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const geometry = computeSparkline(values, { width: WIDTH, height: HEIGHT, padding: PADDING });

  if (!geometry) return null;

  const stroke = tone === 'good' ? colors.green : colors.ink2;

  return (
    <Svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Line x1={0} x2={WIDTH} y1={PADDING} y2={PADDING} stroke={colors.line} strokeWidth={1} />
      <Line x1={0} x2={WIDTH} y1={HEIGHT - PADDING} y2={HEIGHT - PADDING} stroke={colors.line} strokeWidth={1} />
      <Path d={geometry.area} fill={stroke} fillOpacity={0.14} />
      <Path d={geometry.line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={geometry.last.x} cy={geometry.last.y} r={4} fill={stroke} stroke={colors.surface} strokeWidth={2} />
    </Svg>
  );
}
