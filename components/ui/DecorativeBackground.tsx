import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../constants';

export function DecorativeBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      <Svg width={width} height={height * 0.5} style={styles.contours}>
        <Path
          d={`M ${width * 0.72} -20
              C ${width * 0.98} ${height * 0.06}, ${width * 1.05} ${height * 0.18}, ${width * 0.86} ${height * 0.24}
              C ${width * 0.68} ${height * 0.3}, ${width * 0.7} ${height * 0.1}, ${width * 0.72} -20 Z`}
          stroke={Colors.borderStrong}
          strokeWidth={1}
          fill="none"
          opacity={0.55}
        />
        <Path
          d={`M ${width * 0.6} -30
              C ${width * 1.05} ${height * -0.02}, ${width * 1.18} ${height * 0.2}, ${width * 0.9} ${height * 0.32}
              C ${width * 0.6} ${height * 0.42}, ${width * 0.58} ${height * 0.12}, ${width * 0.6} -30 Z`}
          stroke={Colors.borderStrong}
          strokeWidth={1}
          fill="none"
          opacity={0.35}
        />
        <Path
          d={`M ${width * 0.48} -40
              C ${width * 1.1} ${height * -0.08}, ${width * 1.3} ${height * 0.24}, ${width * 0.95} ${height * 0.4}
              C ${width * 0.5} ${height * 0.55}, ${width * 0.46} ${height * 0.14}, ${width * 0.48} -40 Z`}
          stroke={Colors.border}
          strokeWidth={1}
          fill="none"
          opacity={0.4}
        />
      </Svg>
      <View style={styles.pinDot} />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  contours: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  pinDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentBlue,
    top: 54,
    right: '18%',
    opacity: 0.9,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    opacity: 0.1,
  },
});
