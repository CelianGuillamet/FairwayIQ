import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '../../constants';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: 'default' | 'highlight' | 'soft';
};

export function AppCard({ children, style, accent = 'default' }: Props) {
  return (
    <View
      style={[
        styles.card,
        accent === 'highlight' && styles.cardHighlight,
        accent === 'soft' && styles.cardSoft,
        style,
      ]}
    >
      {accent !== 'default' ? (
        <View
          pointerEvents="none"
          style={[
            styles.accentLine,
            accent === 'highlight' ? styles.accentLineHighlight : styles.accentLineSoft,
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    shadowColor: Colors.black,
    ...Shadows.card,
  },
  cardHighlight: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.borderStrong,
  },
  cardSoft: {
    backgroundColor: Colors.backgroundSoft,
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  accentLineHighlight: {
    backgroundColor: Colors.primary,
  },
  accentLineSoft: {
    backgroundColor: Colors.accentBlue,
  },
});
