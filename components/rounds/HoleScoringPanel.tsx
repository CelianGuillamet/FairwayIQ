import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { RoundDraftHole } from '../../types';
import { getScoreDescriptor } from '../../lib/hole-view';

type Props = {
  hole: RoundDraftHole;
  canGoNext: boolean;
  canSave: boolean;
  loading: boolean;
  onApplyScore: (score: number, options?: { autoAdvance?: boolean }) => void;
  onChangeHole: (patch: Partial<RoundDraftHole>) => void;
  onResetHole: () => void;
  onNextHole: () => void;
  onSave: () => void;
};

const PUTTS = [0, 1, 2, 3, 4] as const;

function toneToColor(tone: string): string {
  switch (tone) {
    case 'elite':    return '#FFD055';
    case 'positive': return Colors.primary;
    case 'neutral':  return Colors.text;
    case 'warning':  return Colors.warning;
    default:         return Colors.error;
  }
}

export function HoleScoringPanel({
  hole,
  canGoNext,
  canSave,
  loading,
  onApplyScore,
  onChangeHole,
  onResetHole,
  onNextHole,
  onSave,
}: Props) {
  const [showCustom, setShowCustom] = useState(false);

  // Primary score range: par-2 → par+3 (6 values), always starts at ≥1
  const scoreBase = Math.max(1, hole.par - 2);
  const primaryScores = useMemo(
    () => Array.from({ length: 6 }, (_, i) => scoreBase + i),
    [scoreBase],
  );

  const inPrimary    = primaryScores.includes(hole.score);
  const descriptor   = useMemo(() => getScoreDescriptor(hole.score, hole.par), [hole.score, hole.par]);
  const activeColor  = toneToColor(descriptor.tone);

  function handleScoreTap(score: number) {
    setShowCustom(false);
    onApplyScore(score, { autoAdvance: false });
  }

  return (
    <View style={styles.panel}>

      {/* ── Putts row ── */}
      <View style={styles.puttsRow}>
        <Text style={styles.rowLabel}>Putts</Text>
        <View style={styles.pillGroup}>
          {PUTTS.map((n) => {
            const active    = hole.putts === n;
            const disabled  = n > hole.score;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.pill, active && styles.pillActive, disabled && styles.pillOff]}
                onPress={() => !disabled && onChangeHole({ putts: n })}
                disabled={disabled}
                activeOpacity={0.65}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
          {/* overflow: show current value when > 4 */}
          {hole.putts > 4 && (
            <View style={[styles.pill, styles.pillActive]}>
              <Text style={[styles.pillText, styles.pillTextActive]}>{hole.putts}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Score row or custom stepper ── */}
      {showCustom ? (
        <View style={styles.customRow}>
          <TouchableOpacity
            style={[styles.stepBtn, hole.score <= 1 && styles.stepBtnOff]}
            onPress={() => onApplyScore(Math.max(1, hole.score - 1), { autoAdvance: false })}
            disabled={hole.score <= 1}
            activeOpacity={0.65}
          >
            <Text style={styles.stepBtnLabel}>−</Text>
          </TouchableOpacity>

          <View style={styles.customCenter}>
            <Text style={[styles.customScore, { color: activeColor }]}>{hole.score}</Text>
            <Text style={[styles.customDiff,  { color: activeColor }]}>{descriptor.diffLabel}</Text>
          </View>

          <TouchableOpacity
            style={[styles.stepBtn, hole.score >= 15 && styles.stepBtnOff]}
            onPress={() => onApplyScore(Math.min(15, hole.score + 1), { autoAdvance: false })}
            disabled={hole.score >= 15}
            activeOpacity={0.65}
          >
            <Text style={styles.stepBtnLabel}>+</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => setShowCustom(false)}>
            <Text style={styles.backBtnLabel}>Retour</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scoreRow}>
          {primaryScores.map((score) => {
            const desc    = getScoreDescriptor(score, hole.par);
            const color   = toneToColor(desc.tone);
            const active  = hole.completed && hole.score === score;
            const isPar   = score === hole.par;

            return (
              <TouchableOpacity
                key={score}
                style={[
                  styles.scoreBtn,
                  active  ? { borderColor: color, backgroundColor: color + '18' } :
                  isPar   ? styles.scoreBtnPar : null,
                ]}
                onPress={() => handleScoreTap(score)}
                activeOpacity={0.6}
              >
                <Text style={[
                  styles.scoreBtnNum,
                  { color: active ? color : isPar ? Colors.text : Colors.textMuted },
                ]}>
                  {score}
                </Text>
                <Text style={[styles.scoreBtnHint, { color: active ? color : Colors.textDim }]}>
                  {isPar ? 'par' : desc.diffLabel}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* "more" / overflow button */}
          <TouchableOpacity
            style={[
              styles.scoreBtn,
              !inPrimary && hole.completed
                ? { borderColor: activeColor, backgroundColor: activeColor + '18' }
                : styles.scoreBtnMore,
            ]}
            onPress={() => setShowCustom(true)}
            activeOpacity={0.6}
          >
            {!inPrimary && hole.completed ? (
              <>
                <Text style={[styles.scoreBtnNum, { color: activeColor }]}>{hole.score}</Text>
                <Text style={[styles.scoreBtnHint, { color: activeColor }]}>{descriptor.diffLabel}</Text>
              </>
            ) : (
              <Text style={styles.moreLabel}>···</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Actions row ── */}
      <View style={styles.actionsRow}>
        {/* GIR */}
        <TouchableOpacity
          style={[styles.chip, hole.gir && styles.chipOn]}
          onPress={() => onChangeHole({ gir: !hole.gir })}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, hole.gir && styles.chipTextOn]}>GIR</Text>
        </TouchableOpacity>

        {/* Fairway — hidden for par 3 */}
        {hole.par > 3 ? (
          <TouchableOpacity
            style={[styles.chip, hole.fairway_hit === true && styles.chipOn]}
            onPress={() => onChangeHole({ fairway_hit: hole.fairway_hit !== true })}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, hole.fairway_hit === true && styles.chipTextOn]}>FW</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.chip, styles.chipDim]}>
            <Text style={styles.chipTextDim}>FW</Text>
          </View>
        )}

        {/* Penalty — tap cycles 0→5 then resets */}
        <TouchableOpacity
          style={[styles.chip, hole.penalty > 0 && styles.chipPenalty]}
          onPress={() => onChangeHole({ penalty: hole.penalty < 5 ? hole.penalty + 1 : 0 })}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, hole.penalty > 0 && styles.chipTextPenalty]}>
            {hole.penalty > 0 ? `+${hole.penalty} Pén` : 'Pén'}
          </Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        {/* Reset */}
        <TouchableOpacity style={styles.iconBtn} onPress={onResetHole} activeOpacity={0.7}>
          <Text style={styles.iconBtnLabel}>↺</Text>
        </TouchableOpacity>

        {/* Next hole */}
        {hole.completed && canGoNext && (
          <TouchableOpacity style={styles.nextBtn} onPress={onNextHole} activeOpacity={0.75}>
            <Text style={styles.nextBtnLabel}>→</Text>
          </TouchableOpacity>
        )}

        {/* Finaliser — shown when all holes complete */}
        {canSave && (
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnBusy]}
            onPress={onSave}
            disabled={loading}
            activeOpacity={0.75}
          >
            <Text style={styles.saveBtnLabel}>{loading ? '...' : 'Finaliser'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.backgroundSoft,
    borderTopWidth: 1,
    borderTopColor: Colors.borderStrong,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },

  // ── Putts ──
  puttsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: 42,
  },
  pillGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pill: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  pillOff: {
    opacity: 0.22,
  },
  pillText: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.primary,
  },

  // ── Score row ──
  scoreRow: {
    flexDirection: 'row',
    gap: 5,
  },
  scoreBtn: {
    flex: 1,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreBtnPar: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceElevated,
  },
  scoreBtnMore: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  scoreBtnNum: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800' as const,
  },
  scoreBtnHint: {
    ...Typography.caption,
    letterSpacing: 0.4,
  },
  moreLabel: {
    ...Typography.heading,
    color: Colors.textDim,
    letterSpacing: 3,
    lineHeight: 22,
  },

  // ── Custom stepper ──
  customRow: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: {
    opacity: 0.28,
  },
  stepBtnLabel: {
    color: Colors.text,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900' as const,
  },
  customCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  customScore: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900' as const,
  },
  customDiff: {
    ...Typography.label,
    letterSpacing: 0.5,
  },
  backBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },

  // ── Actions row ──
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
  },
  chip: {
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
  },
  chipDim: {
    opacity: 0.3,
  },
  chipPenalty: {
    borderColor: Colors.error,
  },
  chipText: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  chipTextOn: {
    color: Colors.primary,
  },
  chipTextDim: {
    ...Typography.label,
    color: Colors.textDim,
  },
  chipTextPenalty: {
    color: Colors.error,
  },
  spacer: {
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnLabel: {
    color: Colors.textDim,
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '700' as const,
  },
  nextBtn: {
    height: 44,
    minWidth: 56,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnLabel: {
    color: Colors.background,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800' as const,
  },
  saveBtn: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnBusy: {
    opacity: 0.55,
  },
  saveBtnLabel: {
    ...Typography.bodyStrong,
    color: Colors.background,
  },
});
