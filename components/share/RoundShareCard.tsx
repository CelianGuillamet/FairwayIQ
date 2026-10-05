import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { Fonts, Numerals } from '../../constants';
import type { ShareCardModel, ShareHoleRow, ShareStat } from '../../lib/share-card';
import { ScoreMark } from '../ui/ScoreMark';

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;
export const SHARE_CARD_PIXEL_RATIO = 3;

// Brand artwork: fixed values on purpose, never theme tokens, so the image looks the same in light and dark mode.
const CARD = {
  background: '#101A14',
  ink: '#F5F6F1',
  muted: 'rgba(245, 246, 241, 0.68)',
  faint: 'rgba(245, 246, 241, 0.56)',
  line: 'rgba(245, 246, 241, 0.16)',
  red: '#D8392B',
} as const;

const FLAG_SIZE = { width: 11, height: 21 } as const;
// Same geometry as assets/icon.png (1024 px canvas), cropped to the flag, pole and base.
const FLAG_VIEWBOX = { x: 363, y: 217, width: 322, height: 615 } as const;

type Props = {
  model: ShareCardModel;
};

export function RoundShareCard({ model }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow} allowFontScaling={false} numberOfLines={1}>
          {model.eyebrow}
        </Text>
        <Text style={styles.course} allowFontScaling={false} numberOfLines={2}>
          {model.courseName}
        </Text>
      </View>

      <View>
        <Text style={styles.score} allowFontScaling={false}>
          {model.totalScore}
        </Text>
        <View style={styles.scoreCaption}>
          <Text style={styles.toPar} allowFontScaling={false} numberOfLines={1}>
            {model.toParLabel}
          </Text>
          <Text style={styles.par} allowFontScaling={false}>
            {model.parLabel}
          </Text>
        </View>
      </View>

      {model.rows.length > 0 ? (
        <View style={styles.strip}>
          {model.rows.map((row) => (
            <HoleRow key={row.key} row={row} />
          ))}
        </View>
      ) : null}

      {model.stats.length > 0 ? (
        <View style={styles.stats}>
          {model.stats.map((stat, index) => (
            <StatCell key={stat.key} stat={stat} divided={index > 0} />
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <FlagMark />
        <Text style={styles.brand} allowFontScaling={false}>
          FairwayIQ
        </Text>
      </View>
    </View>
  );
}

function HoleRow({ row }: { row: ShareHoleRow }) {
  return (
    <View style={styles.holeRow}>
      {row.cells.map((cell) => (
        <View key={cell.number} style={styles.holeCell}>
          <Text style={styles.holeNumber} allowFontScaling={false}>
            {cell.number}
          </Text>
          <View style={styles.markSlot}>
            {cell.strokes != null && cell.par != null ? (
              <ScoreMark strokes={cell.strokes} par={cell.par} color={CARD.ink} decorative />
            ) : (
              <Text style={styles.holeEmpty} allowFontScaling={false}>
                –
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function StatCell({ stat, divided }: { stat: ShareStat; divided: boolean }) {
  return (
    <View style={[styles.statCell, divided && styles.statDivided]}>
      <Text style={styles.statValue} allowFontScaling={false}>
        {stat.value}
        {stat.suffix ? <Text style={styles.statSuffix} allowFontScaling={false}>{stat.suffix}</Text> : null}
      </Text>
      <Text
        style={styles.statLabel}
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {stat.label}
      </Text>
    </View>
  );
}

function FlagMark() {
  const { x, y, width, height } = FLAG_VIEWBOX;

  return (
    <Svg width={FLAG_SIZE.width} height={FLAG_SIZE.height} viewBox={`${x} ${y} ${width} ${height}`}>
      <Rect x={487} y={217} width={50} height={563} rx={25} fill={CARD.ink} />
      <Path d="M487 241 L685 328 L487 427 Z" fill={CARD.red} />
      <Ellipse cx={512} cy={805} rx={149} ry={27} fill={CARD.ink} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: CARD.background,
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: CARD.muted,
  },
  course: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.24,
    color: CARD.ink,
  },
  score: {
    fontFamily: Fonts.serif,
    fontSize: 104,
    lineHeight: 110,
    letterSpacing: -2.4,
    color: CARD.ink,
    fontVariant: Numerals.fontVariant,
  },
  scoreCaption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  toPar: {
    flexShrink: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: CARD.ink,
  },
  par: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: CARD.muted,
  },
  strip: {
    gap: 8,
  },
  holeRow: {
    flexDirection: 'row',
  },
  holeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  holeNumber: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    lineHeight: 12,
    color: CARD.faint,
    fontVariant: Numerals.fontVariant,
  },
  markSlot: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeEmpty: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: CARD.faint,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: CARD.line,
  },
  statCell: {
    flex: 1,
    gap: 2,
    paddingVertical: 10,
    paddingLeft: 10,
  },
  statDivided: {
    borderLeftWidth: 1,
    borderLeftColor: CARD.line,
  },
  statValue: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    color: CARD.ink,
    fontVariant: Numerals.fontVariant,
  },
  statSuffix: {
    fontSize: 13,
    color: CARD.faint,
  },
  statLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    color: CARD.muted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: CARD.muted,
  },
});
