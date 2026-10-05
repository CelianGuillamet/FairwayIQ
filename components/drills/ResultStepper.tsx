import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';

const HOLD_DELAY_MS = 350;
const REPEAT_INTERVAL_MS = 90;

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  valueLabel: string;
  decrementLabel: string;
  incrementLabel: string;
  onStep: (delta: 1 | -1) => void;
};

type StepButtonProps = {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onStep: () => void;
};

function StepButton({ icon, label, disabled, onStep }: StepButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (repeat.current) {
      clearInterval(repeat.current);
      repeat.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, disabled && styles.buttonOff, pressed && styles.pressed]}
      onPress={onStep}
      onLongPress={() => {
        stop();
        repeat.current = setInterval(onStep, REPEAT_INTERVAL_MS);
      }}
      onPressOut={stop}
      delayLongPress={HOLD_DELAY_MS}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon name={icon} size={24} color={colors.ink} />
    </Pressable>
  );
}

export function ResultStepper({ label, value, min, max, valueLabel, decrementLabel, incrementLabel, onStep }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <StepButton icon="minus" label={decrementLabel} disabled={value <= min} onStep={() => onStep(-1)} />
        <View style={styles.value} accessible accessibilityLabel={valueLabel}>
          <Text style={styles.valueText} maxFontSizeMultiplier={1.3}>{value}</Text>
        </View>
        <StepButton icon="plus" label={incrementLabel} disabled={value >= max} onStep={() => onStep(1)} />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    label: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
    },
    button: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.ink,
      borderRadius: Radius.md,
    },
    buttonOff: {
      borderColor: colors.line,
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.7,
    },
    value: {
      minWidth: 64,
      alignItems: 'center',
    },
    valueText: {
      ...Typography.titleMd,
      ...Numerals,
      color: colors.ink,
    },
  });
