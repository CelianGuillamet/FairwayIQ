import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants';
import { supabase, hasPkceCodeVerifier } from '../lib/supabase';
import { completeAuthCallback, type AuthCallbackOutcome } from '../lib/auth-link';
import { useAuthStore } from '../stores/auth';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';

function getMessage(outcome: AuthCallbackOutcome | null) {
  if (outcome?.status === 'failed') {
    return {
      title: 'Lien invalide ou expiré',
      subtitle: 'Ce lien n’a pas pu être utilisé. Retourne sur l’écran de connexion.',
    };
  }

  if (outcome?.status === 'ignored') {
    return {
      title: 'Lien non utilisable ici',
      subtitle: 'Ce lien ne fonctionne que sur l’appareil où le compte a été créé. Si ton email est confirmé, connecte-toi avec ton mot de passe.',
    };
  }

  return {
    title: 'Connexion en cours',
    subtitle: 'On finalise ta session. Si le flux ne reprend pas, retourne sur l’écran de connexion.',
  };
}

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { session, loading } = useAuthStore();
  const [outcome, setOutcome] = useState<AuthCallbackOutcome | null>(null);
  const handledCode = useRef<string | string[] | undefined | null>(null);

  useEffect(() => {
    if (!loading && session) {
      router.replace('/');
    }
  }, [loading, session]);

  useEffect(() => {
    if (loading || handledCode.current === code) {
      return;
    }
    handledCode.current = code;

    void completeAuthCallback(code, {
      hasSession: () => !!useAuthStore.getState().session,
      hasCodeVerifier: hasPkceCodeVerifier,
      exchange: (authCode) => supabase.auth.exchangeCodeForSession(authCode),
    }).then(setOutcome);
  }, [loading, code]);

  const { title, subtitle } = getMessage(outcome);
  const waiting = outcome === null || outcome.status === 'success';

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <AppCard accent="highlight" style={styles.card}>
        {waiting ? <ActivityIndicator size="large" color={Colors.text} /> : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <AppButton
          label="Aller à la connexion"
          variant="secondary"
          onPress={() => router.replace('/(auth)/login')}
          style={styles.button}
        />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },
  button: {
    marginTop: 18,
    width: '100%',
  },
});
