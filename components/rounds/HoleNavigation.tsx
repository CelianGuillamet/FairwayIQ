import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Fonts, Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';
import { describeStrokes } from '../../lib/score-labels';
import type { RoundDraftHole } from '../../types';
import { ScoreMark } from '../ui/ScoreMark';

type Props = {
  currentHole: number;
  scorecard: RoundDraftHole[];
  onSelectHole: (holeNumber: number) => void;
};

const TILE_WIDTH = 44;
const TILE_HEIGHT = 48;
const TILE_GAP = 4;
const TILE_STEP = TILE_WIDTH + TILE_GAP;
const SIDE_PADDING = Spacing.md;

export const HoleNavigation = memo(function HoleNavigation({ currentHole, scorecard, onSelectHole }: Props) {
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (width === 0) return;
    const tileCenter = SIDE_PADDING + (currentHole - 1) * TILE_STEP + TILE_WIDTH / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, tileCenter - width / 2), animated: true });
  }, [currentHole, width]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      bounces={false}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.strip}
      contentContainerStyle={styles.tiles}
      accessibilityLabel="Choisir un trou"
    >
      {scorecard.map((hole) => {
        const active = hole.hole_number === currentHole;
        const played = hole.completed && !active;
        const label = active
          ? `Trou ${hole.hole_number}, en cours`
          : hole.completed
            ? `Trou ${hole.hole_number}, ${describeStrokes(hole.score, hole.par)}`
            : `Trou ${hole.hole_number}, à jouer`;

        return (
          <Pressable
            key={hole.hole_number}
            style={({ pressed }) => [styles.tile, active && styles.tileActive, pressed && styles.pressed]}
            onPress={() => onSelectHole(hole.hole_number)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
          >
            {played ? (
              <ScoreMark strokes={hole.score} par={hole.par} size="sm" label={hole.hole_number} decorative />
            ) : (
              <Text style={[styles.number, active ? styles.numberActive : styles.numberFuture]}>
                {hole.hole_number}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strip: {
      flexGrow: 0,
    },
    tiles: {
      gap: TILE_GAP,
      paddingHorizontal: SIDE_PADDING,
      paddingVertical: Spacing.xxs,
    },
    tile: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileActive: {
      backgroundColor: colors.ink,
    },
    pressed: {
      opacity: 0.7,
    },
    number: {
      ...Typography.bodyStrong,
      ...Numerals,
    },
    numberActive: {
      color: colors.onInk,
    },
    numberFuture: {
      color: colors.ink3,
      fontFamily: Fonts.sansMedium,
    },
  });
