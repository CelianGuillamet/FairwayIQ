import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { Colors, PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../../constants';
import { openLegalUrl } from '../../lib/legal';
import { DecorativeBackground } from '../../components/ui/DecorativeBackground';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppCheckbox } from '../../components/ui/AppCheckbox';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert('Erreur', "Renseigne un email et un mot de passe.");
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    if (!acceptedLegal) {
      Alert.alert(
        'Erreur',
        'Accepte les conditions d’utilisation, la politique de confidentialité et le traitement de tes données par le coach IA pour créer ton compte.'
      );
      return;
    }
    const emailRedirectTo = Linking.createURL('auth-callback');
    setLoading(true);
    try {
      const signUp = (redirectTo?: string) =>
        supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
        });

      let { data, error } = await signUp(emailRedirectTo);
      if (error && /redirect/i.test(error.message)) {
        ({ data, error } = await signUp());
      }
      if (error) {
        const shouldShowRedirectUrl = /redirect/i.test(error.message);
        const message = shouldShowRedirectUrl
          ? `${error.message}\n\nURL de redirection : ${emailRedirectTo}`
          : error.message;
        Alert.alert('Erreur', message);
        return;
      }
      if (data.session) {
        router.replace('/');
        return;
      }
      Alert.alert(
        'Vérifie ton email ✉️',
        `Un lien de confirmation a été envoyé à ${normalizedEmail}. Clique dessus pour activer ton compte, puis connecte-toi.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
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
            <Text style={styles.logoGlyph}>✦</Text>
          </View>
          <Text style={styles.logo}>Créer ton espace joueur</Text>
          <Text style={styles.tagline}>
            Active ton compte, configure ton profil et commence à construire un vrai historique golf.
          </Text>
        </View>

        <AppCard accent="highlight" style={styles.formCard}>
          <Text style={styles.formTitle}>Inscription</Text>
          <Text style={styles.formSubtitle}>
            Crée ton compte pour sauvegarder tes parties. Un email de confirmation peut t’être envoyé pour valider ton adresse.
          </Text>

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
            hint="Minimum 6 caractères."
            placeholder="Choisis un mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <View style={styles.aiDisclosure}>
            <Text style={styles.aiDisclosureTitle}>Coach IA et tes données</Text>
            <Text style={styles.aiDisclosureText}>
              Pour générer ton feedback, le coach IA envoie les données de tes parties et tes notes à
              Anthropic (Claude). Le détail des données transmises est décrit dans notre{' '}
              <Text
                style={styles.legalLink}
                accessibilityRole="link"
                onPress={() => void openLegalUrl(PRIVACY_POLICY_URL)}
              >
                politique de confidentialité
              </Text>
              .
            </Text>
          </View>

          <AppCheckbox
            checked={acceptedLegal}
            onToggle={() => setAcceptedLegal((value) => !value)}
            accessibilityLabel="J’accepte les conditions d’utilisation, la politique de confidentialité et le traitement de mes données par le coach IA décrit ci-dessus"
          >
            J’accepte le traitement décrit ci-dessus, les{' '}
            <Text
              style={styles.legalLink}
              accessibilityRole="link"
              onPress={() => void openLegalUrl(TERMS_OF_USE_URL)}
            >
              conditions d’utilisation
            </Text>{' '}
            et la{' '}
            <Text
              style={styles.legalLink}
              accessibilityRole="link"
              onPress={() => void openLegalUrl(PRIVACY_POLICY_URL)}
            >
              politique de confidentialité
            </Text>
            .
          </AppCheckbox>

          <AppButton
            label={loading ? 'Création...' : 'Créer mon compte'}
            onPress={handleRegister}
            loading={loading}
            disabled={!acceptedLegal}
            style={styles.primaryButton}
          />

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>
                Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
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
    backgroundColor: Colors.accentBlueMuted,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoGlyph: {
    fontSize: 28,
    color: Colors.accentBlue,
  },
  logo: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 20,
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
  aiDisclosure: {
    marginBottom: 16,
  },
  aiDisclosureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  aiDisclosureText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
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
  legalLink: {
    color: Colors.accentBlue,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  linkBold: {
    color: Colors.accentBlue,
    fontWeight: '800',
  },
});
