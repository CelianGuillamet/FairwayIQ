import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';
import { AppCard } from '../ui/AppCard';
import { LineChart } from '../ui/LineChart';
import { SegmentedControl } from '../ui/SegmentedControl';

export type EvolutionSeries = {
  key: string;
  tabLabel: string;
  title: string;
  hint: string;
  data: number[];
  labels: string[];
  accessibilityLabel: string;
};

const CHART_HEIGHT = 140;

export function EvolutionCard({ series }: { series: EvolutionSeries[] }) {
  const styles = useThemedStyles(createStyles);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  if (series.length === 0) return null;

  const active = series.find((item) => item.key === selectedKey) ?? series[0];

  return (
    <View>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Évolution
      </Text>
      <AppCard>
        {series.length > 1 ? (
          <SegmentedControl
            options={series.map((item) => ({ value: item.key, label: item.tabLabel }))}
            value={active.key}
            onChange={setSelectedKey}
            accessibilityLabel="Choisir la courbe affichée"
            style={styles.segments}
          />
        ) : null}
        <Text style={styles.chartTitle}>{active.title}</Text>
        <View
          style={styles.chart}
          onLayout={(event) => setChartWidth(Math.floor(event.nativeEvent.layout.width))}
        >
          {chartWidth > 0 ? (
            <LineChart
              data={active.data}
              labels={active.labels}
              width={chartWidth}
              height={CHART_HEIGHT}
              accessibilityLabel={active.accessibilityLabel}
            />
          ) : null}
        </View>
        <Text style={styles.hint}>{active.hint}</Text>
      </AppCard>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
      marginBottom: Spacing.sm,
    },
    segments: {
      marginBottom: Spacing.md,
    },
    chartTitle: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: Spacing.xs,
    },
    chart: {
      height: CHART_HEIGHT,
    },
    hint: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: Spacing.xxs,
    },
  });
