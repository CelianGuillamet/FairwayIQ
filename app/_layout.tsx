import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { useSubscriptionStore } from '../stores/subscription';
import { setupNotificationResponseListener } from '../lib/notifications';
import { identifyPurchasesUser, initPurchases, resetPurchasesUser } from '../lib/purchases';
import { initSentry } from '../lib/sentry';
import { ErrorBoundary } from '../components/ErrorBoundary';

initSentry();

export default function RootLayout() {
  const { setSession, fetchProfile, session, loading } = useAuthStore();
  const userId = session?.user?.id ?? null;
  const onAuthCallback = useSegments()[0] === 'auth-callback';

  useEffect(() => {
    if (!loading && !session && !onAuthCallback) {
      router.replace('/(auth)/login');
    }
  }, [session, loading, onAuthCallback]);

  useEffect(() => {
    initPurchases();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const subscriptionStore = useSubscriptionStore.getState();
    subscriptionStore.reset();

    if (userId) {
      void identifyPurchasesUser(userId);
      void subscriptionStore.refresh();
    } else {
      void resetPurchasesUser();
    }
  }, [userId, loading]);

  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void useSubscriptionStore.getState().refresh();
      }
    });

    return () => appStateSub.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.info('[auth] Initial session loaded', {
        userId: session?.user?.id ?? null,
      });
      setSession(session);
      if (session) {
        void fetchProfile();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.info('[auth] State change', {
        event,
        userId: session?.user?.id ?? null,
      });
      setSession(session);
      if (session) {
        void fetchProfile();
      }
      if (event === 'SIGNED_IN') {
        router.replace('/');
      }
    });

    const notifSub = setupNotificationResponseListener((data) => {
      if (data.type === 'weekly_plan' || data.type === 'friday_checkin' || data.type === 'midweek_drill') {
        router.push('/(tabs)');
      } else if (data.type === 'pre_round') {
        router.push('/(tabs)/round');
      }
    });

    return () => {
      subscription.unsubscribe();
      notifSub.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="diagnostic" />
        <Stack.Screen name="debrief" />
        <Stack.Screen name="round-detail" />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  );
}
