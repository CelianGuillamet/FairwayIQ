import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppBadge } from '../ui/AppBadge';
import { AppCard } from '../ui/AppCard';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { RoundDraftHole } from '../../types';
import { getScoreDescriptor } from '../../lib/hole-view';

type Props = {
  hole: RoundDraftHole;
  onApplyScore: (score: number, options?: { autoAdvance?: boolean }) => void;
  onChangeHole: (patch: Partial<RoundDraftHole>) => void;
  onResetHole: () => void;
};

type ScoreChoice =
  | {
      key: string;
      type: 'score';
      score: number;
      title: string;
      subtitle: string;
      tone: ReturnType<typeof getScoreDescriptor>['tone'];
    }
  | {
      key: string;
      type: 'custom';
      title: string;
      subtitle: string;
    };

const PUTT_PRESETS = [0, 1, 2, 3, 4] as const;
const PENALTY_PRESETS = [0, 1, 2, 3] as const;

export function HoleScoringPanel({ hole, onApplyScore, onChangeHole, onResetHole }: Props) {
  const descriptor = useMemo(() => getScoreDescriptor(hole.score, hole.par), [hole.score, hole.par]);
  const scoreChoices = useMemo(() => buildScoreChoices(hole.par), [hole.par]);
  const quickScoreValues = useMemo(
    () => scoreChoices.flatMap((choice) => (choice.type === 'score' ? [choice.score] : [])),
    [scoreChoices]
  );
  const [customScoreOpen, setCustomScoreOpen] = useState(!quickScoreValues.includes(hole.score));

  useEffect(() => {
    setCustomScoreOpen(!quickScoreValues.includes(hole.score));
  }, [hole.hole_number, hole.par, hole.score, quickScoreValues]);

  const canDecrementScore = hole.score > 1;
  const canIncrementScore = hole.score < 15;
  const canIncrementPutts = hole.putts < 6 && hole.putts < hole.score;
  const canIncrementPenalty = hole.penalty < 5;

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Fast lane</Text>
          <Text style={styles.title}>Score d’abord, détails ensuite</Text>
          <Text style={styles.subtitle}>
            Un tap sur un score sauvegarde le trou. Les métriques restent modifiables sans quitter l’écran.
          </Text>
        </View>
        <AppBadge label={hole.completed ? 'Saisi' : 'À saisir'} tone={hole.completed ? 'primary' : 'warning'} />
      </View>

      <View style={styles.scoreHero}>
        <Text style={[styles.scoreDiff, getToneStyle(descriptor.tone)]}>{descriptor.diffLabel}</Text>
        <Text style={styles.scoreValue}>{hole.score}</Text>
        <Text style={[styles.scoreLabel, getToneStyle(descriptor.tone)]}>{descriptor.label}</Text>
      </View>

      <View style={styles.choiceGrid}>
        {scoreChoices.map((choice) => {
          if (choice.type === 'custom') {
            const isActive = customScoreOpen;

            return (
              <TouchableOpacity
                key={choice.key}
                style={[styles.choiceTile, isActive && styles.choiceTileActive]}
                onPress={() => setCustomScoreOpen((currentValue) => !currentValue)}
              >
                <Text style={[styles.choiceTitle, isActive && styles.choiceTitleActive]}>{choice.title}</Text>
                <Text style={[styles.choiceSubtitle, isActive && styles.choiceSubtitleActive]}>{choice.subtitle}</Text>
              </TouchableOpacity>
            );
          }

          const isActive = hole.completed && hole.score === choice.score && !customScoreOpen;

          return (
            <TouchableOpacity
              key={choice.key}
              style={[styles.choiceTile, isActive && styles.choiceTileActive]}
              onPress={() => onApplyScore(choice.score, { autoAdvance: true })}
            >
              <Text style={[styles.choiceTitle, getToneStyle(choice.tone), isActive && styles.choiceTitleActive]}>
                {choice.title}
              </Text>
              <Text style={[styles.choiceSubtitle, isActive && styles.choiceSubtitleActive]}>{choice.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {customScoreOpen ? (
        <View style={styles.customScorePanel}>
          <View style={styles.customScoreHeader}>
            <Text style={styles.customScoreTitle}>Score rare ou ajustement fin</Text>
            <Text style={styles.customScoreSubtitle}>Les boutons +/- évitent d’encombrer le chemin principal.</Text>
          </View>

          <View style={styles.customScoreControls}>
            <TouchableOpacity
              style={[styles.adjustButton, !canDecrementScore && styles.adjustButtonDisabled]}
              onPress={() => onApplyScore(Math.max(1, hole.score - 1), { autoAdvance: false })}
              disabled={!canDecrementScore}
            >
              <Text style={styles.adjustButtonLabel}>−</Text>
            </TouchableOpacity>

            <View style={styles.customScoreValueShell}>
              <Text style={styles.customScoreValue}>{hole.score}</Text>
            </View>

            <TouchableOpacity
              style={[styles.adjustButton, !canIncrementScore && styles.adjustButtonDisabled]}
              onPress={() => onApplyScore(Math.min(15, hole.score + 1), { autoAdvance: false })}
              disabled={!canIncrementScore}
            >
              <Text style={styles.adjustButtonLabel}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.metricsSection}>
        <Text style={styles.metricsTitle}>Stats rapides</Text>

        <MetricSelector
          label="Putts"
          value={hole.putts}
          presets={PUTT_PRESETS}
          canDecrement={hole.putts > 0}
          canIncrement={canIncrementPutts}
          onDecrement={() => onChangeHole({ putts: Math.max(0, hole.putts - 1) })}
          onIncrement={() => onChangeHole({ putts: Math.min(hole.score, hole.putts + 1) })}
          onSelect={(value) => onChangeHole({ putts: value })}
          isValueDisabled={(value) => value > hole.score}
        />

        <MetricSelector
          label="Pénalités"
          value={hole.penalty}
          presets={PENALTY_PRESETS}
          canDecrement={hole.penalty > 0}
          canIncrement={canIncrementPenalty}
          onDecrement={() => onChangeHole({ penalty: Math.max(0, hole.penalty - 1) })}
          onIncrement={() => onChangeHole({ penalty: Math.min(5, hole.penalty + 1) })}
          onSelect={(value) => onChangeHole({ penalty: value })}
        />

        <BinarySelector
          label="Green en régulation"
          value={hole.gir}
          falseLabel="Non"
          trueLabel="Oui"
          onChange={(nextValue) => onChangeHole({ gir: nextValue })}
        />

        {hole.par > 3 ? (
          <BinarySelector
            label="Fairway"
            value={hole.fairway_hit === true}
            falseLabel="Raté"
            trueLabel="Touché"
            onChange={(nextValue) => onChangeHole({ fairway_hit: nextValue })}
          />
        ) : (
          <View style={styles.infoTile}>
            <Text style={styles.infoTileLabel}>Fairway</Text>
            <Text style={styles.infoTileValue}>Non pertinent sur un par 3</Text>
          </View>
        )}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerHint}>
          Les taps score auto-avancent. Les edits manuels restent sur le trou courant.
        </Text>
        <TouchableOpacity style={styles.resetButton} onPress={onResetHole}>
          <Text style={styles.resetButtonText}>Réinitialiser</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}

function MetricSelector({
  label,
  value,
  presets,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
  onSelect,
  isValueDisabled,
}: {
  label: string;
  value: number;
  presets: readonly number[];
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onSelect: (value: number) => void;
  isValueDisabled?: (value: number) => boolean;
}) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricRow}>
        <TouchableOpacity
          style={[styles.metricEdgeButton, !canDecrement && styles.metricEdgeButtonDisabled]}
          onPress={onDecrement}
          disabled={!canDecrement}
        >
          <Text style={styles.metricEdgeButtonLabel}>−</Text>
        </TouchableOpacity>

        <View style={styles.metricPresetRow}>
          {presets.map((preset) => {
            const disabled = isValueDisabled?.(preset) ?? false;
            const active = value === preset;

            return (
              <TouchableOpacity
                key={`${label}-${preset}`}
                style={[
                  styles.metricChip,
                  active && styles.metricChipActive,
                  disabled && styles.metricChipDisabled,
                ]}
                onPress={() => onSelect(preset)}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.metricChipLabel,
                    active && styles.metricChipLabelActive,
                    disabled && styles.metricChipLabelDisabled,
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.metricEdgeButton, !canIncrement && styles.metricEdgeButtonDisabled]}
          onPress={onIncrement}
          disabled={!canIncrement}
        >
          <Text style={styles.metricEdgeButtonLabel}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BinarySelector({
  label,
  value,
  falseLabel,
  trueLabel,
  onChange,
}: {
  label: string;
  value: boolean;
  falseLabel: string;
  trueLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.binaryRow}>
        <TouchableOpacity
          style={[styles.binaryChip, !value && styles.binaryChipActive]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.binaryChipLabel, !value && styles.binaryChipLabelActive]}>{falseLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.binaryChip, value && styles.binaryChipActive]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.binaryChipLabel, value && styles.binaryChipLabelActive]}>{trueLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function buildScoreChoices(par: number): ScoreChoice[] {
  const eagleScore = Math.max(1, par - 2);
  const birdieScore = Math.max(1, par - 1);
  const parScore = par;
  const bogeyScore = par + 1;
  const doubleScore = par + 2;

  return [
    buildScoreChoice('birdie', birdieScore, par),
    buildScoreChoice('par', parScore, par),
    buildScoreChoice('bogey', bogeyScore, par),
    buildScoreChoice('eagle', eagleScore, par),
    buildScoreChoice('double', doubleScore, par),
    {
      key: 'custom',
      type: 'custom',
      title: 'Autre',
      subtitle: 'Score rare',
    },
  ];
}

function buildScoreChoice(key: string, score: number, par: number): ScoreChoice {
  const descriptor = getScoreDescriptor(score, par);

  return {
    key,
    type: 'score',
    score,
    title: `${score}`,
    subtitle: descriptor.label,
    tone: descriptor.tone,
  };
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
    letterSpacing: 1,
  },
  title: {
    ...Typography.titleMd,
    color: Colors.text,
    marginTop: 6,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  scoreHero: {
    marginTop: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  scoreDiff: {
    ...Typography.caption,
    letterSpacing: 1.1,
  },
  scoreValue: {
    ...Typography.display,
    color: Colors.text,
    fontSize: 72,
    lineHeight: 76,
    marginTop: 8,
  },
  scoreLabel: {
    ...Typography.bodyStrong,
    marginTop: 6,
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
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  choiceTile: {
    width: '31%',
    minHeight: 82,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceTileActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  choiceTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  choiceTitleActive: {
    color: Colors.primary,
  },
  choiceSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  choiceSubtitleActive: {
    color: Colors.text,
  },
  customScorePanel: {
    marginTop: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.md,
  },
  customScoreHeader: {
    alignItems: 'center',
  },
  customScoreTitle: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  customScoreSubtitle: {
    ...Typography.caption,
    color: Colors.textDim,
    marginTop: 4,
    textAlign: 'center',
  },
  customScoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  adjustButton: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonDisabled: {
    opacity: 0.35,
  },
  adjustButtonLabel: {
    color: Colors.text,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
  },
  customScoreValueShell: {
    flex: 1,
    minHeight: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customScoreValue: {
    ...Typography.display,
    color: Colors.text,
    fontSize: 46,
    lineHeight: 50,
  },
  metricsSection: {
    marginTop: Spacing.lg,
  },
  metricsTitle: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  metricBlock: {
    marginTop: Spacing.sm,
  },
  metricLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricEdgeButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricEdgeButtonDisabled: {
    opacity: 0.35,
  },
  metricEdgeButtonLabel: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  metricPresetRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  metricChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  metricChipDisabled: {
    opacity: 0.28,
  },
  metricChipLabel: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  metricChipLabelActive: {
    color: Colors.primary,
  },
  metricChipLabelDisabled: {
    color: Colors.textDim,
  },
  binaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  binaryChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  binaryChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  binaryChipLabel: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  binaryChipLabelActive: {
    color: Colors.primary,
  },
  infoTile: {
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  infoTileLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoTileValue: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  footerRow: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  footerHint: {
    ...Typography.caption,
    color: Colors.textDim,
    flex: 1,
  },
  resetButton: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  resetButtonText: {
    ...Typography.label,
    color: Colors.error,
  },
});
