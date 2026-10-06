import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../lib/theme';

export function DecorativeBackground() {
  const { colors } = useTheme();

  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />;
}
