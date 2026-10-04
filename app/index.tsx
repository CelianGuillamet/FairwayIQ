import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth';
import { Colors } from '../constants';
import { AppButton } from '../components/ui/AppButton';

export default function Index() {
  const { session, profile, loading, profileLoading, profileError, fetchProfile, signOut } = useAuthStore();

  if (loading || (session && profileLoading)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.text} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  if (!profile && profileError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Impossible de charger ton profil</Text>
        <Text style={styles.message}>Vérifie ta connexion puis réessaie.</Text>
        <AppButton label="Réessayer" onPress={() => void fetchProfile()} style={styles.button} />
        <AppButton label="Se déconnecter" variant="ghost" onPress={() => void signOut()} style={styles.button} />
      </View>
    );
  }

  if (!profile?.onboarding_complete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.background,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 10,
  },
});
