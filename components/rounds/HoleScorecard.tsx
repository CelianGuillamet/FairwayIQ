import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants';
import type { RoundDraftHole } from '../../types';
import { AppCard } from '../ui/AppCard';
import { AppBadge } from '../ui/AppBadge';

type Props = {
  title: string;
  holes: RoundDraftHole[];
  editable?: boolean;
  onChangeHole?: (holeNumber: number, patch: Partial<RoundDraftHole>) => void;
};

export function HoleScorecard({ title, holes, editable = true, onChangeHole }: Props) {
  return (
    <AppCard style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <AppBadge label={editable ? 'Édition' : 'Lecture'} tone={editable ? 'primary' : 'neutral'} />
      </View>

      {holes.map((hole) => (
        <View key={hole.hole_number} style={styles.holeCard}>
          <View style={styles.holeHeader}>
            <View>
              <Text style={styles.holeEyebrow}>Trou {hole.hole_number}</Text>
              <Text style={styles.holeMeta}>Par {hole.par}</Text>
            </View>
            <StepControl
              label="Score"
              value={hole.score}
              min={1}
              max={15}
              editable={editable}
              onChange={(value) => onChangeHole?.(hole.hole_number, { score: value })}
            />
          </View>

          <View style={styles.metricsRow}>
            <StepControl
              label="Par"
              value={hole.par}
              min={3}
              max={6}
              editable={editable}
              onChange={(value) => onChangeHole?.(hole.hole_number, { par: value })}
            />
            <StepControl
              label="Putts"
              value={hole.putts}
              min={0}
              max={6}
              editable={editable}
              onChange={(value) => onChangeHole?.(hole.hole_number, { putts: value })}
            />
            <StepControl
              label="Pen."
              value={hole.penalty}
              min={0}
              max={5}
              editable={editable}
              onChange={(value) => onChangeHole?.(hole.hole_number, { penalty: value })}
            />
          </View>

          <View style={styles.toggleRow}>
            <BooleanChip
              label="GIR"
              value={hole.gir}
              editable={editable}
              onPress={() => onChangeHole?.(hole.hole_number, { gir: !hole.gir })}
            />
            {hole.par > 3 ? (
              <BooleanChip
                label="Fairway"
                value={hole.fairway_hit === true}
                editable={editable}
                onPress={() => onChangeHole?.(hole.hole_number, { fairway_hit: hole.fairway_hit === true ? false : true })}
              />
            ) : (
              <View style={[styles.booleanChip, styles.booleanChipDisabled]}>
                <Text style={styles.booleanChipTextDisabled}>Fairway n/a</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </AppCard>
  );
}

function StepControl({
  label,
  value,
  min,
  max,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  editable: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.metricControl}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepButton, !editable && styles.stepButtonDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={!editable}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepButton, !editable && styles.stepButtonDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={!editable}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BooleanChip({
  label,
  value,
  editable,
  onPress,
}: {
  label: string;
  value: boolean;
  editable: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.booleanChip, value && styles.booleanChipActive, !editable && styles.booleanChipDisabled]}
      onPress={onPress}
      disabled={!editable}
    >
      <Text style={[styles.booleanChipText, value && styles.booleanChipTextActive]}>
        {label}: {value ? 'Oui' : 'Non'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.heading,
    color: Colors.text,
  },
  holeCard: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  holeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  holeEyebrow: {
    ...Typography.caption,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  holeMeta: {
    ...Typography.bodyStrong,
    color: Colors.text,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  metricControl: {
    flex: 1,
  },
  metricLabel: {
    ...Typography.caption,
    color: Colors.textDim,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepButtonText: {
    color: Colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  stepValue: {
    ...Typography.bodyStrong,
    color: Colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  booleanChip: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  booleanChipActive: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceAccent,
  },
  booleanChipDisabled: {
    opacity: 0.55,
  },
  booleanChipText: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  booleanChipTextActive: {
    color: Colors.text,
  },
  booleanChipTextDisabled: {
    ...Typography.label,
    color: Colors.textDim,
  },
});
