const PASSWORD_RECOVERY = 'PASSWORD_RECOVERY';
const AUTH_LINK_ROUTES = ['auth-callback', 'reset-password'];
const SIGNED_OUT_AUTH_SCREENS = ['login', 'register', 'forgot-password'];

export function nextPasswordRecovery(current: boolean, event: string | undefined, hasSession: boolean) {
  if (!hasSession) {
    return false;
  }
  return event === PASSWORD_RECOVERY ? true : current;
}

function decodeStoredValue(stored: string) {
  try {
    const parsed: unknown = JSON.parse(stored);
    return typeof parsed === 'string' ? parsed : stored;
  } catch {
    return stored;
  }
}

// auth-js stores the PKCE verifier as a JSON string `<verifier>/PASSWORD_RECOVERY` when the flow was
// started by resetPasswordForEmail, and reads the suffix back in exchangeCodeForSession.
export function isRecoveryCodeVerifier(stored: string | null) {
  return stored !== null && decodeStoredValue(stored).split('/')[1] === PASSWORD_RECOVERY;
}

export function shouldRedirectToLogin({
  loading,
  hasSession,
  segments,
}: {
  loading: boolean;
  hasSession: boolean;
  segments: readonly string[];
}) {
  if (loading || hasSession) {
    return false;
  }
  const [first, second] = segments;
  if (first !== undefined && AUTH_LINK_ROUTES.includes(first)) {
    return false;
  }
  return !(first === '(auth)' && second !== undefined && SIGNED_OUT_AUTH_SCREENS.includes(second));
}
