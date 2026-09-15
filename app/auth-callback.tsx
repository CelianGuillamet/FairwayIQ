import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants';
import { useAuthStore } from '../stores/auth';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';

export default function AuthCallbackScreen() {
  const { session, loading } = useAuthStore();

  useEffect(() => {
    if (!loading && session) {
      router.replace('/');
    }
  }, [loading, session]);

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <AppCard accent="highlight" style={styles.card}>
        <ActivityIndicator size="large" color={Colors.text} />
        <Text style={styles.title}>Connexion en cours</Text>
        <Text style={styles.subtitle}>
          On finalise ta session. Si le flux ne reprend pas, retourne sur l’écran de connexion.
        </Text>
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
