import type { AuthCallbackOutcome } from './auth-link';

export const MIN_PASSWORD_LENGTH = 8;
export const RESEND_COOLDOWN_MS = 30_000;

export const RESET_REQUEST_CONFIRMATION = 'Si un compte existe pour cette adresse, un email vient d’être envoyé.';
export const RESET_REQUEST_HINT =
  'Ouvre le lien depuis cet appareil, dans le dernier email reçu. Pense à vérifier tes spams.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

const NETWORK_MESSAGE = 'Connexion impossible. Vérifie ton réseau puis réessaie.';
const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);
const SESSION_CODES = new Set([
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'bad_jwt',
  'no_authorization',
]);

export type AuthErrorLike = {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (!email) {
    return 'Renseigne ton adresse email.';
  }
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email)
    ? null
    : 'Cette adresse email ne semble pas valide.';
}

export type NewPasswordErrors = { password?: string; confirmation?: string };

export function validateNewPassword(password: string, confirmation: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};

  if (!password) {
    errors.password = 'Choisis un mot de passe.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }

  if (!confirmation) {
    errors.confirmation = 'Confirme ton mot de passe.';
  } else if (password !== confirmation) {
    errors.confirmation = 'Les deux mots de passe ne correspondent pas.';
  }

  return errors;
}

export function hasPasswordErrors(errors: NewPasswordErrors) {
  return errors.password !== undefined || errors.confirmation !== undefined;
}

export function secondsRemaining(endsAt: number, now: number) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function sendButtonLabel({
  sending,
  remaining,
  hasSent,
}: {
  sending: boolean;
  remaining: number;
  hasSent: boolean;
}) {
  if (sending) {
    return 'Envoi...';
  }
  if (remaining > 0) {
    return `${hasSent ? 'Renvoyer' : 'Réessayer'} dans ${remaining} s`;
  }
  return hasSent ? 'Renvoyer le lien' : 'Envoyer le lien';
}

function isRateLimited(error: AuthErrorLike) {
  return error.status === 429 || (error.code !== undefined && RATE_LIMIT_CODES.has(error.code));
}

function isNetworkFailure(error: AuthErrorLike) {
  return error.name === 'AuthRetryableFetchError';
}

export type ResetRequestResult =
  | { status: 'sent' }
  | { status: 'failed'; kind: 'rate_limited' | 'network' | 'invalid_email' | 'unexpected'; message: string };

// Unknown addresses succeed server-side, so every non-failure ends in the same confirmation.
export function resolveResetRequest(error: AuthErrorLike | null | undefined): ResetRequestResult {
  if (!error || error.code === 'user_not_found') {
    return { status: 'sent' };
  }
  if (isRateLimited(error)) {
    return {
      status: 'failed',
      kind: 'rate_limited',
      message: 'Trop de demandes pour le moment. Patiente quelques minutes avant de redemander un lien.',
    };
  }
  if (isNetworkFailure(error)) {
    return { status: 'failed', kind: 'network', message: NETWORK_MESSAGE };
  }
  if (error.code === 'validation_failed' || error.code === 'email_address_invalid') {
    return { status: 'failed', kind: 'invalid_email', message: 'Cette adresse email ne semble pas valide.' };
  }
  return {
    status: 'failed',
    kind: 'unexpected',
    message: 'L’email n’a pas pu être envoyé. Réessaie dans quelques minutes.',
  };
}

export type PasswordUpdateFailure = {
  kind: 'expired' | 'same_password' | 'weak_password' | 'rate_limited' | 'network' | 'unexpected';
  message: string;
};

export function describePasswordUpdateError(error: AuthErrorLike): PasswordUpdateFailure {
  if (error.code === 'same_password') {
    return { kind: 'same_password', message: 'Choisis un mot de passe différent de l’ancien.' };
  }
  if (error.code === 'weak_password' || error.name === 'AuthWeakPasswordError') {
    return {
      kind: 'weak_password',
      message: 'Ce mot de passe est trop faible. Ajoute des caractères ou choisis-en un autre.',
    };
  }
  if (
    error.name === 'AuthSessionMissingError' ||
    error.status === 401 ||
    error.status === 403 ||
    (error.code !== undefined && SESSION_CODES.has(error.code))
  ) {
    return { kind: 'expired', message: 'Le lien a expiré. Demande-en un nouveau.' };
  }
  if (isRateLimited(error)) {
    return { kind: 'rate_limited', message: 'Trop de tentatives. Réessaie dans quelques minutes.' };
  }
  if (isNetworkFailure(error)) {
    return { kind: 'network', message: NETWORK_MESSAGE };
  }
  return { kind: 'unexpected', message: 'Impossible de mettre à jour ton mot de passe. Réessaie.' };
}

export type RecoveryLinkView = 'ready' | 'invalid' | 'no_verifier' | 'signed_in';

export function viewForCallbackOutcome(outcome: AuthCallbackOutcome): RecoveryLinkView {
  if (outcome.status === 'success') {
    return 'ready';
  }
  if (outcome.status === 'failed') {
    return 'invalid';
  }
  if (outcome.reason === 'signed_in') {
    return 'signed_in';
  }
  return outcome.reason === 'no_verifier' ? 'no_verifier' : 'invalid';
}
