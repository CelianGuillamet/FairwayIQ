import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Fonts, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useThemedStyles } from '../../lib/theme';
import { AuthHero } from '../../components/auth/AuthHero';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { TextAction } from '../../components/ui/TextAction';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('Erreur', 'Renseigne ton email et ton mot de passe.');
      return;
    }

    console.info('[auth] Login attempt');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        console.warn('[auth] Login failed', {
          message: error.message,
        });
        Alert.alert('Erreur', error.message);
        return;
      }

      console.info('[auth] Login succeeded', {
        userId: data.user?.id ?? null,
      });

      router.replace('/');
    } catch (error: any) {
      console.warn('[auth] Login crashed', {
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHero
          icon="flag"
          title="FairwayIQ"
          subtitle="Le cockpit d’analyse golf, pensé comme un vrai produit premium."
        />

        <AppCard style={styles.formCard}>
          <Text style={styles.formTitle} accessibilityRole="header">
            Connexion
          </Text>
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

          <TextAction
            label="Mot de passe oublié ?"
            tone="muted"
            role="link"
            onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } })}
            style={styles.forgotLink}
          />

          <AppButton
            label={loading ? 'Connexion...' : 'Se connecter'}
            onPress={handleLogin}
            loading={loading}
            style={styles.primaryButton}
          />

          <Link href="/(auth)/register" asChild>
            <Pressable style={styles.link} accessibilityRole="link">
              <Text style={styles.linkText}>
                Pas encore de compte ? <Text style={styles.linkBold}>Créer un compte</Text>
              </Text>
            </Pressable>
          </Link>
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
    formTitle: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    formSubtitle: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: 6,
      marginBottom: 18,
    },
    forgotLink: {
      alignSelf: 'flex-end',
      marginTop: -Spacing.xs,
    },
    primaryButton: {
      marginTop: 6,
    },
    link: {
      minHeight: 44,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkText: {
      ...Typography.body,
      color: colors.ink2,
    },
    linkBold: {
      fontFamily: Fonts.sansBold,
      color: colors.ink,
      textDecorationLine: 'underline',
    },
  });
