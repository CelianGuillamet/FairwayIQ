import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Numerals, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from '../../lib/weekly-goal';
import { useThemedStyles } from '../../lib/theme';
import { TextAction } from '../ui/TextAction';

const CHOICES = Array.from({ length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 }, (_, index) => WEEKLY_GOAL_MIN + index);

type Props = {
  visible: boolean;
  goal: number;
  recommended: number;
  isCustom: boolean;
  onSelect: (goal: number) => void;
  onReset: () => void;
  onClose: () => void;
};

export function WeeklyGoalSheet({ visible, goal, recommended, isCustom, onSelect, onReset, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Objectif de la semaine
          </Text>
          <Text style={styles.body}>Combien de séances veux-tu faire chaque semaine ? Un round ou un exercice compte pour une séance.</Text>

          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Séances par semaine">
            {CHOICES.map((choice) => {
              const selected = choice === goal;

              return (
                <Pressable
                  key={choice}
                  style={[styles.choice, selected && styles.choiceSelected]}
                  onPress={() => onSelect(choice)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${choice} ${choice > 1 ? 'séances' : 'séance'} par semaine`}
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]} allowFontScaling={false}>
                    {choice}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>Conseillé d’après ta fréquence de jeu : {recommended}</Text>

          <View style={styles.actions}>
            {isCustom ? <TextAction label="Revenir à l’objectif conseillé" onPress={onReset} /> : <View />}
            <TextAction label="Fermer" tone="muted" onPress={onClose} />
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
    title: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    choices: {
      flexDirection: 'row',
      gap: 6,
      marginTop: Spacing.md,
    },
    choice: {
      flex: 1,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    choiceSelected: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    choiceLabel: {
      ...Typography.titleMd,
      ...Numerals,
      fontSize: 22,
      lineHeight: 26,
      color: colors.ink,
      includeFontPadding: false,
    },
    choiceLabelSelected: {
      color: colors.onInk,
    },
    hint: {
      ...Typography.caption,
      color: colors.ink3,
      marginTop: Spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      marginTop: Spacing.xs,
    },
  });
