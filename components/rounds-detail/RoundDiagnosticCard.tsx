import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppBadge } from '../ui/AppBadge';
import { AppButton } from '../ui/AppButton';
import { AppCard } from '../ui/AppCard';
import { Icon } from '../ui/Icon';

type Props = {
  reanalyzing: boolean;
  showDebrief: boolean;
  debriefLocked: boolean;
  onOpenDiagnostic: () => void;
  onReanalyze: () => void;
  onOpenDebrief: () => void;
};

export function RoundDiagnosticCard({
  reanalyzing,
  showDebrief,
  debriefLocked,
  onOpenDiagnostic,
  onReanalyze,
  onOpenDebrief,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <AppCard>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">Diagnostic du round</Text>
        <AppBadge label="Gratuit" tone="neutral" />
      </View>
      <Text style={styles.body}>
        Points forts, axes d’amélioration et plan de la semaine, établis par le coach IA.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        onPress={onOpenDiagnostic}
        accessibilityRole="link"
        accessibilityLabel="Voir le diagnostic"
      >
        <Text style={styles.actionLabel}>Voir le diagnostic</Text>
        <Icon name="chevron-right" size={20} color={colors.ink} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        onPress={onReanalyze}
        disabled={reanalyzing}
        accessibilityRole="button"
        accessibilityLabel={reanalyzing ? 'Analyse en cours' : 'Relancer le diagnostic'}
        accessibilityState={{ disabled: reanalyzing, busy: reanalyzing }}
      >
        <Text style={[styles.actionLabel, styles.actionLabelQuiet]}>
          {reanalyzing ? 'Analyse...' : 'Relancer le diagnostic'}
        </Text>
        {reanalyzing ? (
          <ActivityIndicator size="small" color={colors.ink2} />
        ) : (
          <Icon name="refresh" size={18} color={colors.ink2} />
        )}
      </Pressable>

      {showDebrief ? (
        <AppButton
          label="Ouvrir le débrief"
          variant="secondary"
          icon={debriefLocked ? 'lock' : undefined}
          onPress={onOpenDebrief}
          accessibilityHint={debriefLocked ? 'Réservé aux abonnés Premium' : undefined}
          style={styles.debrief}
        />
      ) : null}
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
    },
    title: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
      flex: 1,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    actionLabel: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    actionLabelQuiet: {
      color: colors.ink2,
    },
    pressed: {
      opacity: 0.7,
    },
    debrief: {
      marginTop: Spacing.xs,
    },
  });
