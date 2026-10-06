import { useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { describeQueuedRound, getPendingRoundsView } from '../../lib/pending-rounds';
import type { QueuedRound } from '../../lib/round-save-queue';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useRoundQueueStore } from '../../stores/round-queue';
import { Icon } from '../ui/Icon';
import { TextAction } from '../ui/TextAction';

function confirmDiscard(entry: QueuedRound) {
  Alert.alert(
    'Supprimer ce round ?',
    `${describeQueuedRound(entry)}\n\nIl ne sera pas envoyé et ne pourra pas être récupéré.`,
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => void useRoundQueueStore.getState().discard(entry.clientRequestId),
      },
    ],
  );
}

export function PendingRoundsBanner() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const entries = useRoundQueueStore((state) => state.entries);
  const flushing = useRoundQueueStore((state) => state.flushing);
  const view = useMemo(() => getPendingRoundsView(entries, flushing), [entries, flushing]);

  if (view.kind === 'hidden') {
    return null;
  }

  const retry = () => void useRoundQueueStore.getState().retry();

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Icon name={view.kind === 'attention' ? 'alert' : 'clock'} size={18} color={view.kind === 'attention' ? colors.warning : colors.ink2} />
        <View style={styles.copy}>
          <Text style={styles.title}>{view.title}</Text>
          {view.kind === 'attention' ? <Text style={styles.caption}>{view.caption}</Text> : null}
        </View>
        {view.kind === 'sending' ? (
          <ActivityIndicator size="small" color={colors.ink2} accessibilityLabel="Envoi en cours" style={styles.spinner} />
        ) : null}
        {view.kind === 'pending' ? (
          <TextAction
            label="Réessayer"
            tone="muted"
            onPress={retry}
            accessibilityLabel="Réessayer d’envoyer les rounds en attente"
            style={styles.action}
          />
        ) : null}
      </View>
      {view.kind === 'attention' ? (
        <View style={styles.actions}>
          <TextAction label="Réessayer" tone="muted" onPress={retry} accessibilityLabel="Réessayer d’envoyer le round" />
          <TextAction
            label="Supprimer"
            tone="muted"
            onPress={() => confirmDiscard(view.entry)}
            accessibilityLabel="Supprimer le round qui n’a pas pu être envoyé"
            accessibilityHint="Demande une confirmation"
          />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    banner: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    copy: {
      flex: 1,
      paddingVertical: Spacing.xs,
    },
    title: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    caption: {
      ...Typography.body,
      color: colors.ink2,
    },
    spinner: {
      marginRight: Spacing.sm,
    },
    action: {
      paddingHorizontal: Spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginLeft: Spacing.xl,
      marginTop: -Spacing.xxs,
    },
  });
