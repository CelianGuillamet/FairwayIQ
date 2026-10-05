import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './secure-session-storage';
import { isRecoveryCodeVerifier, keepVerifierOnFailure } from './recovery-session';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Same value supabase-js derives by default; pinned so the keys we read directly can't drift.
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
const codeVerifierKey = `${authStorageKey}-code-verifier`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    storageKey: authStorageKey,
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function hasPkceCodeVerifier() {
  return (await authStorage.getItem(codeVerifierKey)) !== null;
}

export async function hasPendingPasswordRecovery() {
  return isRecoveryCodeVerifier(await authStorage.getItem(codeVerifierKey));
}

export function requestPasswordReset(email: string, redirectTo: string) {
  return keepVerifierOnFailure(
    {
      read: () => authStorage.getItem(codeVerifierKey),
      write: (value) => authStorage.setItem(codeVerifierKey, value),
    },
    () => supabase.auth.resetPasswordForEmail(email, { redirectTo })
  );
}

// signOut() returns early on a network error and keeps the stored session, so offline sign-outs need this.
export async function clearStoredAuthSession() {
  await Promise.all(
    [authStorageKey, codeVerifierKey, `${authStorageKey}-user`].map((key) => authStorage.removeItem(key))
  );
}
