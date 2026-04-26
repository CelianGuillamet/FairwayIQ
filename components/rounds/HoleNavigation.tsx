import { memo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { RoundDraftHole } from '../../types';
import { getScorecardProgress } from '../../lib/rounds';
import { getScoreDescriptor } from '../../lib/hole-view';

type Props = {
  currentHole: number;
  scorecard: RoundDraftHole[];
  onSelectHole: (holeNumber: number) => void;
  onPreviousHole: () => void;
  onNextHole: () => void;
};

function formatScoreToPar(value: number) {
  return value === 0 ? 'E' : `${value > 0 ? '+' : ''}${value}`;
}

export const HoleNavigation = memo(function HoleNavigation({
  currentHole,
  scorecard,
  onSelectHole,
  onPreviousHole,
  onNextHole,
}: Props) {
  const progress = getScorecardProgress(scorecard);
  const activeHole = scorecard[currentHole - 1];
  const liveLabel =
    progress.completedHoles > 0
      ? `${progress.liveScore} · ${formatScoreToPar(progress.liveScoreToPar)}`
      : 'Prêt';

  return (
    <AppCard accent="soft" style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.edgeButton, currentHole === 1 && styles.edgeButtonDisabled]}
          onPress={onPreviousHole}
          disabled={currentHole === 1}
        >
          <Text style={styles.edgeButtonLabel}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>Navigation rapide</Text>
          <Text style={styles.title}>Trou {currentHole}</Text>
          <Text style={styles.subtitle}>
            {activeHole?.completed ? `${getScoreDescriptor(activeHole.score, activeHole.par).label} sauvegardé` : 'Tape un score ou swipe pour avancer'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.edgeButton, currentHole === scorecard.length && styles.edgeButtonDisabled]}
          onPress={onNextHole}
          disabled={currentHole === scorecard.length}
        >
          <Text style={styles.edgeButtonLabel}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <AppBadge label={`${progress.completedHoles}/${progress.totalHoles} trous`} tone="primary" />
        <AppBadge label={`Live ${liveLabel}`} />
        <AppBadge label={`${progress.remainingHoles} restants`} tone="warning" />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress.progressPercentage}%` }]} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.holesRow}
      >
        {scorecard.map((hole) => {
          const descriptor = getScoreDescriptor(hole.score, hole.par);
          const isActive = hole.hole_number === currentHole;

          return (
            <TouchableOpacity
              key={hole.hole_number}
              style={[
                styles.holeChip,
                hole.completed && styles.holeChipCompleted,
                isActive && styles.holeChipActive,
              ]}
              onPress={() => onSelectHole(hole.hole_number)}
            >
              <Text style={[styles.holeChipNumber, isActive && styles.holeChipNumberActive]}>
                {hole.hole_number}
              </Text>
              <Text style={[styles.holeChipMeta, isActive && styles.holeChipMetaActive]}>
                Par {hole.par}
              </Text>
              <Text
                style={[
                  styles.holeChipStatus,
                  hole.completed ? styles.holeChipStatusDone : styles.holeChipStatusPending,
                  isActive && styles.holeChipStatusActive,
                ]}
              >
                {hole.completed ? descriptor.diffLabel : '—'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </AppCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingTop: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  edgeButton: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edgeButtonDisabled: {
    opacity: 0.35,
  },
  edgeButtonLabel: {
    color: Colors.text,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '900',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  eyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  title: {
    ...Typography.titleMd,
    color: Colors.text,
    marginTop: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  holesRow: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingRight: Spacing.xs,
  },
  holeChip: {
    minWidth: 68,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  holeChipCompleted: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceElevated,
  },
  holeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  holeChipNumber: {
    ...Typography.heading,
    color: Colors.text,
  },
  holeChipNumberActive: {
    color: Colors.primary,
  },
  holeChipMeta: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 2,
  },
  holeChipMetaActive: {
    color: Colors.textMuted,
  },
  holeChipStatus: {
    ...Typography.bodyStrong,
    marginTop: Spacing.xs,
  },
  holeChipStatusDone: {
    color: Colors.primary,
  },
  holeChipStatusPending: {
    color: Colors.textDim,
  },
  holeChipStatusActive: {
    color: Colors.text,
  },
});
