import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth';
import { Colors } from '../constants';

export default function Index() {
  const { session, profile, loading, profileLoading } = useAuthStore();

  if (loading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.text} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile?.onboarding_complete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
