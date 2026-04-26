import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { HoleViewData } from '../../lib/hole-view';
import type { TeeKey, TeeOption } from '../../lib/golf-courses';
import type { RoundDraftHole } from '../../types';

type Props = {
  courseName: string;
  hole: RoundDraftHole;
  holeView: HoleViewData;
  teeKey: TeeKey;
  teeOptions: TeeOption[];
  onSelectTee: (teeKey: TeeKey) => void;
};

function getHazardLabel(hazard: HoleViewData['hazards'][number]) {
  switch (hazard) {
    case 'water':
      return 'Eau';
    case 'trees':
      return 'Arbres';
    default:
      return 'Bunker';
  }
}

function getDifficultyTone(label: HoleViewData['difficultyLabel']) {
  if (label === 'Exigeant') return 'warning' as const;
  if (label === 'Accessible') return 'primary' as const;
  return 'neutral' as const;
}

export function HoleOverviewCard({ courseName, hole, holeView, teeKey, teeOptions, onSelectTee }: Props) {
  const selectedTee = teeOptions.find((tee) => tee.key === teeKey) ?? teeOptions[0];
  const selectedDistance =
    (selectedTee ? holeView.distanceByTee[selectedTee.key] : undefined)
    ?? Object.values(holeView.distanceByTee).find((distance) => typeof distance === 'number')
    ?? 0;

  return (
    <AppCard accent="highlight" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>Contexte du trou</Text>
          <Text style={styles.courseName} numberOfLines={1}>
            {courseName || 'Parcours non précisé'}
          </Text>
        </View>
        <AppBadge label={holeView.difficultyLabel} tone={getDifficultyTone(holeView.difficultyLabel)} />
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.holeTitle}>Trou {hole.hole_number}</Text>
          <Text style={styles.holeMeta}>
            Par {holeView.par} · HCP {holeView.handicapIndex}
          </Text>
          <Text style={styles.summary}>{holeView.summary}</Text>
        </View>

        <View style={styles.distanceBlock}>
          <Text style={styles.distanceValue}>{selectedDistance}</Text>
          <Text style={styles.distanceLabel}>mètres</Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        <AppBadge label={holeView.distanceSource === 'catalog' ? 'Distance réelle' : 'Distance estimée'} />
        {holeView.gpsAvailable ? <AppBadge label={`GPS ${holeView.gpsPointCount || 1} pts`} tone="primary" /> : null}
        {holeView.hazards.map((hazard) => (
          <AppBadge key={hazard} label={getHazardLabel(hazard)} />
        ))}
      </View>

      {teeOptions.length > 1 ? (
        <View style={styles.teeSection}>
          <Text style={styles.teeSectionLabel}>Départ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teeRow}>
            {teeOptions.map((tee) => {
              const isActive = tee.key === teeKey;
              const teeDistance = holeView.distanceByTee[tee.key] ?? selectedDistance;

              return (
                <TouchableOpacity
                  key={tee.key}
                  style={[
                    styles.teeChip,
                    isActive && styles.teeChipActive,
                    { borderColor: isActive ? tee.color : Colors.borderStrong },
                  ]}
                  onPress={() => onSelectTee(tee.key)}
                >
                  <View style={styles.teeChipTop}>
                    <View style={[styles.teeDot, { backgroundColor: tee.color }]} />
                    <Text style={[styles.teeChipLabel, isActive && styles.teeChipLabelActive]}>
                      {tee.shortLabel ?? tee.label}
                    </Text>
                  </View>
                  <Text style={[styles.teeChipValue, isActive && styles.teeChipValueActive]}>
                    {teeDistance} m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  topCopy: {
    flex: 1,
  },
  eyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  courseName: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  heroCopy: {
    flex: 1,
  },
  holeTitle: {
    ...Typography.display,
    color: Colors.text,
  },
  holeMeta: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
    marginTop: 4,
  },
  summary: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  distanceBlock: {
    minWidth: 104,
    alignItems: 'flex-end',
  },
  distanceValue: {
    ...Typography.display,
    color: Colors.primary,
    fontSize: 48,
    lineHeight: 50,
  },
  distanceLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  teeSection: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  teeSectionLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  teeRow: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingRight: Spacing.xs,
  },
  teeChip: {
    minWidth: 92,
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: Colors.backgroundSoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  teeChipActive: {
    backgroundColor: Colors.surfaceElevated,
  },
  teeChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  teeDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  teeChipLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  teeChipLabelActive: {
    color: Colors.text,
  },
  teeChipValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: 6,
  },
  teeChipValueActive: {
    color: Colors.primary,
  },
});
