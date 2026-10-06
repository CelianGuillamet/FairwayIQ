import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import {
  PLAY_HOUR_OPTIONS,
  PRACTICE_HOUR_OPTIONS,
  WEEKDAYS,
  formatReminderTime,
  getWeekdayLong,
  type ReminderKey,
  type Weekday,
} from '../lib/notification-settings';
import { STREAK_MIN_DAYS, STREAK_REMINDER_TIME, WEEKLY_PLAN_SLOT } from '../lib/notification-plan';
import {
  getNotificationPermission,
  requestNotificationPermissions,
  scheduleTestNotification,
  type NotificationPermission,
} from '../lib/notifications';
import { useNotificationSettingsStore } from '../stores/notification-settings';
import { AppCard } from '../components/ui/AppCard';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';
import { ChipGroup, type ChipOption } from '../components/notifications/ChipGroup';

type TestState = 'idle' | 'sending' | 'sent' | 'blocked' | 'error';

const TEST_MESSAGES: Record<Exclude<TestState, 'idle' | 'sending'>, string> = {
  sent: 'Notification envoyée, elle arrive dans quelques secondes.',
  blocked: 'Autorise d’abord les notifications pour envoyer un test.',
  error: 'Impossible d’envoyer la notification de test.',
};

const WEEKDAY_OPTIONS: readonly ChipOption<Weekday>[] = WEEKDAYS.map((day) => ({
  value: day.value,
  label: day.short,
  accessibilityLabel: day.long,
}));

const hourOptions = (hours: readonly number[]): readonly ChipOption<number>[] =>
  hours.map((hour) => ({ value: hour, label: formatReminderTime(hour) }));

