import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth';
import { Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import { AppButton } from '../components/ui/AppButton';

export default function Index() {
  const { session, profile, loading, profileLoading, profileError, fetchProfile, signOut } = useAuthStore();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (loading || (session && profileLoading)) {
    return (
      <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel="Chargement">
        <ActivityIndicator color={colors.ink} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  if (!profile && profileError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title} accessibilityRole="header">
          Impossible de charger ton profil
        </Text>
        <Text style={styles.message}>Vérifie ta connexion puis réessaie.</Text>
        <AppButton label="Réessayer" onPress={() => void fetchProfile()} style={styles.button} />
        <AppButton label="Se déconnecter" variant="ghost" onPress={() => void signOut()} style={styles.button} />
      </View>
    );
  }

  if (!profile?.onboarding_complete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.bg,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
      textAlign: 'center',
    },
    message: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    button: {
      alignSelf: 'stretch',
      marginTop: 10,
    },
  });
