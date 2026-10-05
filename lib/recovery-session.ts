const PASSWORD_RECOVERY = 'PASSWORD_RECOVERY';
const AUTH_LINK_ROUTES = ['auth-callback', 'reset-password'];
const SIGNED_OUT_AUTH_SCREENS = ['login', 'register', 'forgot-password'];

// An update without a session is not a sign-out: the initial-session event can land after the reset
// screen raised the flag and before the exchange signs the user in, and it must not drop it.
// Besides the explicit signOut() and the screen's own calls, only SIGNED_OUT or another user clear it.
export function nextPasswordRecovery(
  current: boolean,
  event: string | undefined,
  hasSession: boolean,
  userChanged = false
) {
  if (event === 'SIGNED_OUT' || userChanged) {
    return false;
  }
  if (event === PASSWORD_RECOVERY) {
    return hasSession;
  }
  return current;
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

type VerifierStore = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
};

// resetPasswordForEmail deletes the stored PKCE verifier when a request fails, which would orphan
// the link of an earlier, still valid email (a rate-limited resend, for instance).
export async function keepVerifierOnFailure<T extends { error: unknown }>(
  store: VerifierStore,
  request: () => Promise<T>
): Promise<T> {
  const previous = await store.read();
  const restore = async () => {
    if (previous !== null) {
      await store.write(previous);
    }
  };

  try {
    const result = await request();
    if (result.error) {
      await restore();
    }
    return result;
  } catch (error) {
    await restore();
    throw error;
  }
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
