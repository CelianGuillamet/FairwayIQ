import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { AI_CONTENT_NOTICE, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

type Props = {
  style?: StyleProp<TextStyle>;
};

export function AiNotice({ style }: Props) {
  const styles = useThemedStyles(createStyles);

  return <Text style={[styles.text, style]}>{AI_CONTENT_NOTICE}</Text>;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    text: {
      ...Typography.caption,
      color: colors.ink3,
    },
  });
