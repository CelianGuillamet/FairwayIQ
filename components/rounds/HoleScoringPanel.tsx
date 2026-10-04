import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeStrokes, formatRemainingHoles, getNotationWord, getRelativeLabel } from '../../lib/score-labels';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { RoundDraftHole } from '../../types';
import { AppButton } from '../ui/AppButton';
import { Icon } from '../ui/Icon';

type Props = {
  hole: RoundDraftHole;
  onApplyScore: (score: number, options?: { autoAdvance?: boolean }) => void;
  onChangeHole: (patch: Partial<RoundDraftHole>) => void;
  onResetHole: () => void;
};

type ActionBarProps = {
  hole: RoundDraftHole;
  canGoNext: boolean;
  canSave: boolean;
  loading: boolean;
  remainingHoles: number;
  onNextHole: () => void;
  onSave: () => void;
};

const STROKES = [1, 2, 3, 4, 5, 6] as const;
const PUTTS = [0, 1, 2, 3, 4] as const;
const OVERFLOW_FROM = 7;
const MAX_SCORE = 15;
const MAX_PENALTY = 5;

export function HoleScoringPanel({ hole, onApplyScore, onChangeHole, onResetHole }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const overflowSelected = hole.completed && hole.score >= OVERFLOW_FROM;
  const fairwayAvailable = hole.par > 3;
  const fairwayOn = hole.fairway_hit === true;

  const applyScore = (score: number) => onApplyScore(score, { autoAdvance: false });

  return (
    <View style={styles.panel}>
      <View>
        <Text style={styles.fieldLabel}>Coups</Text>
        <View style={styles.strokes}>
          {STROKES.map((strokes) => {
            const selected = hole.completed && hole.score === strokes;
            const relative = getRelativeLabel(strokes, hole.par);

            return (
              <Pressable
                key={strokes}
                style={({ pressed }) => [styles.strokeCell, selected && styles.cellSelected, pressed && styles.pressed]}
                onPress={() => applyScore(strokes)}
                accessibilityRole="button"
                accessibilityLabel={describeStrokes(strokes, hole.par)}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.strokeNumber, selected && styles.cellSelectedText]}>{strokes}</Text>
                <Text style={[styles.strokeRelative, selected && styles.cellSelectedSubtle]}>
                  {relative || ' '}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [styles.strokeCell, overflowSelected && styles.cellSelected, pressed && styles.pressed]}
            onPress={() => applyScore(overflowSelected ? hole.score : OVERFLOW_FROM)}
            accessibilityRole="button"
            accessibilityLabel="7 coups ou plus"
            accessibilityState={{ selected: overflowSelected }}
          >
            <Text style={[styles.strokeNumber, overflowSelected && styles.cellSelectedText]}>7+</Text>
            <Text style={styles.strokeRelative}> </Text>
          </Pressable>
        </View>

        {overflowSelected ? (
          <View style={styles.stepper}>
            <Pressable
              style={({ pressed }) => [
                styles.stepButton,
                hole.score <= OVERFLOW_FROM && styles.stepButtonOff,
                pressed && styles.pressed,
              ]}
              onPress={() => applyScore(Math.max(OVERFLOW_FROM, hole.score - 1))}
              disabled={hole.score <= OVERFLOW_FROM}
              accessibilityRole="button"
              accessibilityLabel="Un coup de moins"
              accessibilityState={{ disabled: hole.score <= OVERFLOW_FROM }}
            >
              <Icon name="minus" size={24} color={colors.ink} />
            </Pressable>
            <View style={styles.stepperValue} accessible accessibilityLabel={describeStrokes(hole.score, hole.par)}>
              <Text style={styles.stepperNumber}>{hole.score}</Text>
              <Text style={styles.stepperWord}>{getNotationWord(hole.score, hole.par)}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.stepButton,
                hole.score >= MAX_SCORE && styles.stepButtonOff,
                pressed && styles.pressed,
              ]}
              onPress={() => applyScore(Math.min(MAX_SCORE, hole.score + 1))}
              disabled={hole.score >= MAX_SCORE}
              accessibilityRole="button"
              accessibilityLabel="Un coup de plus"
              accessibilityState={{ disabled: hole.score >= MAX_SCORE }}
            >
              <Icon name="plus" size={24} color={colors.ink} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View>
        <Text style={styles.fieldLabel}>Putts</Text>
        <View style={styles.putts}>
          {PUTTS.map((putts) => {
            const selected = hole.putts === putts;
            const disabled = putts > hole.score;

            return (
              <Pressable
                key={putts}
                style={({ pressed }) => [
                  styles.puttCell,
                  selected && styles.cellSelected,
                  disabled && styles.puttCellOff,
                  pressed && styles.pressed,
                ]}
                onPress={() => onChangeHole({ putts })}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${putts} putt${putts > 1 ? 's' : ''}`}
                accessibilityState={{ selected, disabled }}
              >
                <Text style={[styles.puttNumber, selected && styles.cellSelectedText, disabled && styles.puttNumberOff]}>
                  {putts}
                </Text>
              </Pressable>
            );
          })}
          {hole.putts > PUTTS[PUTTS.length - 1] ? (
            <View
              style={[styles.puttCell, styles.cellSelected]}
              accessible
              accessibilityLabel={`${hole.putts} putts`}
              accessibilityState={{ selected: true }}
            >
              <Text style={[styles.puttNumber, styles.cellSelectedText]}>{hole.putts}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.toggles}>
        <Pressable
          style={({ pressed }) => [styles.toggle, hole.gir && styles.toggleOn, pressed && styles.pressed]}
          onPress={() => onChangeHole({ gir: !hole.gir })}
          accessibilityRole="button"
          accessibilityLabel="Green en régulation"
          accessibilityState={{ selected: hole.gir }}
        >
          {hole.gir ? <Icon name="check" size={16} strokeWidth={2.5} color={colors.green} /> : null}
          <Text style={[styles.toggleText, hole.gir && styles.toggleTextOn]}>Green</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.toggle,
            fairwayOn && styles.toggleOn,
            !fairwayAvailable && styles.toggleOff,
            pressed && styles.pressed,
          ]}
          onPress={() => onChangeHole({ fairway_hit: !fairwayOn })}
          disabled={!fairwayAvailable}
          accessibilityRole="button"
          accessibilityLabel="Fairway"
          accessibilityHint={fairwayAvailable ? undefined : 'Indisponible sur un par 3'}
          accessibilityState={{ selected: fairwayOn, disabled: !fairwayAvailable }}
        >
          {fairwayOn ? <Icon name="check" size={16} strokeWidth={2.5} color={colors.green} /> : null}
          <Text style={[styles.toggleText, fairwayOn && styles.toggleTextOn, !fairwayAvailable && styles.toggleTextOff]}>
            Fairway
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.toggle,
            hole.penalty > 0 && styles.togglePenalty,
            pressed && styles.pressed,
          ]}
          onPress={() => onChangeHole({ penalty: hole.penalty < MAX_PENALTY ? hole.penalty + 1 : 0 })}
          accessibilityRole="button"
          accessibilityLabel={hole.penalty > 0 ? `Pénalités : ${hole.penalty}` : 'Pénalité'}
          accessibilityHint={`Ajoute une pénalité, revient à zéro après ${MAX_PENALTY}`}
          accessibilityState={{ selected: hole.penalty > 0 }}
        >
          <Text style={[styles.toggleText, hole.penalty > 0 && styles.toggleTextPenalty]}>
            {hole.penalty > 0 ? `${hole.penalty} pénalité${hole.penalty > 1 ? 's' : ''}` : 'Pénalité'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        onPress={onResetHole}
        accessibilityRole="button"
        accessibilityLabel="Réinitialiser le trou"
      >
        <Icon name="refresh" size={18} color={colors.ink2} />
        <Text style={styles.resetText}>Réinitialiser le trou</Text>
      </Pressable>
    </View>
  );
}

export function HoleActionBar({
  hole,
  canGoNext,
  canSave,
  loading,
  remainingHoles,
  onNextHole,
  onSave,
}: ActionBarProps) {
  const styles = useThemedStyles(createStyles);
  const isLastHole = !canGoNext;

  const remainingHint = isLastHole && !canSave ? formatRemainingHoles(remainingHoles) : undefined;
  const accessibilityHint =
    remainingHint ?? (!isLastHole && !hole.completed ? 'Choisis d’abord le nombre de coups' : undefined);

  return (
    <View style={styles.footer}>
      {remainingHint ? <Text style={styles.footerHint}>{remainingHint}</Text> : null}
      {isLastHole ? (
        <AppButton
          label="Terminer le round"
          icon="check"
          iconPosition="right"
          onPress={onSave}
          disabled={!canSave}
          loading={loading}
          accessibilityHint={accessibilityHint}
          style={styles.cta}
        />
      ) : (
        <AppButton
          label="Trou suivant"
          icon="chevron-right"
          iconPosition="right"
          onPress={onNextHole}
          disabled={!hole.completed}
          accessibilityHint={accessibilityHint}
          style={styles.cta}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: {
      gap: Spacing.md,
    },
    fieldLabel: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: Spacing.xs,
    },
    pressed: {
      opacity: 0.7,
    },
    cellSelected: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    cellSelectedText: {
      color: colors.onInk,
    },
    cellSelectedSubtle: {
      color: colors.onInk,
      opacity: 0.8,
    },

    strokes: {
      flexDirection: 'row',
      gap: 4,
    },
    strokeCell: {
      flex: 1,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
    },
    strokeNumber: {
      fontFamily: Fonts.sansBold,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
      ...Numerals,
    },
    strokeRelative: {
      ...Typography.caption,
      color: colors.ink3,
    },

    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    stepButton: {
      width: 54,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.ink,
      borderRadius: Radius.md,
    },
    stepButtonOff: {
      borderColor: colors.line,
      opacity: 0.5,
    },
    stepperValue: {
      flex: 1,
      alignItems: 'center',
    },
    stepperNumber: {
      ...Typography.title,
      ...Numerals,
      color: colors.ink,
    },
    stepperWord: {
      ...Typography.caption,
      color: colors.ink2,
    },

    putts: {
      flexDirection: 'row',
      gap: 6,
    },
    puttCell: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
    },
    puttCellOff: {
      backgroundColor: 'transparent',
      borderStyle: 'dashed',
    },
    puttNumber: {
      fontFamily: Fonts.sansBold,
      fontSize: 17,
      lineHeight: 22,
      color: colors.ink,
      ...Numerals,
    },
    puttNumberOff: {
      color: colors.ink3,
    },

    toggles: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    toggle: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: Spacing.xs,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      borderRadius: Radius.full,
    },
    toggleOn: {
      backgroundColor: colors.greenBg,
      borderColor: colors.green,
    },
    toggleOff: {
      borderStyle: 'dashed',
      borderColor: colors.line,
    },
    togglePenalty: {
      backgroundColor: colors.warningBg,
      borderColor: colors.warning,
    },
    toggleText: {
      ...Typography.bodyStrong,
      fontSize: 14,
      color: colors.ink,
    },
    toggleTextOn: {
      color: colors.green,
    },
    toggleTextOff: {
      color: colors.ink3,
    },
    toggleTextPenalty: {
      color: colors.warning,
    },

    reset: {
      alignSelf: 'center',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
    },
    resetText: {
      ...Typography.bodyStrong,
      fontSize: 14,
      color: colors.ink2,
    },

    footer: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: Spacing.xs,
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    footerHint: {
      ...Typography.caption,
      color: colors.ink2,
      textAlign: 'center',
    },
    cta: {
      minHeight: 54,
    },
  });
