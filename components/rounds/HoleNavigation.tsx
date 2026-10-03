import { memo, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { RoundDraftHole } from '../../types';
import { getScoreDescriptor } from '../../lib/hole-view';

type Props = {
  currentHole: number;
  scorecard: RoundDraftHole[];
  onSelectHole: (holeNumber: number) => void;
  onPreviousHole: () => void;
  onNextHole: () => void;
};

const CHIP_W  = 44;
const CHIP_G  = 5;
const CHIP_STEP = CHIP_W + CHIP_G;

function chipDotColor(hole: RoundDraftHole): string {
  if (!hole.completed) return Colors.border;
  const { tone } = getScoreDescriptor(hole.score, hole.par);
  switch (tone) {
    case 'elite':    return '#FFD055';
    case 'positive': return Colors.accentBlue;
    case 'warning':  return Colors.warning;
    case 'danger':   return Colors.error;
    default:         return Colors.textMuted;
  }
}

export const HoleNavigation = memo(function HoleNavigation({
  currentHole,
  scorecard,
  onSelectHole,
  onPreviousHole,
  onNextHole,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Keep the active chip roughly centered in the visible window (~4 chips wide)
    const x = Math.max(0, (currentHole - 1) * CHIP_STEP - CHIP_STEP * 3);
    scrollRef.current?.scrollTo({ x, animated: true });
  }, [currentHole]);

  const atStart = currentHole === 1;
  const atEnd   = currentHole === scorecard.length;

  return (
    <View style={styles.strip}>
      <TouchableOpacity
        style={[styles.arrow, atStart && styles.arrowOff]}
        onPress={onPreviousHole}
        disabled={atStart}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Trou précédent"
      >
        <Text style={[styles.arrowLabel, atStart && styles.arrowLabelOff]}>‹</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        bounces={false}
      >
        {scorecard.map((hole) => {
          const active   = hole.hole_number === currentHole;
          const dotColor = chipDotColor(hole);

          return (
            <TouchableOpacity
              key={hole.hole_number}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelectHole(hole.hole_number)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipNum, active && styles.chipNumActive]}>
                {hole.hole_number}
              </Text>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.arrow, atEnd && styles.arrowOff]}
        onPress={onNextHole}
        disabled={atEnd}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Trou suivant"
      >
        <Text style={[styles.arrowLabel, atEnd && styles.arrowLabelOff]}>›</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    height: 54,
    paddingHorizontal: Spacing.xs,
  },
  arrow: {
    width: 36,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOff: {
    opacity: 0.2,
  },
  arrowLabel: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '900' as const,
    color: Colors.text,
  },
  arrowLabelOff: {
    color: Colors.textDim,
  },
  chips: {
    paddingHorizontal: Spacing.xxs,
    gap: CHIP_G,
    alignItems: 'center',
  },
  chip: {
    width: CHIP_W,
    height: CHIP_W,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chipActive: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.text,
  },
  chipNum: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  chipNumActive: {
    color: Colors.text,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: Radius.full,
  },
});
