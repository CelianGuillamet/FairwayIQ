import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openLegalUrl } from '../lib/legal';
import { MANAGE_SUBSCRIPTION_URL } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { Colors, GOALS, HANDICAP_LEVELS, PLAY_FREQUENCIES } from '../constants';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppInput } from '../components/ui/AppInput';
import { AppButton } from '../components/ui/AppButton';
import { ChoiceTile } from '../components/ui/ChoiceTile';
import { PageHeader } from '../components/ui/PageHeader';

const SAVE_ERROR_MESSAGE = 'Impossible d’enregistrer tes modifications pour le moment. Réessaie dans un instant.';
const DELETE_ERROR_MESSAGE = 'La suppression du compte a échoué. Réessaie plus tard.';

export default function EditProfileScreen() {
  const { profile, fetchProfile, signOut } = useAuthStore();
  const insets = useSafeAreaInsets();

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
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">
        <PageHeader
          eyebrow="Profil"
          title="Modifier le profil"
          subtitle="Ajuste les réglages qui pilotent la personnalisation du produit."
          trailing={(
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.closeText}>Fermer</Text>
            </TouchableOpacity>
          )}
        />

        <AppCard style={styles.section}>
          <Text style={styles.sectionLabel}>Identité</Text>
          <AppInput
            label="Prénom"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ton prénom"
            autoCapitalize="words"
          />
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionLabel}>Handicap</Text>
          {HANDICAP_LEVELS.map((level) => (
            <ChoiceTile
              key={level.value}
              label={level.label}
              selected={handicap === level.value}
              onPress={() => setHandicap(level.value)}
            />
          ))}
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionLabel}>Fréquence de jeu</Text>
          {PLAY_FREQUENCIES.map((frequency) => (
            <ChoiceTile
              key={frequency.value}
              label={frequency.label}
              selected={playFrequency === frequency.value}
              onPress={() => setPlayFrequency(frequency.value)}
            />
          ))}
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionLabel}>Objectif principal</Text>
          {GOALS.map((currentGoal) => (
            <ChoiceTile
              key={currentGoal.value}
              label={currentGoal.label}
              selected={goal === currentGoal.value}
              onPress={() => setGoal(currentGoal.value)}
            />
          ))}
        </AppCard>

        <AppButton
          label="Sauvegarder les modifications"
          onPress={() => void handleSave()}
          disabled={!displayName.trim()}
          loading={saving}
          style={styles.primaryAction}
        />

        <AppButton
          label="Annuler"
          variant="secondary"
          onPress={() => router.back()}
        />

        <AppCard style={styles.dangerSection}>
          <Text style={styles.sectionLabel}>Zone dangereuse</Text>
          <Text style={styles.dangerText}>
            La suppression de ton compte efface définitivement ton profil, tes rounds et tes diagnostics. Cette action est irréversible.
          </Text>
          <Text style={styles.dangerText}>
            Elle n’annule pas un abonnement Premium Apple : annule-le toi-même pour ne plus être facturé.{' '}
            <Text
              style={styles.dangerLink}
              accessibilityRole="link"
              onPress={() => void openLegalUrl(MANAGE_SUBSCRIPTION_URL)}
            >
              Gérer mon abonnement
            </Text>
          </Text>
          <AppButton
            label="Supprimer mon compte"
            variant="secondary"
            onPress={handleDeleteAccount}
            loading={deleting}
            style={styles.dangerAction}
          />
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  closeText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  primaryAction: {
    marginBottom: 10,
  },
  dangerSection: {
    marginTop: 24,
    borderColor: Colors.error,
    borderWidth: 1,
  },
  dangerText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  dangerLink: {
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  dangerAction: {
    borderColor: Colors.error,
  },
});
