import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../lib/supabase';
import { fontAssets } from '../lib/fonts';
import { ThemeProvider, useTheme } from '../lib/theme';
import { shouldRedirectToLogin } from '../lib/recovery-session';
import { useAuthStore } from '../stores/auth';
import { useSubscriptionStore } from '../stores/subscription';
import { routeForNotificationType, setupNotificationResponseListener } from '../lib/notifications';
import { useNotificationPlanner } from '../lib/use-notification-planner';
import { useBadgeSync } from '../lib/use-badge-sync';
import { useRoundQueueSync } from '../lib/use-round-queue-sync';
import { identifyPurchasesUser, initPurchases, resetPurchasesUser } from '../lib/purchases';
import { initSentry } from '../lib/sentry';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BadgeCelebration } from '../components/badges/BadgeCelebration';

initSentry();
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <FontGate>
        <RootNavigator />
      </FontGate>
    </ThemeProvider>
  );
}

function FontGate({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  return ready ? <>{children}</> : null;
}

function RootNavigator() {
  const { colors, scheme } = useTheme();
  const { setSession, fetchProfile, session, loading } = useAuthStore();
  const userId = session?.user?.id ?? null;
  const segments = useSegments();
  const needsLogin = shouldRedirectToLogin({ loading, hasSession: !!session, segments });

  useNotificationPlanner();
  useBadgeSync();
  useRoundQueueSync();

  useEffect(() => {
    if (needsLogin) {
      router.replace('/(auth)/login');
    }
  }, [needsLogin]);

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
      setSession(session, event);
      if (session) {
        void fetchProfile();
      }
      if (event === 'SIGNED_IN' && !useAuthStore.getState().passwordRecovery) {
        router.replace('/');
      }
    });

    const notifSub = setupNotificationResponseListener((data) => {
      const route = routeForNotificationType(data.type);
      if (route) {
        router.push(route);
      }
    });

    return () => {
      subscription.unsubscribe();
      notifSub.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="reset-password" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="diagnostic" />
        <Stack.Screen name="debrief" />
        <Stack.Screen name="round-detail" />
        <Stack.Screen name="leaks" />
        <Stack.Screen name="trophies" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="bag" />
        <Stack.Screen name="export-data" />
        <Stack.Screen name="help" />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
      <BadgeCelebration />
    </ErrorBoundary>
  );
}
