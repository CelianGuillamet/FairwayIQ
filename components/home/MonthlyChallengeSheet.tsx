import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import {
  CHALLENGE_DONE_LABEL,
  describeChallengeProgress,
  describeDaysLeft,
  type Challenge,
  type ChallengeProgress,
} from '../../lib/monthly-challenge';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import { TextAction } from '../ui/TextAction';

type Props = {
  visible: boolean;
  challenge: Challenge;
  progress: ChallengeProgress;
  canChange: boolean;
  changeUsed: boolean;
  onChange: () => void;
  onClose: () => void;
};

export function MonthlyChallengeSheet({ visible, challenge, progress, canChange, changeUsed, onChange, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [confirming, setConfirming] = useState(false);
  const count = describeChallengeProgress(progress);

  useEffect(() => {
    if (!visible) setConfirming(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.label}>Défi du mois</Text>
          <Text style={styles.title} accessibilityRole="header">
            {challenge.title}
          </Text>
          <Text style={styles.body}>{challenge.description}</Text>

          <View style={styles.progress}>
            <ProgressBar value={progress.current} max={progress.target} label={count} />
            {progress.done ? (
              <View style={styles.doneRow}>
                <Icon name="check" size={18} strokeWidth={2.25} color={colors.green} />
                <Text style={styles.done}>{CHALLENGE_DONE_LABEL}</Text>
              </View>
            ) : (
              <View style={styles.progressFoot}>
                <Text style={styles.count}>
                  {progress.current}
                  <Text style={styles.countTotal}> sur {progress.target}</Text>
                </Text>
                <Text style={styles.days}>{describeDaysLeft(progress.daysLeft)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.heading} accessibilityRole="header">
            Comment c’est compté
          </Text>
          <Text style={styles.body}>{challenge.rule}</Text>
          <Text style={styles.caption}>Le décompte porte sur le mois en cours et repart de zéro le mois suivant.</Text>

          {confirming ? (
            <Text style={styles.caption}>Tu ne peux changer qu’une fois par mois : le nouveau défi remplace celui-ci.</Text>
          ) : null}
          {!canChange && changeUsed ? <Text style={styles.caption}>Tu as déjà changé de défi ce mois-ci.</Text> : null}

          <View style={styles.actions}>
            {confirming ? (
              <>
                <TextAction label="Confirmer le changement" onPress={onChange} />
                <TextAction label="Annuler" tone="muted" onPress={() => setConfirming(false)} />
              </>
            ) : (
              <>
                {canChange ? (
                  <TextAction
                    label="Changer de défi"
                    tone="muted"
                    onPress={() => setConfirming(true)}
                    accessibilityHint="Choisit un autre défi, une seule fois par mois"
                  />
                ) : (
                  <View />
                )}
                <TextAction label="Fermer" tone="muted" onPress={onClose} />
              </>
            )}
          </View>
        </View>
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
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.lineStrong,
      marginBottom: Spacing.md,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
      marginTop: 2,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    progress: {
      marginTop: Spacing.md,
    },
    progressFoot: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    count: {
      ...Typography.titleMd,
      ...Numerals,
      fontSize: 22,
      lineHeight: 26,
      color: colors.ink,
    },
    countTotal: {
      ...Typography.body,
      color: colors.ink2,
    },
    days: {
      ...Typography.caption,
      color: colors.ink3,
    },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xxs,
      marginTop: Spacing.xs,
    },
    done: {
      ...Typography.bodyStrong,
      color: colors.green,
    },
    heading: {
      ...Typography.heading,
      color: colors.ink,
      marginTop: Spacing.lg,
    },
    caption: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: Spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      marginTop: Spacing.xs,
    },
  });
