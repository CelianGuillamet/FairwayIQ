import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';

type Props = {
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceTile({ label, description, selected = false, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.tile, selected && styles.tileSelected]}
      onPress={onPress}
    >
      <View style={styles.dotWrap}>
        <View style={[styles.dot, selected && styles.dotActive]} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 14,
  },
  tileSelected: {
    backgroundColor: Colors.surfaceAccent,
    borderColor: Colors.text,
  },
  dotWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: Colors.text,
  },
  content: {
    flex: 1,
  },
  label: {
    color: Colors.text,
    ...Typography.bodyStrong,
  },
  labelSelected: {
    color: Colors.text,
  },
  description: {
    color: Colors.textDim,
    ...Typography.caption,
    marginTop: 4,
  },
});
