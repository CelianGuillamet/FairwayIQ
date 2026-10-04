import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: 'default' | 'highlight' | 'soft';
};

export function AppCard({ children, style, accent = 'default' }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[
        styles.card,
        accent === 'highlight' && styles.cardHighlight,
        accent === 'soft' && styles.cardSoft,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 18,
    },
    cardHighlight: {
      borderColor: colors.ink,
      borderWidth: 1.5,
    },
    cardSoft: {
      backgroundColor: colors.sunk,
      borderColor: colors.sunk,
    },
  });
