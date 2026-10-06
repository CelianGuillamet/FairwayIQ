import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import {
  loadRemindersHintDismissed,
  saveRemindersHintDismissed,
  shouldShowRemindersHint,
} from '../../lib/reminders-hint';
import { useThemedStyles } from '../../lib/theme';
import { useAuthStore } from '../../stores/auth';
import { useNotificationSettingsStore } from '../../stores/notification-settings';
import { useRoundsStore } from '../../stores/rounds';
import { AppCard } from '../ui/AppCard';
import { TextAction } from '../ui/TextAction';

export function RemindersHint() {
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const roundCount = useRoundsStore((state) => state.rounds.length);
  const remindersReady = useNotificationSettingsStore((state) => state.hydrated);
  const remindersOn = useNotificationSettingsStore((state) => state.settings.enabled);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(null);
    if (!userId) return;

    let active = true;

    void loadRemindersHintDismissed(userId).then((value) => {
      if (active) setDismissed(value);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId || !shouldShowRemindersHint({ roundCount, dismissed, remindersReady, remindersOn })) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    void saveRemindersHintDismissed(userId);
  };

  const openSettings = () => {
    dismiss();
    router.push('/notifications' as any);
  };

  return (
    <AppCard>
      <Text style={styles.title} accessibilityRole="header">
        Veux-tu des rappels ?
      </Text>
      <Text style={styles.body}>
        Un petit rappel pour noter tes rounds et garder ta série d’exercices. Tu choisis les jours et tu peux les couper
        quand tu veux.
      </Text>
      <View style={styles.actions}>
        <TextAction label="Régler les rappels" onPress={openSettings} />
        <TextAction label="Plus tard" tone="muted" onPress={dismiss} />
      </View>
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    body: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xxs,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: Spacing.md,
      marginTop: Spacing.xs,
    },
  });
