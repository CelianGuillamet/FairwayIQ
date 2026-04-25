import { StyleSheet, View } from 'react-native';
import { Colors } from '../../constants';

export function DecorativeBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      <View style={[styles.beam, styles.beamPrimary]} />
      <View style={[styles.beam, styles.beamBlue]} />
      <View style={[styles.glow, styles.glowPrimary]} />
      <View style={[styles.glow, styles.glowBlue]} />
      <View style={[styles.glow, styles.glowBottom]} />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  beam: {
    position: 'absolute',
    height: 220,
    borderRadius: 999,
    opacity: 0.9,
  },
  beamPrimary: {
    width: 380,
    top: -110,
    right: -80,
    backgroundColor: Colors.primaryMuted,
    transform: [{ rotate: '-22deg' }],
  },
  beamBlue: {
    width: 300,
    bottom: 120,
    left: -120,
    backgroundColor: Colors.accentBlueMuted,
    transform: [{ rotate: '18deg' }],
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.95,
  },
  glowPrimary: {
    width: 260,
    height: 260,
    backgroundColor: Colors.primaryMuted,
    top: -40,
    right: -30,
  },
  glowBlue: {
    width: 240,
    height: 240,
    backgroundColor: Colors.accentBlueMuted,
    top: 220,
    left: -100,
  },
  glowBottom: {
    width: 320,
    height: 320,
    backgroundColor: 'rgba(255, 191, 77, 0.08)',
    bottom: -150,
    right: -80,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    opacity: 0.14,
  },
});
