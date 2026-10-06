import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals, Spacing } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';
import { ScoreMark } from '../ui/ScoreMark';
import {
  SCORECARD_COLUMNS,
  describeHalfTotal,
  describeHole,
  type ScorecardCell,
  type ScorecardHalf,
} from './scorecard-model';

const COLUMN_SLOTS = Array.from({ length: SCORECARD_COLUMNS }, (_, index) => index);

type Props = {
  halves: ScorecardHalf[];
};

export function ScorecardGrid({ halves }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      {halves.map((half) => (
        <HalfTable key={half.key} half={half} />
      ))}
    </View>
  );
}

function HalfTable({ half }: { half: ScorecardHalf }) {
  const styles = useThemedStyles(createStyles);
  const cellAt = (slot: number): ScorecardCell | undefined => half.cells[slot];
  const hiddenFromReader = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  return (
    <View>
      <View style={[styles.row, styles.headerRow]} {...hiddenFromReader}>
        <Text style={styles.rowLabel}>{half.label}</Text>
        {COLUMN_SLOTS.map((slot) => (
          <Text key={slot} style={[styles.cell, styles.headerCell]}>
            {cellAt(slot)?.number ?? ''}
          </Text>
        ))}
        <Text style={[styles.total, styles.headerCell]}>Tot.</Text>
      </View>

      <View style={styles.row} {...hiddenFromReader}>
        <Text style={styles.rowLabel}>Par</Text>
        {COLUMN_SLOTS.map((slot) => {
          const cell = cellAt(slot);

          return (
            <Text key={slot} style={[styles.cell, styles.parCell]}>
              {cell ? cell.par ?? '–' : ''}
            </Text>
          );
        })}
        <Text style={[styles.total, styles.parCell]}>{half.parTotal ?? '–'}</Text>
      </View>

      <View style={[styles.row, styles.scoreRow]}>
        <Text style={styles.rowLabel} {...hiddenFromReader}>Score</Text>
        {COLUMN_SLOTS.map((slot) => {
          const cell = cellAt(slot);

          return (
            <View key={slot} style={[styles.cell, styles.markCell]}>
              {cell && cell.par != null && cell.strokes != null ? (
                <ScoreMark strokes={cell.strokes} par={cell.par} accessibilityLabel={describeHole(cell)} />
              ) : cell ? (
                <Text style={styles.emptyMark} accessibilityLabel={describeHole(cell)}>–</Text>
              ) : null}
            </View>
          );
        })}
        <Text style={[styles.total, styles.scoreTotal]} accessibilityLabel={describeHalfTotal(half)}>
          {half.scoreTotal ?? '–'}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 30,
    },
    headerRow: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    scoreRow: {
      minHeight: 38,
    },
    rowLabel: {
      width: 46,
      fontFamily: Fonts.sansSemiBold,
      fontSize: 12,
      lineHeight: 16,
      color: colors.ink3,
    },
    cell: {
      flex: 1,
      textAlign: 'center',
      fontFamily: Fonts.sansMedium,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: Numerals.fontVariant,
    },
    markCell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    total: {
      width: 36,
      textAlign: 'center',
      fontFamily: Fonts.sansBold,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: Numerals.fontVariant,
    },
    headerCell: {
      color: colors.ink3,
    },
    parCell: {
      color: colors.ink2,
    },
    scoreTotal: {
      fontSize: 14,
      color: colors.ink,
    },
    emptyMark: {
      fontFamily: Fonts.sansMedium,
      fontSize: 13,
      color: colors.ink3,
    },
  });
