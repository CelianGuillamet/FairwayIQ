import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeStrokes } from '../../lib/score-labels';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { RoundDraftHole } from '../../types';
import { AppBadge } from '../ui/AppBadge';
import { Icon } from '../ui/Icon';
import { ScoreMark } from '../ui/ScoreMark';

type Props = {
  title: string;
  holes: RoundDraftHole[];
  editable?: boolean;
  onChangeHole?: (holeNumber: number, patch: Partial<RoundDraftHole>) => void;
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function HoleScorecard({ title, holes, editable = true, onChangeHole }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {editable ? <AppBadge label="Édition" tone="neutral" /> : null}
      </View>

      <ScoreGrid holes={holes} />

      {editable
        ? holes.map((hole) => <HoleEditor key={hole.hole_number} hole={hole} onChangeHole={onChangeHole} />)
        : null}
    </View>
  );
}

function ScoreGrid({ holes }: { holes: RoundDraftHole[] }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      <View
        style={[styles.gridRow, styles.gridHeader]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.rowLabel}>Trou</Text>
        {holes.map((hole) => (
          <Text key={hole.hole_number} style={[styles.cell, styles.cellMuted]}>
            {hole.hole_number}
          </Text>
        ))}
        <Text style={[styles.total, styles.cellMuted]}>Tot.</Text>
      </View>

      <View
        style={styles.gridRow}
        accessible
        accessibilityLabel={`Par : ${holes.map((hole) => hole.par).join(', ')}. Total ${sum(holes.map((hole) => hole.par))}`}
      >
        <Text style={styles.rowLabel}>Par</Text>
        {holes.map((hole) => (
          <Text key={hole.hole_number} style={[styles.cell, styles.cellPar]}>
            {hole.par}
          </Text>
        ))}
        <Text style={[styles.total, styles.cellPar]}>{sum(holes.map((hole) => hole.par))}</Text>
      </View>

      <View style={[styles.gridRow, styles.scoreRow]}>
        <Text style={styles.rowLabel}>Score</Text>
        {holes.map((hole) => (
          <View key={hole.hole_number} style={styles.markCell}>
            <ScoreMark
              strokes={hole.score}
              par={hole.par}
              size="sm"
              accessibilityLabel={`Trou ${hole.hole_number}, ${describeStrokes(hole.score, hole.par)}`}
            />
          </View>
        ))}
        <Text style={[styles.total, styles.totalScore]}>{sum(holes.map((hole) => hole.score))}</Text>
      </View>
    </View>
  );
}

function HoleEditor({
  hole,
  onChangeHole,
}: {
  hole: RoundDraftHole;
  onChangeHole?: (holeNumber: number, patch: Partial<RoundDraftHole>) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fairwayAvailable = hole.par > 3;
  const fairwayOn = hole.fairway_hit === true;
  const change = (patch: Partial<RoundDraftHole>) => onChangeHole?.(hole.hole_number, patch);

  return (
    <View style={styles.editor}>
      <View style={styles.editorHeader}>
        <ScoreMark strokes={hole.score} par={hole.par} size="md" label={hole.hole_number} decorative />
        <View>
          <Text style={styles.editorTitle}>Trou {hole.hole_number}</Text>
          <Text style={styles.editorMeta}>Par {hole.par}</Text>
        </View>
      </View>

      <View style={styles.steppers}>
        <StepControl
          label="Score"
          noun="le score"
          value={hole.score}
          min={1}
          max={15}
          onChange={(value) => change({ score: value })}
        />
        <StepControl
          label="Par"
          noun="le par"
          value={hole.par}
          min={3}
          max={6}
          onChange={(value) => change({ par: value })}
        />
        <StepControl
          label="Putts"
          noun="les putts"
          value={hole.putts}
          min={0}
          max={6}
          onChange={(value) => change({ putts: value })}
        />
        <StepControl
          label="Pénalités"
          noun="les pénalités"
          value={hole.penalty}
          min={0}
          max={5}
          onChange={(value) => change({ penalty: value })}
        />
      </View>

      <View style={styles.toggles}>
        <Pressable
          style={({ pressed }) => [styles.toggle, hole.gir && styles.toggleOn, pressed && styles.pressed]}
          onPress={() => change({ gir: !hole.gir })}
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
          onPress={() => change({ fairway_hit: !fairwayOn })}
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
      </View>
    </View>
  );
}

function StepControl({
  label,
  noun,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  noun: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          style={({ pressed }) => [styles.stepButton, atMin && styles.stepButtonOff, pressed && styles.pressed]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${noun}`}
          accessibilityState={{ disabled: atMin }}
        >
          <Icon name="minus" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.stepValue} accessibilityLabel={`${label} : ${value}`}>
          {value}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.stepButton, atMax && styles.stepButtonOff, pressed && styles.pressed]}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${noun}`}
          accessibilityState={{ disabled: atMax }}
        >
          <Icon name="plus" size={18} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const ROW_LABEL_WIDTH = 44;
const TOTAL_WIDTH = 36;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
    },
    pressed: {
      opacity: 0.7,
    },

    gridRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 30,
    },
    gridHeader: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    scoreRow: {
      minHeight: 40,
    },
    rowLabel: {
      ...Typography.caption,
      fontFamily: Fonts.sansSemiBold,
      width: ROW_LABEL_WIDTH,
      color: colors.ink3,
    },
    cell: {
      ...Typography.body,
      ...Numerals,
      flex: 1,
      fontSize: 13,
      textAlign: 'center',
    },
    cellMuted: {
      color: colors.ink3,
    },
    cellPar: {
      color: colors.ink2,
    },
    markCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    total: {
      ...Typography.bodyStrong,
      ...Numerals,
      width: TOTAL_WIDTH,
      fontSize: 13,
      textAlign: 'center',
    },
    totalScore: {
      fontSize: 14,
      color: colors.ink,
    },

    editor: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    editorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    editorTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    editorMeta: {
      ...Typography.caption,
      color: colors.ink3,
    },
    steppers: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    metric: {
      flexGrow: 1,
      flexBasis: '45%',
      gap: 4,
    },
    metricLabel: {
      ...Typography.label,
      color: colors.ink2,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
      backgroundColor: colors.bg,
    },
    stepButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonOff: {
      opacity: 0.35,
    },
    stepValue: {
      ...Typography.titleMd,
      ...Numerals,
      color: colors.ink,
    },
    toggles: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    toggle: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
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
  });
