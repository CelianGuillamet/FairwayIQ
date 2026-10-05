import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import type { HoleViewData } from '../../lib/hole-view';
import type { GreenDistances } from '../../lib/gps';
import { describeClubAdvice, formatClubAdvice, type ClubAdvice } from '../../lib/club-advice';
import type { TeeKey, TeeOption } from '../../lib/golf-courses';
import { describeStrokes, getNotationWord } from '../../lib/score-labels';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { RoundDraftHole } from '../../types';
import { AppBadge } from '../ui/AppBadge';
import { Icon } from '../ui/Icon';
import { ScoreMark } from '../ui/ScoreMark';

type Props = {
  hole: RoundDraftHole;
  holeView: HoleViewData;
  teeKey: TeeKey;
  teeOptions: TeeOption[];
  onSelectTee: (teeKey: TeeKey) => void;
  liveGreenDistances?: GreenDistances | null;
  gpsHintLabel?: string | null;
  clubAdvice?: ClubAdvice | null;
};

export function HoleOverviewCard({
  hole,
  holeView,
  teeKey,
  teeOptions,
  onSelectTee,
  liveGreenDistances,
  gpsHintLabel,
  clubAdvice,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const selectedTee = teeOptions.find((t) => t.key === teeKey) ?? teeOptions[0];
  const distance =
    (selectedTee ? holeView.distanceByTee[selectedTee.key] : undefined) ??
    Object.values(holeView.distanceByTee).find((d) => typeof d === 'number') ??
    0;
  const estimated = holeView.distanceSource !== 'catalog';

  const greenDistances = [
    { label: 'Avant', value: liveGreenDistances?.front ?? null },
    { label: 'Milieu', value: liveGreenDistances?.center ?? null },
    { label: 'Fond', value: liveGreenDistances?.back ?? null },
  ].filter((item): item is { label: string; value: number } => item.value != null);

  const factsLabel = [
    `Trou ${hole.hole_number}`,
    `par ${holeView.par}`,
    `${distance} mètres${estimated ? ', distance estimée' : ''}`,
    `handicap ${holeView.handicapIndex}`,
  ].join(', ');

  return (
    <View style={styles.container}>
      <View style={styles.holeRow}>
        <View style={styles.facts} accessible accessibilityLabel={factsLabel}>
          <Fact label="Trou" value={hole.hole_number} />
          <Fact label="Par" value={holeView.par} />
          <Fact label="Distance" value={distance} unit="m">
            {estimated ? <AppBadge label="Estimée" tone="neutral" style={styles.estimateBadge} /> : null}
          </Fact>
          <Fact label="Hcp" value={holeView.handicapIndex} />
        </View>

        <View style={styles.big}>
          {hole.completed ? (
            <>
              <ScoreMark
                strokes={hole.score}
                par={hole.par}
                size="xl"
                accessibilityLabel={describeStrokes(hole.score, hole.par)}
              />
              <Text style={styles.word}>{getNotationWord(hole.score, hole.par)}</Text>
            </>
          ) : (
            <>
              <View
                style={styles.pending}
                accessible
                accessibilityRole="image"
                accessibilityLabel="Aucun score saisi pour ce trou"
              >
                <Text style={styles.pendingDash}>–</Text>
              </View>
              <Text style={[styles.word, styles.wordPending]}>À jouer</Text>
            </>
          )}
        </View>
      </View>

      {greenDistances.length > 0 ? (
        <View
          style={styles.gps}
          accessible
          accessibilityLabel={`Distance au green, ${greenDistances
            .map((item) => `${item.label.toLowerCase()} ${item.value} mètres`)
            .join(', ')}${clubAdvice ? `. ${describeClubAdvice(clubAdvice, estimated)}` : ''}`}
        >
          <View style={styles.gpsHeader}>
            <Icon name="map-pin" size={16} color={colors.green} />
            <Text style={styles.gpsTitle}>Distance au green</Text>
          </View>
          <View style={styles.gpsValues}>
            {greenDistances.map((item) => (
              <View key={item.label} style={styles.gpsItem}>
                <Text style={styles.gpsLabel}>{item.label}</Text>
                <Text style={styles.gpsValue}>
                  {item.value}
                  <Text style={styles.unit}> m</Text>
                </Text>
              </View>
            ))}
          </View>
          {clubAdvice ? <Text style={styles.advice}>{formatClubAdvice(clubAdvice, estimated)}</Text> : null}
        </View>
      ) : gpsHintLabel ? (
        <View style={styles.gpsHint}>
          <Icon name="map-pin" size={16} color={colors.ink3} />
          <Text style={styles.gpsHintText}>{gpsHintLabel}</Text>
        </View>
      ) : null}

      {teeOptions.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tees}
          accessibilityRole="radiogroup"
          accessibilityLabel="Départ"
        >
          {teeOptions.map((tee) => {
            const active = tee.key === teeKey;
            const teeDistance = holeView.distanceByTee[tee.key] ?? distance;

            return (
              <Pressable
                key={tee.key}
                style={({ pressed }) => [styles.teeChip, active && styles.teeChipActive, pressed && styles.pressed]}
                onPress={() => onSelectTee(tee.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${tee.label}, ${teeDistance} mètres`}
              >
                <View style={[styles.teeDot, { backgroundColor: tee.color }]} />
                <Text style={styles.teeLabel}>{teeDistance} m</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Fact({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: number;
  unit?: string;
  children?: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: Spacing.md,
    },
    holeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    facts: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: Spacing.md,
    },
    fact: {
      width: '50%',
      gap: 2,
      alignItems: 'flex-start',
    },
    factLabel: {
      ...Typography.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink3,
    },
    factValue: {
      ...Typography.title,
      ...Numerals,
      color: colors.ink,
    },
    unit: {
      fontFamily: Fonts.sansMedium,
      fontSize: 14,
      color: colors.ink3,
      letterSpacing: 0,
    },
    estimateBadge: {
      marginTop: 2,
    },
    big: {
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.xs,
    },
    word: {
      ...Typography.bodyStrong,
      fontFamily: Fonts.sansBold,
      color: colors.ink,
    },
    wordPending: {
      color: colors.ink3,
      fontFamily: Fonts.sansMedium,
    },
    pending: {
      width: 100,
      height: 100,
      borderRadius: 10,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingDash: {
      ...Typography.display,
      color: colors.ink3,
    },
    gps: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      gap: Spacing.xs,
    },
    gpsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    gpsTitle: {
      ...Typography.label,
      color: colors.ink2,
    },
    gpsValues: {
      flexDirection: 'row',
    },
    gpsItem: {
      flex: 1,
    },
    gpsLabel: {
      ...Typography.caption,
      color: colors.ink3,
    },
    gpsValue: {
      ...Typography.titleMd,
      ...Numerals,
      color: colors.ink,
    },
    advice: {
      ...Typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink2,
    },
    gpsHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    gpsHintText: {
      ...Typography.caption,
      flex: 1,
      color: colors.ink3,
    },
    tees: {
      flexGrow: 1,
      gap: Spacing.xs,
    },
    teeChip: {
      flexGrow: 1,
      minWidth: 92,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.sm,
    },
    teeChipActive: {
      borderColor: colors.ink,
      backgroundColor: colors.surface,
    },
    pressed: {
      opacity: 0.7,
    },
    teeDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.ink3,
    },
    teeLabel: {
      ...Typography.bodyStrong,
      ...Numerals,
      color: colors.ink,
    },
  });
