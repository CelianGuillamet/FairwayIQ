import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import {
  MAX_RESULT_ATTEMPTS,
  formatResult,
  getDefaultAttempts,
  isTargetReached,
  withAttempts,
  withMade,
  type DrillResult,
} from '../../lib/drill-results';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { Drill } from '../../types';
import { AppButton } from '../ui/AppButton';
import { Icon } from '../ui/Icon';
import { TextAction } from '../ui/TextAction';
import { ResultStepper } from './ResultStepper';

type Props = {
  drill: Drill | null;
  saving: boolean;
  error: string | null;
  onSave: (result: DrillResult) => void;
  onSkip: () => void;
  onClose: () => void;
};

type BodyProps = Omit<Props, 'drill' | 'onClose'> & {
  drill: Drill;
};

function SheetBody({ drill, saving, error, onSave, onSkip }: BodyProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<DrillResult>(() => ({
    made: 0,
    attempts: getDefaultAttempts(drill.attempts),
  }));
  const reached = isTargetReached(result, drill);

  return (
    <View
      style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.xs }]}
      accessibilityViewIsModal
    >
      <View style={styles.handle} />

      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Ton résultat
        </Text>
        <Text style={styles.drillTitle}>{drill.title}</Text>
        <Text style={styles.rule}>{drill.success_rule}</Text>
      </View>

      <View
        style={styles.score}
        accessible
        accessibilityLabel={`${result.made} réussis sur ${result.attempts}`}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.scoreValue, reached && styles.scoreReached]} numberOfLines={1} adjustsFontSizeToFit>
          {formatResult(result)}
        </Text>
        {reached ? (
          <View style={styles.status}>
            <Icon name="check" size={16} strokeWidth={2.5} color={colors.green} />
            <Text style={[styles.statusText, styles.statusReached]}>Objectif atteint</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>
            Objectif {drill.success_threshold} sur {drill.attempts}
          </Text>
        )}
      </View>

      <View style={styles.steppers}>
        <ResultStepper
          label="Essais"
          value={result.attempts}
          min={1}
          max={MAX_RESULT_ATTEMPTS}
          valueLabel={`${result.attempts} essais`}
          decrementLabel="Un essai de moins"
          incrementLabel="Un essai de plus"
          onStep={(delta) => setResult((current) => withAttempts(current, current.attempts + delta))}
        />
        <View style={styles.divider} />
        <ResultStepper
          label="Réussis"
          value={result.made}
          min={0}
          max={result.attempts}
          valueLabel={`${result.made} réussis`}
          decrementLabel="Une réussite de moins"
          incrementLabel="Une réussite de plus"
          onStep={(delta) => setResult((current) => withMade(current, current.made + delta))}
        />
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <AppButton label="Enregistrer" loading={saving} onPress={() => onSave(result)} />
        <TextAction
          label="Passer"
          tone="muted"
          disabled={saving}
          onPress={onSkip}
          accessibilityHint="Valide l’exercice sans enregistrer de résultat"
          style={styles.skip}
        />
      </View>
    </View>
  );
}

export function DrillResultSheet({ drill, saving, error, onSave, onSkip, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const [shown, setShown] = useState(drill);

  if (drill && drill !== shown) {
    setShown(drill);
  }

  const dismiss = () => {
    if (!saving) onClose();
  };

  return (
    <Modal visible={drill !== null} transparent animationType="slide" statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Fermer sans enregistrer"
        />
        {shown ? (
          <SheetBody key={shown.id} drill={shown} saving={saving} error={error} onSave={onSave} onSkip={onSkip} />
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      gap: Spacing.md,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.lineStrong,
    },
    header: {
      gap: 2,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    drillTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    rule: {
      ...Typography.body,
      color: colors.ink2,
    },
    score: {
      alignItems: 'center',
      gap: 2,
    },
    scoreValue: {
      ...Typography.numeralXL,
      color: colors.ink,
    },
    scoreReached: {
      color: colors.green,
    },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statusText: {
      ...Typography.label,
      color: colors.ink3,
    },
    statusReached: {
      color: colors.green,
    },
    steppers: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.line,
    },
    divider: {
      height: 1,
      backgroundColor: colors.line,
    },
    error: {
      ...Typography.bodyStrong,
      color: colors.error,
    },
    actions: {
      gap: Spacing.xxs,
    },
    skip: {
      alignSelf: 'center',
    },
  });
