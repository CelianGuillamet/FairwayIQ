import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Mission de jeu</Text>
          <Text style={styles.title}>Trou {hole.hole_number}</Text>
          <Text style={styles.courseName}>{courseName || 'Parcours non précisé'}</Text>
        </View>

        <View style={styles.distanceBlock}>
          <Text style={styles.distanceValue}>{selectedDistance}</Text>
          <Text style={styles.distanceLabel}>mètres</Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        <AppBadge label={`Par ${holeView.par}`} tone="primary" />
        <AppBadge label={`HCP ${holeView.handicapIndex}`} />
        <AppBadge label={holeView.difficultyLabel} tone={getDifficultyTone(holeView.difficultyLabel)} />
        <AppBadge label={holeView.distanceSource === 'catalog' ? 'Distance réelle' : 'Distance estimée'} />
        {holeView.gpsAvailable ? (
          <AppBadge label={`GPS ${holeView.gpsPointCount || 1} pts`} tone="primary" />
        ) : null}
      </View>

      <View style={styles.missionCard}>
        <View style={styles.missionTopRow}>
          <View>
            <Text style={styles.missionEyebrow}>Lecture du trou</Text>
            <Text style={styles.missionText}>{holeView.summary}</Text>
          </View>
          <View style={styles.selectedTeePill}>
            <Text style={styles.selectedTeeLabel}>{selectedTee?.shortLabel ?? teeKey.toUpperCase()}</Text>
            <Text style={styles.selectedTeeDistance}>{selectedDistance} m</Text>
          </View>
        </View>

        <HoleVisual holeView={holeView} />
      </View>

      <View style={styles.teeGrid}>
        {teeOptions.map((tee) => {
          const isActive = tee.key === teeKey;
          const teeDistance = holeView.distanceByTee[tee.key] ?? selectedDistance;

          return (
            <TouchableOpacity
              key={tee.key}
              style={[
                styles.teeTile,
                isActive && styles.teeTileActive,
                { borderColor: isActive ? tee.color : Colors.borderStrong },
              ]}
              onPress={() => onSelectTee(tee.key)}
            >
              <View style={styles.teeTileTop}>
                <View style={[styles.teeDot, { backgroundColor: tee.color }]} />
                <Text style={[styles.teeLabel, isActive && styles.teeLabelActive]}>{tee.label}</Text>
              </View>
              <Text style={[styles.teeDistance, isActive && styles.teeDistanceActive]}>
                {teeDistance} m
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.hazardsRow}>
        {holeView.hazards.map((hazard) => (
          <View key={hazard} style={styles.hazardTile}>
            <Text style={styles.hazardLabel}>{getHazardLabel(hazard)}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function HoleVisual({ holeView }: { holeView: HoleViewData }) {
  const offsets =
    holeView.shape === 'dogleg-left'
      ? [12, -8, -16, -6]
      : holeView.shape === 'dogleg-right'
        ? [-10, 6, 16, 8]
        : [0, 0, 0, 0];

  return (
    <View style={styles.visualShell}>
      <View style={styles.visualRangeRow}>
        <Text style={styles.visualRangeLabel}>150m</Text>
        <Text style={styles.visualRangeLabel}>100m</Text>
        <Text style={styles.visualRangeLabel}>Green</Text>
      </View>

      <View style={styles.visualTrack}>
        <View style={styles.visualTeeMarker}>
          <Text style={styles.visualTeeText}>Tee</Text>
        </View>

        <View style={styles.visualLane}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.visualSegment,
                index === 1 && styles.visualSegmentWide,
                { marginTop: offsets[index] },
              ]}
            />
          ))}
        </View>

        <View style={styles.greenRing}>
          <View style={styles.greenCenter} />
        </View>
      </View>

      <View style={styles.hazardMarkersRow}>
        {holeView.hazards.map((hazard) => (
          <View key={hazard} style={styles.hazardMarker}>
            <Text style={styles.hazardMarkerText}>{getHazardLabel(hazard)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    ...Typography.display,
    color: Colors.text,
    marginTop: 2,
  },
  courseName: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  distanceBlock: {
    minWidth: 108,
    alignItems: 'flex-end',
  },
  distanceValue: {
    ...Typography.display,
    color: Colors.primary,
    fontSize: 42,
    lineHeight: 44,
  },
  distanceLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  missionCard: {
    marginTop: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
  },
  missionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  missionEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  missionText: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: Spacing.xs,
    maxWidth: 220,
  },
  selectedTeePill: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
  },
  selectedTeeLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  selectedTeeDistance: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: 2,
  },
  visualShell: {
    marginTop: Spacing.lg,
  },
  visualRangeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  visualRangeLabel: {
    ...Typography.caption,
    color: Colors.textDim,
  },
  visualTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 102,
  },
  visualTeeMarker: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualTeeText: {
    ...Typography.caption,
    color: Colors.primary,
  },
  visualLane: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.sm,
  },
  visualSegment: {
    flex: 1,
    height: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  visualSegmentWide: {
    height: 24,
    backgroundColor: Colors.surfaceAccent,
  },
  greenRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  greenCenter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  hazardMarkersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  hazardMarker: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hazardMarkerText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  teeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  teeTile: {
    flex: 1,
    minWidth: '45%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: Colors.backgroundSoft,
    padding: Spacing.md,
  },
  teeTileActive: {
    backgroundColor: Colors.surface,
  },
  teeTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  teeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teeLabel: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  teeLabelActive: {
    color: Colors.text,
  },
  teeDistance: {
    ...Typography.heading,
    color: Colors.textDim,
    marginTop: Spacing.sm,
  },
  teeDistanceActive: {
    color: Colors.primary,
  },
  hazardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  hazardTile: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hazardLabel: {
    ...Typography.caption,
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
