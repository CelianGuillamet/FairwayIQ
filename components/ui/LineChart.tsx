import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { Colors, Radius, Spacing, Typography } from '../../constants';

type Props = {
  data: number[];
  labels?: string[];
  width: number;
  height?: number;
  color?: string;
  showDots?: boolean;
};

export function LineChart({ data, labels, width, height = 140, color = Colors.primary, showDots = true }: Props) {
  if (data.length < 2) return null;

  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 28;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;

  const toX = (i: number) => paddingLeft + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => paddingTop + chartH - ((v - min) / range) * chartH;

  const points = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const fillPoints = [
    `${paddingLeft},${paddingTop + chartH}`,
    ...data.map((v, i) => `${toX(i)},${toY(v)}`),
    `${toX(data.length - 1)},${paddingTop + chartH}`,
  ].join(' ');

  // Y-axis labels: 3 values
  const yTicks = [min + range, min + range / 2, min].map(Math.round);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Y-axis ticks */}
      {yTicks.map((tick, i) => {
        const y = paddingTop + (i / 2) * chartH;
        return (
          <SvgText key={i} x={paddingLeft - 4} y={y + 4} textAnchor="end"
            fontSize="10" fill={Colors.textDim}>{tick}</SvgText>
        );
      })}

      {/* Gradient fill */}
      <Polygon points={fillPoints} fill="url(#grad)" />

      {/* Line */}
      <Polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {showDots && data.map((v, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={color} stroke={Colors.background} strokeWidth="2" />
      ))}

      {/* X-axis labels */}
      {labels && labels.map((label, i) => {
        if (data.length > 6 && i % 2 !== 0) return null;
        return (
          <SvgText key={i} x={toX(i)} y={height - 4} textAnchor="middle"
            fontSize="9" fill={Colors.textDim}>{label}</SvgText>
        );
      })}
    </Svg>
  );
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
