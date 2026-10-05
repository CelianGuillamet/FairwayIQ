import { createClient } from '@supabase/supabase-js';
import { isRecoveryCodeVerifier, nextPasswordRecovery, shouldRedirectToLogin } from './recovery-session';

describe('nextPasswordRecovery', () => {
  it('turns on when the recovery event arrives with a session', () => {
    expect(nextPasswordRecovery(false, 'PASSWORD_RECOVERY', true)).toBe(true);
  });

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION', undefined])(
    'keeps the current value on %p',
    (event) => {
      expect(nextPasswordRecovery(true, event, true)).toBe(true);
      expect(nextPasswordRecovery(false, event, true)).toBe(false);
    }
  );

  it('turns off as soon as there is no session', () => {
    expect(nextPasswordRecovery(true, 'SIGNED_OUT', false)).toBe(false);
    expect(nextPasswordRecovery(true, undefined, false)).toBe(false);
    expect(nextPasswordRecovery(true, 'PASSWORD_RECOVERY', false)).toBe(false);
  });
});

describe('isRecoveryCodeVerifier', () => {
  it('recognises the suffix added by resetPasswordForEmail, JSON-encoded or not', () => {
    expect(isRecoveryCodeVerifier('"abc123/PASSWORD_RECOVERY"')).toBe(true);
    expect(isRecoveryCodeVerifier('abc123/PASSWORD_RECOVERY')).toBe(true);
  });

  it.each([null, '', 'abc123', '"abc123"', '"abc123/OTHER"', '{"a":"b/PASSWORD_RECOVERY"}'])('rejects %p', (value) => {
    expect(isRecoveryCodeVerifier(value)).toBe(false);
  });

  describe('against the installed supabase-js', () => {
    function createClientWithStorage() {
      const store = new Map<string, string>();
      const fetchMock = jest.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      const client = createClient('https://test.supabase.co', 'anon-key', {
        auth: {
          storage: {
            getItem: async (key: string) => store.get(key) ?? null,
            setItem: async (key: string, value: string) => void store.set(key, value),
            removeItem: async (key: string) => void store.delete(key),
          },
          storageKey: 'sb-test-auth-token',
          flowType: 'pkce',
          autoRefreshToken: false,
          persistSession: true,
        },
        global: { fetch: fetchMock as unknown as typeof fetch },
      });
      return { client, store };
    }

    it('stores a recovery verifier for a reset request and a plain one for other flows', async () => {
      const reset = createClientWithStorage();
      await reset.client.auth.resetPasswordForEmail('toi@email.com', { redirectTo: 'fairwayiq://reset-password' });

      const otp = createClientWithStorage();
      await otp.client.auth.signInWithOtp({ email: 'toi@email.com', options: { emailRedirectTo: 'fairwayiq://auth-callback' } });

      expect(isRecoveryCodeVerifier(reset.store.get('sb-test-auth-token-code-verifier') ?? null)).toBe(true);
      expect(isRecoveryCodeVerifier(otp.store.get('sb-test-auth-token-code-verifier') ?? null)).toBe(false);
    });
  });
});

describe('shouldRedirectToLogin', () => {
  const base = { loading: false, hasSession: false };

  it('waits for the session to load and never redirects a signed-in user', () => {
    expect(shouldRedirectToLogin({ ...base, loading: true, segments: [] })).toBe(false);
    expect(shouldRedirectToLogin({ ...base, hasSession: true, segments: ['(tabs)'] })).toBe(false);
  });

  it('sends a signed-out user away from the app screens', () => {
    expect(shouldRedirectToLogin({ ...base, segments: [] })).toBe(true);
    expect(shouldRedirectToLogin({ ...base, segments: ['(tabs)'] })).toBe(true);
    expect(shouldRedirectToLogin({ ...base, segments: ['round-detail'] })).toBe(true);
  });

  it('lets the link screens run while signed out', () => {
    expect(shouldRedirectToLogin({ ...base, segments: ['auth-callback'] })).toBe(false);
    expect(shouldRedirectToLogin({ ...base, segments: ['reset-password'] })).toBe(false);
  });

  it('leaves the public auth screens alone but still ejects a signed-out onboarding', () => {
    expect(shouldRedirectToLogin({ ...base, segments: ['(auth)', 'login'] })).toBe(false);
    expect(shouldRedirectToLogin({ ...base, segments: ['(auth)', 'register'] })).toBe(false);
    expect(shouldRedirectToLogin({ ...base, segments: ['(auth)', 'forgot-password'] })).toBe(false);
    expect(shouldRedirectToLogin({ ...base, segments: ['(auth)', 'onboarding'] })).toBe(true);
  });
});
