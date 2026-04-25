import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { RoundDraftHole } from '../../types';
import { getQuickScoreOptions, getScoreDescriptor } from '../../lib/hole-view';

type Props = {
  hole: RoundDraftHole;
  metricsExpanded: boolean;
  onToggleMetrics: () => void;
  onApplyScore: (score: number) => void;
  onChangeHole: (patch: Partial<RoundDraftHole>) => void;
  onResetHole: () => void;
};

export function HoleScoringPanel({
  hole,
  metricsExpanded,
  onToggleMetrics,
  onApplyScore,
  onChangeHole,
  onResetHole,
}: Props) {
  const descriptor = useMemo(() => getScoreDescriptor(hole.score, hole.par), [hole.score, hole.par]);
  const quickScores = useMemo(() => getQuickScoreOptions(hole.par), [hole.par]);

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Execution</Text>
          <Text style={styles.title}>Score du trou</Text>
          <Text style={styles.subtitle}>
            {hole.completed ? 'Le score principal est verrouillé et peut être affiné.' : 'Commence par saisir le score principal.'}
          </Text>
        </View>
        <AppBadge label={hole.completed ? 'Validé' : 'En cours'} tone={hole.completed ? 'primary' : 'warning'} />
      </View>

      <View style={styles.board}>
        <TouchableOpacity style={styles.controlButton} onPress={() => onApplyScore(Math.max(1, hole.score - 1))}>
          <Text style={styles.controlButtonText}>−</Text>
        </TouchableOpacity>

        <View style={styles.scoreCore}>
          <Text style={[styles.scoreDiff, getToneStyle(descriptor.tone)]}>{descriptor.diffLabel}</Text>
          <Text style={styles.scoreValue}>{hole.score}</Text>
          <Text style={[styles.scoreLabel, getToneStyle(descriptor.tone)]}>{descriptor.label}</Text>
        </View>

        <TouchableOpacity style={styles.controlButton} onPress={() => onApplyScore(Math.min(15, hole.score + 1))}>
          <Text style={styles.controlButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        {quickScores.map((option) => {
          const isActive = hole.completed && hole.score === option.score;

          return (
            <TouchableOpacity
              key={`${hole.hole_number}-${option.score}`}
              style={[styles.quickTile, isActive && styles.quickTileActive]}
              onPress={() => onApplyScore(option.score)}
            >
              <Text style={[styles.quickTileValue, isActive && styles.quickTileValueActive]}>{option.score}</Text>
              <Text style={[styles.quickTileLabel, isActive && styles.quickTileLabelActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.telemetryStrip}>
        <TelemetryPill label="Putts" value={`${hole.putts}`} />
        <TelemetryPill label="GIR" value={hole.gir ? 'Oui' : 'Non'} />
        <TelemetryPill label="Fairway" value={hole.par > 3 ? (hole.fairway_hit ? 'Oui' : 'Non') : 'n/a'} />
        <TelemetryPill label="Pen" value={`${hole.penalty}`} />
      </View>

      <TouchableOpacity style={styles.metricsToggle} onPress={onToggleMetrics}>
        <View>
          <Text style={styles.metricsToggleTitle}>Télémétrie avancée</Text>
          <Text style={styles.metricsToggleSubtitle}>Putts, GIR, fairway, pénalités</Text>
        </View>
        <Text style={styles.metricsToggleArrow}>{metricsExpanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      {metricsExpanded ? (
        <View style={styles.metricsPanel}>
          <View style={styles.metricsRow}>
            <MetricStepper
              label="Putts"
              value={hole.putts}
              min={0}
              max={6}
              onChange={(value) => onChangeHole({ putts: value })}
            />
            <MetricStepper
              label="Pénalités"
              value={hole.penalty}
              min={0}
              max={5}
              onChange={(value) => onChangeHole({ penalty: value })}
            />
          </View>

          <View style={styles.toggleRow}>
            <ToggleTile label="Green en régulation" value={hole.gir} onPress={() => onChangeHole({ gir: !hole.gir })} />
            {hole.par > 3 ? (
              <ToggleTile
                label="Fairway touché"
                value={hole.fairway_hit === true}
                onPress={() => onChangeHole({ fairway_hit: hole.fairway_hit === true ? false : true })}
              />
            ) : (
              <View style={[styles.toggleTile, styles.toggleTileDisabled]}>
                <Text style={styles.toggleTileDisabledLabel}>Fairway non pertinent</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={onResetHole}>
            <Text style={styles.resetButtonText}>Réinitialiser ce trou</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </AppCard>
  );
}

function MetricStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricRow}>
        <TouchableOpacity style={styles.metricButton} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.metricButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.metricValue}>{value}</Text>
        <TouchableOpacity style={styles.metricButton} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={styles.metricButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ToggleTile({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.toggleTile, value && styles.toggleTileActive]} onPress={onPress}>
      <Text style={[styles.toggleTileLabel, value && styles.toggleTileLabelActive]}>{label}</Text>
      <Text style={[styles.toggleTileValue, value && styles.toggleTileValueActive]}>{value ? 'Oui' : 'Non'}</Text>
    </TouchableOpacity>
  );
}

function TelemetryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.telemetryPill}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      <Text style={styles.telemetryValue}>{value}</Text>
    </View>
  );
}

function getToneStyle(tone: ReturnType<typeof getScoreDescriptor>['tone']) {
  switch (tone) {
    case 'elite':
      return styles.toneElite;
    case 'positive':
      return styles.tonePositive;
    case 'warning':
      return styles.toneWarning;
    case 'danger':
      return styles.toneDanger;
    default:
      return styles.toneNeutral;
  }
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
    ...Typography.titleMd,
    color: Colors.text,
    marginTop: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    color: Colors.text,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '900',
  },
  scoreCore: {
    flex: 1,
    alignItems: 'center',
  },
  scoreDiff: {
    ...Typography.caption,
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  scoreValue: {
    ...Typography.display,
    color: Colors.text,
    fontSize: 64,
    lineHeight: 68,
  },
  scoreLabel: {
    ...Typography.bodyStrong,
    marginTop: 4,
  },
  toneElite: {
    color: Colors.warning,
  },
  tonePositive: {
    color: Colors.primary,
  },
  toneNeutral: {
    color: Colors.text,
  },
  toneWarning: {
    color: Colors.warning,
  },
  toneDanger: {
    color: Colors.error,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  quickTile: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  quickTileActive: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.primary,
  },
  quickTileValue: {
    ...Typography.heading,
    color: Colors.text,
  },
  quickTileValueActive: {
    color: Colors.primary,
  },
  quickTileLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  quickTileLabelActive: {
    color: Colors.text,
  },
  telemetryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  telemetryPill: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  telemetryLabel: {
    ...Typography.caption,
    color: Colors.textDim,
  },
  telemetryValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: 2,
  },
  metricsToggle: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.backgroundSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  metricsToggleTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  metricsToggleSubtitle: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 2,
  },
  metricsToggleArrow: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  metricsPanel: {
    marginTop: Spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricTile: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  metricLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  metricButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricButtonText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  metricValue: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  toggleTile: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  toggleTileActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  toggleTileDisabled: {
    opacity: 0.5,
  },
  toggleTileLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  toggleTileLabelActive: {
    color: Colors.primary,
  },
  toggleTileValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  toggleTileValueActive: {
    color: Colors.text,
  },
  toggleTileDisabledLabel: {
    ...Typography.bodyStrong,
    color: Colors.textDim,
  },
  resetButton: {
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  resetButtonText: {
    ...Typography.bodyStrong,
    color: Colors.error,
  },
});
