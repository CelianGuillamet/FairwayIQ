import {
  MIN_PASSWORD_LENGTH,
  RESEND_COOLDOWN_MS,
  describePasswordUpdateError,
  hasPasswordErrors,
  normalizeEmail,
  resolveResetRequest,
  secondsRemaining,
  sendButtonLabel,
  validateEmail,
  validateNewPassword,
  viewForCallbackOutcome,
} from './password-reset';

describe('validateEmail', () => {
  it.each(['toi@email.com', '  Toi@Email.COM  ', 'a.b+tag@sub.domain.fr'])('accepts %p', (value) => {
    expect(validateEmail(value)).toBeNull();
  });

  it.each(['', '   '])('asks for an address when %p', (value) => {
    expect(validateEmail(value)).toBe('Renseigne ton adresse email.');
  });

  it.each(['toi', 'toi@', '@email.com', 'toi@email', 'toi@email.c', 'to i@email.com', 'a@b@c.com'])(
    'rejects %p',
    (value) => {
      expect(validateEmail(value)).toBe('Cette adresse email ne semble pas valide.');
    }
  );

  it('rejects an address longer than 254 characters', () => {
    expect(validateEmail(`${'a'.repeat(250)}@b.fr`)).toBe('Cette adresse email ne semble pas valide.');
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Toi@Email.COM ')).toBe('toi@email.com');
  });
});

