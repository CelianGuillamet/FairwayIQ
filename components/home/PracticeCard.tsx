import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { DRILL_CATEGORY_LABELS, DRILL_DIFFICULTY_LABELS } from '../../lib/drill-library';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { Diagnostic, Drill } from '../../types';
import { AppBadge } from '../ui/AppBadge';
import { AppButton } from '../ui/AppButton';
import { AppCard } from '../ui/AppCard';
import { Icon } from '../ui/Icon';
import { TextAction } from '../ui/TextAction';

type Props = {
  loading: boolean;
  error: string | null;
  diagnostic: Diagnostic | null;
  drill: Drill | null;
  doneToday: boolean;
  markingDone: boolean;
  completionError: string | null;
  onRetry: () => void;
  onMarkDone: () => void;
  onOpenDrills: () => void;
  onOpenDiagnostic: () => void;
};

export function PracticeCard({
  loading,
  error,
  diagnostic,
  drill,
  doneToday,
  markingDone,
  completionError,
  onRetry,
  onMarkDone,
  onOpenDrills,
  onOpenDiagnostic,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (loading) {
    return (
      <AppCard>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.loadingText}>Préparation de ton exercice du jour…</Text>
        </View>
      </AppCard>
    );
  }

  if (error) {
    return (
      <AppCard>
        <Text style={styles.label}>Exercice du jour</Text>
        <Text style={styles.title}>Impossible de charger le plan</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TextAction label="Réessayer" icon="refresh" onPress={onRetry} />
      </AppCard>
    );
  }

  if (!diagnostic) {
    return (
      <AppCard>
        <Text style={styles.label}>Exercice du jour</Text>
        <Text style={styles.title}>Aucun diagnostic exploitable</Text>
        <Text style={styles.body}>
          Enregistre ou relance un diagnostic pour transformer ton prochain round en plan d’entraînement concret.
        </Text>
        <TextAction label="Analyser un round" icon="chevron-right" onPress={onOpenDiagnostic} />
      </AppCard>
    );
  }

  if (!drill) {
    return (
      <AppCard>
        <Text style={styles.label}>Exercice du jour</Text>
        <Text style={styles.title}>Plan à clarifier</Text>
        <Text style={styles.body}>{diagnostic.weekly_plan}</Text>
        <TextAction label="Voir le diagnostic" icon="chevron-right" onPress={onOpenDiagnostic} />
      </AppCard>
    );
  }

  return (
    <AppCard accent={doneToday ? 'highlight' : 'default'}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.label}>Exercice du jour</Text>
          <Text style={styles.title}>{doneToday ? 'Routine validée' : drill.title}</Text>
        </View>
        {doneToday ? <AppBadge label="Fait" tone="good" icon="check" /> : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{DRILL_CATEGORY_LABELS[drill.category]}</Text>
        <View style={styles.metaItem}>
          <Icon name="clock" size={16} color={colors.ink3} />
          <Text style={styles.metaText}>{drill.duration_minutes} min</Text>
        </View>
        <Text style={styles.metaText}>{DRILL_DIFFICULTY_LABELS[drill.difficulty]}</Text>
      </View>

      <Text style={styles.body}>
        {doneToday
          ? 'Objectif du jour enregistré. Tu gardes la dynamique sans ajouter de complexité.'
          : drill.description}
      </Text>

      {completionError ? <Text style={styles.errorText}>{completionError}</Text> : null}

      <View style={styles.actions}>
        {doneToday ? (
          <TextAction label="Voir les exercices" icon="chevron-right" onPress={onOpenDrills} />
        ) : (
          <AppButton
            label={markingDone ? 'Validation…' : 'Marquer fait'}
            variant="secondary"
            loading={markingDone}
            onPress={onMarkDone}
            style={styles.markDone}
          />
        )}
        <TextAction label="Diagnostic" onPress={onOpenDiagnostic} tone="muted" />
      </View>
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    loadingText: {
      ...Typography.body,
      color: colors.ink2,
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    headerCopy: {
      flex: 1,
    },
    label: {
      ...Typography.label,
      color: colors.ink2,
    },
    title: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 14,
      rowGap: 2,
      marginTop: Spacing.xs,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...Typography.label,
      fontFamily: Typography.body.fontFamily,
      color: colors.ink3,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    errorText: {
      ...Typography.label,
      color: colors.error,
      marginTop: Spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: Spacing.md,
      marginTop: Spacing.sm,
    },
    markDone: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 140,
    },
  });
