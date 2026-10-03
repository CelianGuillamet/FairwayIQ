import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { HoleViewData } from '../../lib/hole-view';
import { getScoreDescriptor } from '../../lib/hole-view';
import type { GreenDistances } from '../../lib/gps';
import type { TeeKey, TeeOption } from '../../lib/golf-courses';
import type { RoundDraftHole } from '../../types';
import { AppBadge } from '../ui/AppBadge';

type Props = {
  courseName: string;
  hole: RoundDraftHole;
  holeView: HoleViewData;
  teeKey: TeeKey;
  teeOptions: TeeOption[];
  onSelectTee: (teeKey: TeeKey) => void;
  liveGreenDistances?: GreenDistances | null;
  gpsHintLabel?: string | null;
};

function toneToColor(tone: string): string {
  switch (tone) {
    case 'elite':    return '#FFD055';
    case 'positive': return Colors.accentBlue;
    case 'neutral':  return Colors.text;
    case 'warning':  return Colors.warning;
    default:         return Colors.error;
  }
}

function hazardLabel(hazard: HoleViewData['hazards'][number]) {
  switch (hazard) {
    case 'water': return 'Eau';
    case 'trees': return 'Arbres';
    default:      return 'Bunker';
  }
}

export function HoleOverviewCard({
  courseName,
  hole,
  holeView,
  teeKey,
  teeOptions,
  onSelectTee,
  liveGreenDistances,
  gpsHintLabel,
}: Props) {
  const selectedTee = teeOptions.find((t) => t.key === teeKey) ?? teeOptions[0];
  const distance =
    (selectedTee ? holeView.distanceByTee[selectedTee.key] : undefined) ??
    Object.values(holeView.distanceByTee).find((d) => typeof d === 'number') ??
    0;

  const hasLiveGreenDistances =
    !!liveGreenDistances &&
    (liveGreenDistances.front != null || liveGreenDistances.center != null || liveGreenDistances.back != null);

  const descriptor  = hole.completed ? getScoreDescriptor(hole.score, hole.par) : null;
  const scoreColor  = descriptor ? toneToColor(descriptor.tone) : null;

  const diffBadgeStyle =
    holeView.difficultyLabel === 'Exigeant'   ? styles.badgeWarn :
    holeView.difficultyLabel === 'Accessible' ? styles.badgeGood :
    styles.badgeNeutral;

  const diffTextStyle =
    holeView.difficultyLabel === 'Exigeant'   ? styles.badgeTextWarn :
    holeView.difficultyLabel === 'Accessible' ? styles.badgeTextGood :
    styles.badgeTextNeutral;

  return (
    <View style={styles.container}>

      {/* Course name — subtle caption */}
      {courseName.trim().length > 0 && (
        <Text style={styles.courseName} numberOfLines={1}>{courseName}</Text>
      )}

      {/* Big hole number + score indicator */}
      <View style={styles.heroRow}>
        <Text style={styles.holeNum}>{hole.hole_number}</Text>

        {descriptor && scoreColor ? (
          <View style={[styles.scorePill, { borderColor: scoreColor, backgroundColor: scoreColor + '18' }]}>
            <Text style={[styles.scorePillDiff,  { color: scoreColor }]}>{descriptor.diffLabel}</Text>
            <Text style={[styles.scorePillLabel, { color: scoreColor }]}>{descriptor.label}</Text>
          </View>
        ) : (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>À jouer</Text>
          </View>
        )}
      </View>

      {/* Par · HCP · Distance */}
      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>Par {holeView.par}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>HCP {holeView.handicapIndex}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={[styles.metaItem, styles.metaDist]}>{distance}m</Text>
        {holeView.distanceSource !== 'catalog' && (
          <AppBadge label="Estimée" tone="neutral" style={styles.estimationBadge} />
        )}
      </View>

      {/* Live GPS distances to the green, when available */}
      {hasLiveGreenDistances && liveGreenDistances ? (
        <View style={styles.gpsRow}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsLabel}>
            {[
              liveGreenDistances.front != null ? `Avant ${liveGreenDistances.front}m` : null,
              liveGreenDistances.center != null ? `Milieu ${liveGreenDistances.center}m` : null,
              liveGreenDistances.back != null ? `Fond ${liveGreenDistances.back}m` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : gpsHintLabel ? (
        <Text style={styles.gpsHint}>{gpsHintLabel}</Text>
      ) : null}

      {/* Difficulty + hazard chips */}
      <View style={styles.chipsRow}>
        <View style={[styles.badge, diffBadgeStyle]}>
          <Text style={[styles.badgeText, diffTextStyle]}>{holeView.difficultyLabel}</Text>
        </View>
        {holeView.hazards
          .filter((h) => h !== 'bunker')
          .map((hazard) => (
            <View key={hazard} style={styles.badge}>
              <Text style={styles.badgeText}>{hazardLabel(hazard)}</Text>
            </View>
          ))}
      </View>

      {/* Tee selector — compact pill row */}
      {teeOptions.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.teeRow}
        >
          {teeOptions.map((tee) => {
            const active   = tee.key === teeKey;
            const teeDist  = holeView.distanceByTee[tee.key] ?? distance;
            return (
              <TouchableOpacity
                key={tee.key}
                style={[
                  styles.teeChip,
                  active && { borderColor: tee.color, backgroundColor: tee.color + '18' },
                ]}
                onPress={() => onSelectTee(tee.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.teeDot, { backgroundColor: tee.color }]} />
                <Text style={[styles.teeLabel, active && { color: tee.color }]}>
                  {tee.shortLabel ?? tee.label} · {teeDist}m
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },

  courseName: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
  },

  // ── Hero row ──
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  holeNum: {
    fontSize: 96,
    lineHeight: 100,
    fontWeight: '900' as const,
    color: Colors.text,
    letterSpacing: -3,
  },
  scorePill: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    minWidth: 72,
  },
  scorePillDiff: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900' as const,
  },
  scorePillLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  pendingPill: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    minWidth: 72,
  },
  pendingText: {
    ...Typography.label,
    color: Colors.textDim,
  },

  // ── Metadata ──
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  metaItem: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  metaDot: {
    ...Typography.body,
    color: Colors.textDim,
  },
  metaDist: {
    color: Colors.text,
  },
  estimationBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },

  // ── Live GPS ──
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentBlue,
  },
  gpsLabel: {
    ...Typography.caption,
    color: Colors.accentBlue,
    fontWeight: '600' as const,
  },
  gpsHint: {
    ...Typography.caption,
    color: Colors.textDim,
    textAlign: 'center',
  },

  // ── Chips ──
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeWarn: {
    borderColor: Colors.warning + '88',
    backgroundColor: Colors.warning + '14',
  },
  badgeGood: {
    borderColor: Colors.accentBlue + '88',
    backgroundColor: Colors.accentBlue + '14',
  },
  badgeNeutral: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgeTextWarn:    { color: Colors.warning },
  badgeTextGood:    { color: Colors.accentBlue },
  badgeTextNeutral: { color: Colors.textMuted },

  // ── Tee selector ──
  teeRow: {
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  teeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  teeDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  teeLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
});