describe('validateNewPassword', () => {
  const valid = 'a'.repeat(MIN_PASSWORD_LENGTH);

  it('accepts a long enough password that matches its confirmation', () => {
    const errors = validateNewPassword(valid, valid);

    expect(errors).toEqual({});
    expect(hasPasswordErrors(errors)).toBe(false);
  });

  it('accepts a password of exactly the minimum length and rejects one character less', () => {
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1), 'a'.repeat(MIN_PASSWORD_LENGTH - 1)).password).toBe(
      `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
    );
    expect(validateNewPassword(valid, valid).password).toBeUndefined();
  });

  it('asks for both fields when they are empty', () => {
    const errors = validateNewPassword('', '');

    expect(errors).toEqual({ password: 'Choisis un mot de passe.', confirmation: 'Confirme ton mot de passe.' });
    expect(hasPasswordErrors(errors)).toBe(true);
  });

  it('flags a confirmation that differs', () => {
    expect(validateNewPassword(valid, `${valid}x`)).toEqual({
      confirmation: 'Les deux mots de passe ne correspondent pas.',
    });
  });

  it('keeps leading and trailing spaces as part of the password', () => {
    expect(validateNewPassword(` ${valid} `, valid).confirmation).toBe('Les deux mots de passe ne correspondent pas.');
  });
});

describe('cooldown helpers', () => {
  it('rounds the remaining time up to whole seconds and never goes below zero', () => {
    const endsAt = 1_000_000 + RESEND_COOLDOWN_MS;

    expect(RESEND_COOLDOWN_MS).toBe(30_000);
    expect(secondsRemaining(endsAt, 1_000_000)).toBe(30);
    expect(secondsRemaining(endsAt, 1_000_001)).toBe(30);
    expect(secondsRemaining(endsAt, 1_000_000 + 29_001)).toBe(1);
    expect(secondsRemaining(endsAt, endsAt)).toBe(0);
    expect(secondsRemaining(endsAt, endsAt + 5_000)).toBe(0);
  });

  it('labels the button for each state', () => {
    expect(sendButtonLabel({ sending: false, remaining: 0, hasSent: false })).toBe('Envoyer le lien');
    expect(sendButtonLabel({ sending: true, remaining: 0, hasSent: false })).toBe('Envoi...');
    expect(sendButtonLabel({ sending: false, remaining: 28, hasSent: true })).toBe('Renvoyer dans 28 s');
    expect(sendButtonLabel({ sending: false, remaining: 12, hasSent: false })).toBe('Réessayer dans 12 s');
    expect(sendButtonLabel({ sending: false, remaining: 0, hasSent: true })).toBe('Renvoyer le lien');
  });
});

describe('resolveResetRequest', () => {
  it('reports the same outcome on success and when the server says the user does not exist', () => {
    expect(resolveResetRequest(null)).toEqual({ status: 'sent' });
    expect(resolveResetRequest(undefined)).toEqual({ status: 'sent' });
    expect(resolveResetRequest({ code: 'user_not_found', status: 400, message: 'User not found' })).toEqual({
      status: 'sent',
    });
  });

  it.each([
    { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
    { status: 429, message: 'For security purposes, you can only request this after 52 seconds.' },
    { code: 'over_request_rate_limit' },
  ])('maps the rate limit %p to a clear French message', (error) => {
    expect(resolveResetRequest(error)).toEqual({
      status: 'failed',
      kind: 'rate_limited',
      message: 'Trop de demandes pour le moment. Patiente quelques minutes avant de redemander un lien.',
    });
  });

  it('maps a request that never reached the server to a network message', () => {
    expect(resolveResetRequest({ name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' })).toEqual({
      status: 'failed',
      kind: 'network',
      message: 'Connexion impossible. Vérifie ton réseau puis réessaie.',
    });
  });

  it('maps a server-side format rejection to the invalid email message', () => {
    expect(resolveResetRequest({ status: 400, code: 'validation_failed', message: 'Unable to validate email address' })).toMatchObject({
      status: 'failed',
      kind: 'invalid_email',
    });
  });

  it('falls back to a generic message without echoing the raw error', () => {
    const result = resolveResetRequest({ status: 500, code: 'unexpected_failure', message: 'Error sending recovery email to toi@email.com' });

    expect(result).toEqual({
      status: 'failed',
      kind: 'unexpected',
      message: 'L’email n’a pas pu être envoyé. Réessaie dans quelques minutes.',
    });
    expect(JSON.stringify(result)).not.toContain('toi@email.com');
  });
});

describe('describePasswordUpdateError', () => {
  it('explains a password equal to the previous one', () => {
    expect(describePasswordUpdateError({ status: 422, code: 'same_password' })).toEqual({
      kind: 'same_password',
      message: 'Choisis un mot de passe différent de l’ancien.',
    });
  });

  it('explains a password rejected by the server rules', () => {
    expect(describePasswordUpdateError({ status: 422, code: 'weak_password' }).kind).toBe('weak_password');
    expect(describePasswordUpdateError({ name: 'AuthWeakPasswordError' }).kind).toBe('weak_password');
  });

  it.each([
    { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
    { status: 401, code: 'bad_jwt' },
    { status: 403, code: 'session_not_found' },
    { code: 'session_expired' },
  ])('treats %p as an expired link', (error) => {
    expect(describePasswordUpdateError(error)).toEqual({
      kind: 'expired',
      message: 'Le lien a expiré. Demande-en un nouveau.',
    });
  });

  it('maps rate limits and network failures', () => {
    expect(describePasswordUpdateError({ status: 429 }).kind).toBe('rate_limited');
    expect(describePasswordUpdateError({ name: 'AuthRetryableFetchError', status: 0 }).kind).toBe('network');
  });

  it('falls back to a generic message', () => {
    expect(describePasswordUpdateError({ status: 500, message: 'boom' })).toEqual({
      kind: 'unexpected',
      message: 'Impossible de mettre à jour ton mot de passe. Réessaie.',
    });
  });
});

describe('viewForCallbackOutcome', () => {
  it('maps every exchange outcome to a screen state', () => {
    expect(viewForCallbackOutcome({ status: 'success' })).toBe('ready');
    expect(viewForCallbackOutcome({ status: 'failed', message: 'invalid flow state' })).toBe('invalid');
    expect(viewForCallbackOutcome({ status: 'ignored', reason: 'invalid_code' })).toBe('invalid');
    expect(viewForCallbackOutcome({ status: 'ignored', reason: 'no_verifier' })).toBe('no_verifier');
    expect(viewForCallbackOutcome({ status: 'ignored', reason: 'signed_in' })).toBe('signed_in');
  });
});