const PLAY_HOURS = hourOptions(PLAY_HOUR_OPTIONS);
const PRACTICE_HOURS = hourOptions(PRACTICE_HOUR_OPTIONS);

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const settings = useNotificationSettingsStore((state) => state.settings);
  const hydrated = useNotificationSettingsStore((state) => state.hydrated);
  const setEnabled = useNotificationSettingsStore((state) => state.setEnabled);
  const setReminder = useNotificationSettingsStore((state) => state.setReminder);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [awaitingSystemSetting, setAwaitingSystemSetting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');

  const refreshPermission = useCallback(async () => {
    try {
      setPermission(await getNotificationPermission());
    } catch {
      setPermission(null);
    }
  }, []);

  useEffect(() => {
    void refreshPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  useEffect(() => {
    if (awaitingSystemSetting && permission?.granted) {
      setAwaitingSystemSetting(false);
      setEnabled(true);
    }
  }, [awaitingSystemSetting, permission, setEnabled]);

  const permissionBlocked = permission !== null && !permission.granted && !permission.canAskAgain;
  const masterOn = settings.enabled && permission?.granted === true;
  const showBlockedNotice = permissionBlocked && (settings.enabled || awaitingSystemSetting);

  const handleMasterChange = async (next: boolean) => {
    if (!next) {
      setAwaitingSystemSetting(false);
      setEnabled(false);
      return;
    }

    setSwitching(true);
    try {
      const granted = await requestNotificationPermissions();
      await refreshPermission();
      if (granted) {
        setEnabled(true);
      } else {
        setAwaitingSystemSetting(true);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de vérifier les autorisations pour le moment.');
    } finally {
      setSwitching(false);
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Erreur', 'Ouvre les Réglages de ton iPhone pour autoriser les notifications.');
    });
  };

  const handleTest = async () => {
    setTestState('sending');
    try {
      const current = await getNotificationPermission();
      if (!current.granted) {
        setTestState('blocked');
        return;
      }
      await scheduleTestNotification();
      setTestState('sent');
    } catch {
      setTestState('error');
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const toggle = (key: ReminderKey) => (enabled: boolean) => setReminder(key, { enabled });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <PageHeader
          title="Notifications"
          subtitle="Choisis les rappels que tu veux recevoir."
          onBack={goBack}
        />

        {!hydrated ? (
          <ActivityIndicator color={colors.ink} accessibilityLabel="Chargement" />
        ) : (
          <>
            <AppCard>
              <SwitchRow
                first
                title="Activer les rappels"
                description="Les rappels sont programmés sur ton téléphone."
                value={masterOn}
                onValueChange={(next) => void handleMasterChange(next)}
                disabled={switching}
              />
              {showBlockedNotice ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    Les notifications sont désactivées pour FairwayIQ. Dans Réglages, touche Notifications puis active
                    Autoriser les notifications.
                  </Text>
                  <TextAction
                    label="Ouvrir les réglages"
                    onPress={handleOpenSettings}
                    accessibilityHint="Ouvre les réglages de FairwayIQ sur ton iPhone"
                  />
                </View>
              ) : null}
            </AppCard>

            <Text style={styles.sectionTitle} accessibilityRole="header">
              Rappels
            </Text>
            <AppCard style={styles.listCard}>
              <SwitchRow
                first
                title="Plan de la semaine"
                description={`Chaque ${getWeekdayLong(WEEKLY_PLAN_SLOT.weekday)} à ${formatReminderTime(WEEKLY_PLAN_SLOT.hour)}.`}
                value={settings.weeklyPlan.enabled}
                onValueChange={toggle('weeklyPlan')}
                disabled={!masterOn}
              />
              <SwitchRow
                title="Round à enregistrer"
                description={`Chaque ${getWeekdayLong(settings.playReminder.weekday)} à ${formatReminderTime(settings.playReminder.hour)}, pour penser à noter ton score trou par trou.`}
                value={settings.playReminder.enabled}
                onValueChange={toggle('playReminder')}
                disabled={!masterOn}
              >
                {masterOn && settings.playReminder.enabled ? (
                  <View style={styles.chips}>
                    <ChipGroup
                      options={WEEKDAY_OPTIONS}
                      value={settings.playReminder.weekday}
                      onChange={(weekday) => setReminder('playReminder', { weekday })}
                      accessibilityLabel="Jour du rappel de round"
                    />
                    <ChipGroup
                      options={PLAY_HOURS}
                      value={settings.playReminder.hour}
                      onChange={(hour) => setReminder('playReminder', { hour })}
                      accessibilityLabel="Heure du rappel de round"
                    />
                  </View>
                ) : null}
              </SwitchRow>
              <SwitchRow
                title="Série à garder"
                description={`À ${formatReminderTime(STREAK_REMINDER_TIME.hour, STREAK_REMINDER_TIME.minute)}, si ta série atteint ${STREAK_MIN_DAYS} jours et que tu n’as pas encore fait d’exercice aujourd’hui.`}
                value={settings.streakAtRisk.enabled}
                onValueChange={toggle('streakAtRisk')}
                disabled={!masterOn}
              />
              <SwitchRow
                title="Exercice de la semaine"
                description={`Chaque ${getWeekdayLong(settings.practiceReminder.weekday)} à ${formatReminderTime(settings.practiceReminder.hour)}, sauf si tu as déjà fait un exercice cette semaine.`}
                value={settings.practiceReminder.enabled}
                onValueChange={toggle('practiceReminder')}
                disabled={!masterOn}
              >
                {masterOn && settings.practiceReminder.enabled ? (
                  <View style={styles.chips}>
                    <ChipGroup
                      options={WEEKDAY_OPTIONS}
                      value={settings.practiceReminder.weekday}
                      onChange={(weekday) => setReminder('practiceReminder', { weekday })}
                      accessibilityLabel="Jour du rappel d’exercice"
                    />
                    <ChipGroup
                      options={PRACTICE_HOURS}
                      value={settings.practiceReminder.hour}
                      onChange={(hour) => setReminder('practiceReminder', { hour })}
                      accessibilityLabel="Heure du rappel d’exercice"
                    />
                  </View>
                ) : null}
              </SwitchRow>
            </AppCard>

            <View style={styles.testBlock}>
              <TextAction
                label="Tester une notification"
                tone="muted"
                underline
                onPress={() => void handleTest()}
                loading={testState === 'sending'}
                accessibilityHint="Envoie une notification dans 3 secondes"
              />
              {testState !== 'idle' && testState !== 'sending' ? (
                <Text style={styles.caption} accessibilityLiveRegion="polite">
                  {TEST_MESSAGES[testState]}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  first = false,
  children,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  first?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      <View style={styles.rowMain}>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, disabled && styles.dimmed]}>{title}</Text>
          <Text style={[styles.rowDescription, disabled && styles.dimmed]}>{description}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.lineStrong, true: colors.green }}
          ios_backgroundColor={colors.lineStrong}
          accessibilityLabel={title}
        />
      </View>
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
      marginTop: Spacing.sm,
    },
    listCard: {
      paddingVertical: 0,
    },
    row: {
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    rowDescription: {
      ...Typography.caption,
      color: colors.ink2,
    },
    dimmed: {
      opacity: 0.6,
    },
    chips: {
      gap: Spacing.xs,
      paddingBottom: Spacing.xs,
    },
    notice: {
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      gap: Spacing.xxs,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    noticeText: {
      ...Typography.body,
      color: colors.ink2,
    },
    testBlock: {
      gap: Spacing.xxs,
      marginTop: Spacing.xs,
    },
    caption: {
      ...Typography.caption,
      color: colors.ink3,
    },
  });
