import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals } from '../../constants';
import { useTheme } from '../../lib/theme';
import { SCORE_NOTATION_LABELS, getScoreNotation } from '../../lib/score-notation';

type Size = 'sm' | 'md' | 'xl';

type Props = {
  strokes: number;
  par: number;
  size?: Size;
  label?: string | number;
  accessibilityLabel?: string;
  decorative?: boolean;
};

const METRICS = {
  sm: { box: 19, border: 1.5, gap: 1.5, squareRadius: 3, fontSize: 13, fontFamily: Fonts.sansSemiBold, letterSpacing: 0 },
  md: { box: 28, border: 1.5, gap: 2, squareRadius: 5, fontSize: 19, fontFamily: Fonts.serif, letterSpacing: -0.4 },
  xl: { box: 100, border: 2, gap: 5, squareRadius: 10, fontSize: 68, fontFamily: Fonts.serif, letterSpacing: -2 },
} as const;

export function ScoreMark({ strokes, par, size = 'sm', label, accessibilityLabel, decorative = false }: Props) {
  const { colors } = useTheme();
  const notation = getScoreNotation(strokes, par);
  const metrics = METRICS[size];

  const circle = notation === 'birdie' || notation === 'eagle';
  const square = notation === 'bogey' || notation === 'double';
  const doubled = notation === 'eagle' || notation === 'double';

  const radius = circle ? metrics.box / 2 : metrics.squareRadius;
  const ringInset = metrics.gap + metrics.border;
  const ringRadius = circle ? metrics.box / 2 + ringInset : metrics.squareRadius + ringInset;

  const defaultLabel = `${strokes} coup${strokes > 1 ? 's' : ''}, ${SCORE_NOTATION_LABELS[notation]}`;

  return (
    <View
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : (accessibilityLabel ?? defaultLabel)}
      style={{ width: metrics.box, height: metrics.box }}
    >
      {doubled ? (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: -ringInset,
              left: -ringInset,
              right: -ringInset,
              bottom: -ringInset,
              borderWidth: metrics.border,
              borderColor: colors.ink,
              borderRadius: ringRadius,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.mark,
          (circle || square) && {
            borderWidth: metrics.border,
            borderColor: colors.ink,
            borderRadius: radius,
          },
        ]}
      >
        <Text
          style={[
            styles.value,
            {
              color: colors.ink,
              fontFamily: metrics.fontFamily,
              fontSize: metrics.fontSize,
              lineHeight: metrics.fontSize + 2,
              letterSpacing: metrics.letterSpacing,
            },
          ]}
          allowFontScaling={false}
        >
          {label ?? strokes}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
  mark: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: Numerals.fontVariant,
  },
});
