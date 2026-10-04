import { redactUrlForLogging } from './redact-url';

export type AuthCallbackOutcome =
  | { status: 'success' }
  | { status: 'ignored'; reason: 'invalid_code' | 'signed_in' | 'no_verifier' }
  | { status: 'failed'; message: string };

type AuthCallbackDeps = {
  hasSession: () => boolean;
  hasCodeVerifier: () => Promise<boolean>;
  exchange: (code: string) => Promise<{ error: { message: string } | null }>;
};

const CODE_PATTERN = /^[A-Za-z0-9._~-]{8,512}$/;

function getErrorMessage(error: unknown) {
  const message = typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : undefined;
  return typeof message === 'string' ? message : String(error);
}

export function readAuthCode(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  return typeof value === 'string' && CODE_PATTERN.test(value) ? value : null;
}

// A PKCE code is only redeemable together with the verifier this device generated when it
// started the flow, so links we did not initiate can never sign anyone in. We still skip the
// request when there is no verifier, and never replace a session that is already active.
export async function completeAuthCallback(
  rawCode: string | string[] | undefined,
  deps: AuthCallbackDeps
): Promise<AuthCallbackOutcome> {
  const code = readAuthCode(rawCode);
  if (!code) {
    return { status: 'ignored', reason: 'invalid_code' };
  }

  if (deps.hasSession()) {
    return { status: 'ignored', reason: 'signed_in' };
  }

  try {
    if (!(await deps.hasCodeVerifier())) {
      return { status: 'ignored', reason: 'no_verifier' };
    }

    const { error } = await deps.exchange(code);
    if (error) {
      throw error;
    }
  } catch (error) {
    const message = redactUrlForLogging(getErrorMessage(error));
    console.warn('[auth] exchangeCodeForSession failed', { message });
    return { status: 'failed', message };
  }

  return { status: 'success' };
}
