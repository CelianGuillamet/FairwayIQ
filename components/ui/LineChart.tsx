import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { Fonts, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';

type Props = {
  data: number[];
  labels?: string[];
  width: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  accessibilityLabel?: string;
};

export function LineChart({
  data,
  labels,
  width,
  height = 140,
  color,
  showDots = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();

  if (data.length < 2) return null;

  const lineColor = color ?? colors.green;
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

  const yTicks = [min + range, min + range / 2, min].map(Math.round);
  const lastIndex = data.length - 1;

  return (
    <Svg
      width={width}
      height={height}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ?? `Courbe de ${data.length} valeurs, de ${data[0]} à ${data[lastIndex]}`
      }
    >
      {yTicks.map((_, i) => {
        const y = paddingTop + (i / 2) * chartH;
        return (
          <Line
            key={`grid-${i}`}
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={y}
            y2={y}
            stroke={colors.line}
            strokeWidth={1}
          />
        );
      })}

      {yTicks.map((tick, i) => {
        const y = paddingTop + (i / 2) * chartH;
        return (
          <SvgText
            key={`tick-${i}`}
            x={paddingLeft - 6}
            y={y + 4}
            textAnchor="end"
            fontSize="11"
            fontFamily={Fonts.sansMedium}
            fill={colors.ink3}
          >
            {tick}
          </SvgText>
        );
      })}

      <Polygon points={fillPoints} fill={lineColor} fillOpacity={0.14} />

      <Polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {showDots &&
        data.slice(0, -1).map((v, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(v)} r="2.5" fill={lineColor} />
        ))}

      <Circle
        cx={toX(lastIndex)}
        cy={toY(data[lastIndex])}
        r="5"
        fill={lineColor}
        stroke={colors.surface}
        strokeWidth="2"
      />

      {labels &&
        labels.map((label, i) => {
          if (data.length > 6 && i % 2 !== 0) return null;
          return (
            <SvgText
              key={i}
              x={toX(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="11"
              fontFamily={Fonts.sansMedium}
              fill={colors.ink3}
            >
              {label}
            </SvgText>
          );
        })}
    </Svg>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 18,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    cardTitle: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: 14,
    },
  });
