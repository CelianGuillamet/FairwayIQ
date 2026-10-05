import { completeAuthCallback, readAuthCode, shouldResumePasswordRecovery } from './auth-link';

const CODE = '3f1c1c0e-9a0b-4f6e-8a56-0b6a2f2f7d11';

function createDeps(overrides: Partial<Parameters<typeof completeAuthCallback>[1]> = {}) {
  return {
    hasSession: jest.fn(() => false),
    hasCodeVerifier: jest.fn(async () => true),
    exchange: jest.fn(async (_code: string) => ({ error: null as { message: string } | null })),
    ...overrides,
  };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('readAuthCode', () => {
  it('accepts a PKCE auth code', () => {
    expect(readAuthCode(CODE)).toBe(CODE);
  });

  it('takes the first value when the param is repeated', () => {
    expect(readAuthCode([CODE, 'other'])).toBe(CODE);
  });

  it.each([undefined, '', 'short', 'has spaces in it', 'a'.repeat(513), '<script>alert(1)</script>'])(
    'rejects %p',
    (value) => {
      expect(readAuthCode(value as string | undefined)).toBeNull();
    }
  );
});

describe('completeAuthCallback', () => {
  it('exchanges the code when this device started the flow and nobody is signed in', async () => {
    const deps = createDeps();

    await expect(completeAuthCallback(CODE, deps)).resolves.toEqual({ status: 'success' });

    expect(deps.exchange).toHaveBeenCalledWith(CODE);
  });

  it('ignores a link without a usable code', async () => {
    const deps = createDeps();

    await expect(completeAuthCallback(undefined, deps)).resolves.toEqual({
      status: 'ignored',
      reason: 'invalid_code',
    });

    expect(deps.exchange).not.toHaveBeenCalled();
  });

  it('ignores the link while a user is already signed in', async () => {
    const deps = createDeps({ hasSession: jest.fn(() => true) });

    await expect(completeAuthCallback(CODE, deps)).resolves.toEqual({
      status: 'ignored',
      reason: 'signed_in',
    });

    expect(deps.exchange).not.toHaveBeenCalled();
  });

  it('ignores the link when there is no PKCE verifier on this device', async () => {
    const deps = createDeps({ hasCodeVerifier: jest.fn(async () => false) });

    await expect(completeAuthCallback(CODE, deps)).resolves.toEqual({
      status: 'ignored',
      reason: 'no_verifier',
    });

    expect(deps.exchange).not.toHaveBeenCalled();
  });

  it('reports a failed exchange without leaking it as an exception', async () => {
    const deps = createDeps({
      exchange: jest.fn(async () => ({ error: { message: 'invalid flow state' } })),
    });

    await expect(completeAuthCallback(CODE, deps)).resolves.toEqual({
      status: 'failed',
      message: 'invalid flow state',
    });
  });

  it('turns a thrown error into a failure and redacts tokens in its message', async () => {
    const deps = createDeps({
      exchange: jest.fn(async () => {
        throw new Error('bad url fairwayiq://auth-callback?code=secret-code-value&state=1');
      }),
    });

    const outcome = await completeAuthCallback(CODE, deps);

    expect(outcome).toEqual({
      status: 'failed',
      message: 'bad url fairwayiq://auth-callback?code=[redacted]&state=1',
    });
    expect(JSON.stringify((console.warn as jest.Mock).mock.calls)).not.toContain('secret-code-value');
  });

  it('rejects a value that smuggles extra query parameters into the code', async () => {
    const deps = createDeps();

    await completeAuthCallback('fake.access_token&refresh_token=x', deps);

    expect(deps.exchange).not.toHaveBeenCalled();
  });
});

describe('shouldResumePasswordRecovery', () => {
  function createRecoveryDeps(overrides: Partial<Parameters<typeof shouldResumePasswordRecovery>[0]> = {}) {
    return {
      code: CODE as string | null,
      hasSession: jest.fn(() => false),
      hasPendingRecovery: jest.fn(async () => true),
      ...overrides,
    };
  }

  it('resumes the reset when a recovery is pending and nobody is signed in', async () => {
    await expect(shouldResumePasswordRecovery(createRecoveryDeps())).resolves.toBe(true);
  });

  it('does not resume it when no recovery is pending', async () => {
    await expect(shouldResumePasswordRecovery(createRecoveryDeps({ hasPendingRecovery: jest.fn(async () => false) }))).resolves.toBe(false);
  });

  it('does not read the storage without a usable code or with a session already active', async () => {
    const withoutCode = createRecoveryDeps({ code: null });
    const signedIn = createRecoveryDeps({ hasSession: jest.fn(() => true) });

    await expect(shouldResumePasswordRecovery(withoutCode)).resolves.toBe(false);
    await expect(shouldResumePasswordRecovery(signedIn)).resolves.toBe(false);

    expect(withoutCode.hasPendingRecovery).not.toHaveBeenCalled();
    expect(signedIn.hasPendingRecovery).not.toHaveBeenCalled();
  });

  it('falls through to the normal exchange when the storage read rejects, instead of hanging', async () => {
    const deps = createRecoveryDeps({ hasPendingRecovery: jest.fn(async () => Promise.reject(new Error('SecureStore unavailable'))) });

    await expect(shouldResumePasswordRecovery(deps)).resolves.toBe(false);

    expect(console.warn).toHaveBeenCalledWith('[auth] pending recovery check failed', { message: 'SecureStore unavailable' });
  });

  it('lets the callback complete normally after a failed storage read', async () => {
    const recovery = createRecoveryDeps({ hasPendingRecovery: jest.fn(async () => Promise.reject(new Error('boom'))) });
    const deps = createDeps();

    const resume = await shouldResumePasswordRecovery(recovery);
    const outcome = await completeAuthCallback(CODE, deps);

    expect(resume).toBe(false);
    expect(outcome).toEqual({ status: 'success' });
    expect(deps.exchange).toHaveBeenCalledWith(CODE);
  });
});
