import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, hasPendingPasswordRecovery } from '../lib/supabase';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { completeAuthCallback } from '../lib/auth-link';
import {
  MIN_PASSWORD_LENGTH,
  describePasswordUpdateError,
  hasPasswordErrors,
  validateNewPassword,
  viewForCallbackOutcome,
  type NewPasswordErrors,
  type RecoveryLinkView,
} from '../lib/password-reset';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useAuthStore } from '../stores/auth';
import { AuthHero } from '../components/auth/AuthHero';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { AppInput } from '../components/ui/AppInput';
import type { IconName } from '../components/ui/Icon';

type ScreenState = 'checking' | 'done' | RecoveryLinkView;

const NOTICES: Record<Exclude<ScreenState, 'ready'>, { icon: IconName; title: string; subtitle: string }> = {
  checking: {
    icon: 'lock',
    title: 'Vérification du lien',
    subtitle: 'Un instant, on prépare ton nouveau mot de passe.',
  },
  invalid: {
    icon: 'alert',
    title: 'Lien invalide ou expiré',
    subtitle: 'Ce lien n’est plus valable. Demande-en un nouveau pour choisir ton mot de passe.',
  },
  no_verifier: {
    icon: 'alert',
    title: 'Lien non utilisable ici',
    subtitle:
      'Ce lien ne fonctionne que sur l’appareil où tu as demandé la réinitialisation. Demande un nouveau lien depuis cet appareil.',
  },
  signed_in: {
    icon: 'info',
    title: 'Tu es déjà connecté',
    subtitle: 'Ce lien sert à choisir un nouveau mot de passe après un oubli. Tu n’as rien à faire ici.',
  },
  done: {
    icon: 'check',
    title: 'Mot de passe mis à jour',
    subtitle: 'Tu es connecté avec ton nouveau mot de passe.',
  },
};

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const loading = useAuthStore((state) => state.loading);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [screen, setScreen] = useState<ScreenState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const handledCode = useRef<string | string[] | undefined | null>(null);

  useEffect(() => {
    if (loading || handledCode.current === code) {
      return;
    }
    handledCode.current = code;

    const { session, passwordRecovery } = useAuthStore.getState();
    if (session && passwordRecovery) {
      setScreen((current) => (current === 'done' ? current : 'ready'));
      return;
    }

    void completeAuthCallback(code, {
      hasSession: () => !!useAuthStore.getState().session,
      hasCodeVerifier: hasPendingPasswordRecovery,
      exchange: (authCode) => {
        useAuthStore.getState().setPasswordRecovery(true);
        return supabase.auth.exchangeCodeForSession(authCode);
      },
    }).then((outcome) => {
      if (outcome.status !== 'success') {
        useAuthStore.getState().setPasswordRecovery(false);
      }
      setScreen((current) => (current === 'done' ? current : viewForCallbackOutcome(outcome)));
    });
  }, [loading, code]);

  const handleSubmit = async () => {
    if (saving) {
      return;
    }

    const nextErrors = validateNewPassword(password, confirmation);
    setErrors(nextErrors);
    if (hasPasswordErrors(nextErrors)) {
      return;
    }

    setFailure(null);
    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) {
        useAuthStore.getState().setPasswordRecovery(false);
        setPassword('');
        setConfirmation('');
        setScreen('done');
        return;
      }

      console.warn('[auth] Password update failed', { status: error.status, code: error.code });
      const problem = describePasswordUpdateError(error);
      if (problem.kind === 'expired') {
        await useAuthStore.getState().signOut();
        setScreen('invalid');
      } else if (problem.kind === 'same_password' || problem.kind === 'weak_password') {
        setErrors({ password: problem.message });
      } else {
        setFailure(problem.message);
      }
    } catch {
      console.warn('[auth] Password update crashed');
      setFailure(describePasswordUpdateError({}).message);
    } finally {
      setSaving(false);
    }
  };

  const renderActions = () => {
    if (screen === 'invalid' || screen === 'no_verifier') {
      return (
        <>
          <AppButton
            label="Demander un nouveau lien"
            onPress={() => router.replace('/(auth)/forgot-password')}
            style={styles.action}
          />
          <AppButton
            label="Retour à la connexion"
            variant="ghost"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.action}
          />
        </>
      );
    }
    if (screen === 'signed_in' || screen === 'done') {
      return (
        <AppButton
          label={screen === 'done' ? 'Continuer' : 'Retour à l’app'}
          onPress={() => router.replace('/')}
          style={styles.action}
        />
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {screen === 'ready' ? (
          <>
            <AuthHero
              icon="lock"
              compact
              title="Nouveau mot de passe"
              subtitle="Choisis le mot de passe que tu utiliseras pour te connecter."
            />

            <AppCard style={styles.formCard}>
              <AppInput
                label="Nouveau mot de passe"
                hint={`Minimum ${MIN_PASSWORD_LENGTH} caractères.`}
                placeholder="Choisis un mot de passe"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                error={errors.password}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
              />

              <AppInput
                label="Confirme le mot de passe"
                placeholder="Retape ton mot de passe"
                value={confirmation}
                onChangeText={(value) => {
                  setConfirmation(value);
                  setErrors((current) => ({ ...current, confirmation: undefined }));
                }}
                error={errors.confirmation}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
              />

              <AppButton
                label={saving ? 'Mise à jour...' : 'Mettre à jour'}
                onPress={() => void handleSubmit()}
                loading={saving}
                style={styles.primaryButton}
              />

              {failure ? (
                <Text style={styles.failure} accessibilityRole="alert">
                  {failure}
                </Text>
              ) : null}
            </AppCard>
          </>
        ) : (
          <>
            <AuthHero
              icon={NOTICES[screen].icon}
              compact
              title={NOTICES[screen].title}
              subtitle={NOTICES[screen].subtitle}
            />
            {screen === 'checking' ? (
              <ActivityIndicator size="large" color={colors.ink} accessibilityLabel="Chargement" />
            ) : null}
            {renderActions()}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    formCard: {
      paddingVertical: 22,
    },
    primaryButton: {
      marginTop: 6,
    },
    failure: {
      ...Typography.body,
      color: colors.error,
      marginTop: Spacing.md,
    },
    action: {
      marginTop: Spacing.xs,
    },
  });
