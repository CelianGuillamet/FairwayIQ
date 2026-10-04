import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Numerals, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';
import { parsePlanText } from './plan-text';

type Props = {
  text: string;
  size?: 'body' | 'lead';
};

export function PlanText({ text, size = 'body' }: Props) {
  const styles = useThemedStyles(createStyles);
  const blocks = parsePlanText(text);
  const textStyle = size === 'lead' ? styles.lead : styles.body;

  return (
    <View style={styles.stack}>
      {blocks.map((block, index) =>
        block.kind === 'item' ? (
          <View key={index} style={styles.item}>
            <Text style={[textStyle, styles.marker]}>{block.marker}</Text>
            <Text style={[textStyle, styles.itemText]}>{block.text}</Text>
          </View>
        ) : (
          <Text key={index} style={textStyle}>{block.text}</Text>
        )
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: Spacing.xs,
    },
    body: {
      ...Typography.body,
      lineHeight: 23,
      color: colors.ink,
    },
    lead: {
      ...Typography.body,
      fontSize: 16,
      lineHeight: 25,
      color: colors.ink,
    },
    item: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    marker: {
      width: 22,
      fontFamily: Fonts.sansSemiBold,
      color: colors.ink3,
      fontVariant: Numerals.fontVariant,
    },
    itemText: {
      flex: 1,
    },
  });
