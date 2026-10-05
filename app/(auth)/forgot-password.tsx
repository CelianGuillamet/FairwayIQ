import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Fonts, Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import {
  RESEND_COOLDOWN_MS,
  RESET_REQUEST_CONFIRMATION,
  RESET_REQUEST_HINT,
  describeResetRequestError,
  normalizeEmail,
  resolveResetRequest,
  secondsRemaining,
  sendButtonLabel,
  validateEmail,
} from '../../lib/password-reset';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AuthHero } from '../../components/auth/AuthHero';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { Icon } from '../../components/ui/Icon';

function useCooldown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) {
      return;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        setEndsAt(null);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  const start = () => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + RESEND_COOLDOWN_MS);
  };

  return { remaining: endsAt === null ? 0 : secondsRemaining(endsAt, now), start };
}

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { email: emailParam } = useLocalSearchParams<{ email?: string | string[] }>();
  const [email, setEmail] = useState(() => (typeof emailParam === 'string' ? emailParam : ''));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const { remaining, start } = useCooldown();

  const handleSend = async () => {
    if (sending || remaining > 0) {
      return;
    }

    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    setEmailError(null);
    setFailure(null);
    setSending(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) {
        console.warn('[auth] Password reset request failed', { status: error.status, code: error.code });
      }

      const result = resolveResetRequest(error);
      if (result.status === 'sent') {
        setHasSent(true);
        start();
      } else if (result.kind === 'invalid_email') {
        setEmailError(result.message);
      } else {
        setFailure(result.message);
        if (result.kind === 'rate_limited') {
          start();
        }
      }
    } catch {
      console.warn('[auth] Password reset request crashed');
      setFailure(describeResetRequestError({}).message);
    } finally {
      setSending(false);
    }
  };

  const goBackToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHero
          icon="lock"
          compact
          title="Mot de passe oublié"
          subtitle="Entre ton email : on t’envoie un lien pour choisir un nouveau mot de passe."
        />

        <AppCard style={styles.formCard}>
          <AppInput
            label="Email"
            placeholder="toi@email.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setEmailError(null);
            }}
            error={emailError ?? undefined}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
          />

          <AppButton
            label={sendButtonLabel({ sending, remaining, hasSent })}
            onPress={() => void handleSend()}
            loading={sending}
            disabled={remaining > 0}
            style={styles.primaryButton}
          />

          {failure ? (
            <Text style={styles.failure} accessibilityRole="alert">
              {failure}
            </Text>
          ) : null}

          {hasSent ? (
            <View style={styles.confirmation} accessibilityLiveRegion="polite">
              <Icon name="check" size={20} color={colors.green} />
              <View style={styles.confirmationText}>
                <Text style={styles.confirmationTitle}>{RESET_REQUEST_CONFIRMATION}</Text>
                <Text style={styles.confirmationHint}>{RESET_REQUEST_HINT}</Text>
              </View>
            </View>
          ) : null}

          <Pressable style={styles.link} accessibilityRole="link" onPress={goBackToLogin}>
            <Text style={styles.linkBold}>Retour à la connexion</Text>
          </Pressable>
        </AppCard>
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
    confirmation: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.greenBg,
    },
    confirmationText: {
      flex: 1,
    },
    confirmationTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    confirmationHint: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xxs,
    },
    link: {
      minHeight: 44,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkBold: {
      ...Typography.body,
      fontFamily: Fonts.sansBold,
      color: colors.ink,
      textDecorationLine: 'underline',
    },
  });
