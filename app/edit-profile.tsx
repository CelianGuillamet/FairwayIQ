import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openLegalUrl } from '../lib/legal';
import { MANAGE_SUBSCRIPTION_URL } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { GOALS, HANDICAP_LEVELS, PLAY_FREQUENCIES, Radius, Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import { AppInput } from '../components/ui/AppInput';
import { AppButton } from '../components/ui/AppButton';
import { ChoiceTile } from '../components/ui/ChoiceTile';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';

const SAVE_ERROR_MESSAGE = 'Impossible d’enregistrer tes modifications pour le moment. Réessaie dans un instant.';
const DELETE_ERROR_MESSAGE = 'La suppression du compte a échoué. Réessaie plus tard.';

export default function EditProfileScreen() {
  const { profile, fetchProfile, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [handicap, setHandicap] = useState<number>(profile?.handicap ?? 36);
  const [playFrequency, setPlayFrequency] = useState(profile?.play_frequency ?? 'monthly');
  const [goal, setGoal] = useState(profile?.goal ?? 'lower_handicap');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        handicap,
        play_frequency: playFrequency,
        goal,
      })
      .eq('user_id', profile?.user_id);

    setSaving(false);

    if (error) {
      console.warn('[edit-profile] Profile update failed', { message: error.message });
      Alert.alert('Erreur', SAVE_ERROR_MESSAGE);
      return;
    }

    await fetchProfile();
    router.back();
  };

  const performDeleteAccount = async () => {
    setDeleting(true);

    const { error } = await supabase.functions.invoke('delete-account');

    if (error) {
      console.warn('[edit-profile] Account deletion failed', { message: error.message });
      setDeleting(false);
      Alert.alert('Erreur', DELETE_ERROR_MESSAGE);
      return;
    }

    await signOut();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données (rounds, diagnostics, profil) seront définitivement supprimées.\n\nSi tu as un abonnement Premium, supprimer ton compte ne l’annule pas : Apple continuera à te facturer. Pour l’annuler, ouvre Réglages > ton nom > Abonnements sur ton iPhone, ou touche « Gérer mon abonnement ».',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Gérer mon abonnement', onPress: () => void openLegalUrl(MANAGE_SUBSCRIPTION_URL) },
        { text: 'Supprimer', style: 'destructive', onPress: () => void performDeleteAccount() },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title="Modifier le profil"
          subtitle="Ajuste les réglages qui pilotent la personnalisation du produit."
          trailing={<TextAction label="Fermer" tone="muted" onPress={() => router.back()} />}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Identité
          </Text>
          <AppInput
            label="Prénom"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ton prénom"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Handicap
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Handicap">
            {HANDICAP_LEVELS.map((level) => (
              <ChoiceTile
                key={level.value}
                label={level.label}
                selected={handicap === level.value}
                onPress={() => setHandicap(level.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Fréquence de jeu
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Fréquence de jeu">
            {PLAY_FREQUENCIES.map((frequency) => (
              <ChoiceTile
                key={frequency.value}
                label={frequency.label}
                selected={playFrequency === frequency.value}
                onPress={() => setPlayFrequency(frequency.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Objectif principal
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Objectif principal">
            {GOALS.map((currentGoal) => (
              <ChoiceTile
                key={currentGoal.value}
                label={currentGoal.label}
                selected={goal === currentGoal.value}
                onPress={() => setGoal(currentGoal.value)}
              />
            ))}
          </View>
        </View>

        <AppButton
          label="Sauvegarder les modifications"
          onPress={() => void handleSave()}
          disabled={!displayName.trim()}
          loading={saving}
          style={styles.primaryAction}
        />

        <AppButton
          label="Annuler"
          variant="ghost"
          onPress={() => router.back()}
        />

        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle} accessibilityRole="header">
            Zone dangereuse
          </Text>
          <Text style={styles.dangerText}>
            La suppression de ton compte efface définitivement ton profil, tes rounds et tes diagnostics. Cette action est irréversible.
          </Text>
          <Text style={styles.dangerText}>
            Elle n’annule pas un abonnement Premium Apple : annule-le toi-même pour ne plus être facturé.
          </Text>
          <TextAction
            label="Gérer mon abonnement"
            role="link"
            underline
            onPress={() => void openLegalUrl(MANAGE_SUBSCRIPTION_URL)}
            accessibilityHint="Ouvre les réglages d’abonnement Apple"
          />
          <DangerButton label="Supprimer mon compte" onPress={handleDeleteAccount} loading={deleting} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DangerButton({ label, onPress, loading }: { label: string; onPress: () => void; loading: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading, busy: loading }}
    >
      {loading ? <ActivityIndicator color={colors.error} /> : <Text style={styles.dangerButtonLabel}>{label}</Text>}
    </Pressable>
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
    },
    section: {
      marginBottom: Spacing.sm,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
      marginBottom: Spacing.sm,
    },
    primaryAction: {
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    dangerSection: {
      marginTop: Spacing.xl,
      padding: 18,
      gap: Spacing.xs,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.errorBg,
    },
    dangerTitle: {
      ...Typography.heading,
      color: colors.error,
    },
    dangerText: {
      ...Typography.body,
      color: colors.ink2,
    },
    dangerButton: {
      minHeight: 52,
      marginTop: Spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: colors.error,
    },
    dangerButtonLabel: {
      ...Typography.heading,
      fontSize: 15,
      lineHeight: 20,
      color: colors.error,
    },
    pressed: {
      opacity: 0.7,
    },
  });
