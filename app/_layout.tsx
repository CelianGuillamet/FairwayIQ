import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { setupNotificationResponseListener } from '../lib/notifications';
import { initPurchases } from '../lib/purchases';

export default function RootLayout() {
  const { setSession, fetchProfile, session, loading } = useAuthStore();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, loading]);

  useEffect(() => {
    initPurchases();
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

    const handleDeepLink = async (url: string) => {
      try {
        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            setSession(data.session);
            void fetchProfile();
            router.replace('/');
          } else if (error) {
            console.warn('[auth] exchangeCodeForSession failed', {
              message: error.message,
            });
          }
          return;
        }

        const hash = parsedUrl.hash?.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash;
        const hashParams = hash ? new URLSearchParams(hash) : null;
        const access_token = parsedUrl.searchParams.get('access_token') ?? hashParams?.get('access_token') ?? null;
        const refresh_token = parsedUrl.searchParams.get('refresh_token') ?? hashParams?.get('refresh_token') ?? null;
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error && data.session) {
            setSession(data.session);
            void fetchProfile();
            router.replace('/');
          } else if (error) {
            console.warn('[auth] setSession from deep link failed', {
              message: error.message,
            });
          }
        }
      } catch (err) {
        console.warn('[auth] Invalid deep link URL', { url, err });
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => {
      subscription.unsubscribe();
      notifSub.remove();
      linkingSub.remove();
    };
  }, []);

  return (
    <>
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
    </>
  );
}
