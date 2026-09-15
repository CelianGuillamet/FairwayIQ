import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('Erreur', 'Renseigne ton email et ton mot de passe.');
      return;
    }

    console.info('[auth] Login attempt', { email: normalizedEmail });
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        console.warn('[auth] Login failed', {
          email: normalizedEmail,
          message: error.message,
        });
        Alert.alert('Erreur', error.message);
        return;
      }

      console.info('[auth] Login succeeded', {
        email: normalizedEmail,
        userId: data.user?.id ?? null,
      });

      router.replace('/');
    } catch (error: any) {
      console.warn('[auth] Login crashed', {
        email: normalizedEmail,
        message: error?.message ?? 'unknown error',
      });
      Alert.alert('Erreur', error?.message ?? 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DecorativeBackground />
      <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoGlyph}>⛳</Text>
          </View>
          <Text style={styles.logo}>FairwayIQ</Text>
          <Text style={styles.tagline}>Le cockpit d’analyse golf, pensé comme un vrai produit premium.</Text>
        </View>

        <AppCard accent="highlight" style={styles.formCard}>
          <Text style={styles.formTitle}>Connexion</Text>
          <Text style={styles.formSubtitle}>Retrouve tes rounds, tes stats et ton coach IA.</Text>

          <AppInput
            label="Email"
            placeholder="toi@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <AppInput
            label="Mot de passe"
            placeholder="Ton mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <AppButton
            label={loading ? 'Connexion...' : 'Se connecter'}
            onPress={handleLogin}
            loading={loading}
            style={styles.primaryButton}
          />

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>
                Pas encore de compte ? <Text style={styles.linkBold}>Créer un compte</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </AppCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoGlyph: {
    fontSize: 30,
  },
  logo: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.text,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 18,
  },
  formCard: {
    paddingVertical: 22,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
  },
  formSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 18,
  },
  primaryButton: {
    marginTop: 6,
  },
  link: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  linkBold: {
    color: Colors.accentBlue,
    fontWeight: '800',
  },
});
