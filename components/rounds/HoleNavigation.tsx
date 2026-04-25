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
  const activeDescriptor = activeHole ? getScoreDescriptor(activeHole.score, activeHole.par) : null;

  return (
    <AppCard accent="soft" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Round control</Text>
          <Text style={styles.title}>Trou {currentHole}</Text>
          <Text style={styles.subtitle}>
            {activeHole?.completed && activeDescriptor
              ? `${activeDescriptor.label} · ${activeDescriptor.diffLabel}`
              : 'Trou en préparation'}
          </Text>
        </View>

        <View style={styles.headerBadges}>
          <AppBadge label={`${progress.completedHoles}/${progress.totalHoles} saisis`} />
          <AppBadge
            label={progress.completedHoles > 0 ? `Live ${formatScoreToPar(progress.liveScoreToPar)}` : 'Live —'}
            tone="primary"
          />
        </View>
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.arrowButton, currentHole === 1 && styles.arrowButtonDisabled]}
          onPress={onPreviousHole}
          disabled={currentHole === 1}
        >
          <Text style={styles.arrowText}>←</Text>
        </TouchableOpacity>

        <View style={styles.progressPanel}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.progressPercentage}%` }]} />
          </View>
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMeta}>Progression {progress.progressPercentage}%</Text>
            <Text style={styles.progressMeta}>{progress.remainingHoles} restants</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.arrowButton, currentHole === scorecard.length && styles.arrowButtonDisabled]}
          onPress={onNextHole}
          disabled={currentHole === scorecard.length}
        >
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>
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
              <Text style={[styles.holeChipPar, isActive && styles.holeChipParActive]}>Par {hole.par}</Text>
              <Text
                style={[
                  styles.holeChipStatus,
                  hole.completed ? styles.holeChipStatusDone : styles.holeChipStatusPending,
                  isActive && styles.holeChipStatusActive,
                ]}
              >
                {hole.completed ? descriptor.diffLabel : 'À saisir'}
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
    ...Typography.titleMd,
    color: Colors.text,
    marginTop: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  headerBadges: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  arrowButton: {
    width: 50,
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.35,
  },
  arrowText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  progressPanel: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  progressMeta: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  holesRow: {
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingRight: Spacing.xs,
  },
  holeChip: {
    width: 76,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  holeChipCompleted: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceElevated,
  },
  holeChipActive: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.primary,
  },
  holeChipNumber: {
    ...Typography.heading,
    color: Colors.text,
  },
  holeChipNumberActive: {
    color: Colors.primary,
  },
  holeChipPar: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 2,
  },
  holeChipParActive: {
    color: Colors.textMuted,
  },
  holeChipStatus: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  holeChipStatusDone: {
    color: Colors.primary,
  },
  holeChipStatusPending: {
    color: Colors.warning,
  },
  holeChipStatusActive: {
    color: Colors.text,
  },
});
