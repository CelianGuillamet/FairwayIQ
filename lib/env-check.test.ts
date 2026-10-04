import { assertClientEnv, getMissingClientEnv } from './env-check';

const COMPLETE_ENV = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://example.com/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://example.com/terms',
};

describe('getMissingClientEnv', () => {
  it('returns nothing when every variable is set', () => {
    expect(getMissingClientEnv(COMPLETE_ENV)).toEqual([]);
  });

  it('lists undefined, empty and blank variables', () => {
    expect(
      getMissingClientEnv({
        ...COMPLETE_ENV,
        EXPO_PUBLIC_SUPABASE_URL: undefined,
        EXPO_PUBLIC_PRIVACY_POLICY_URL: '',
        EXPO_PUBLIC_TERMS_URL: '   ',
      }),
    ).toEqual(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_PRIVACY_POLICY_URL', 'EXPO_PUBLIC_TERMS_URL']);
  });
});

describe('assertClientEnv', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not throw when everything is set', () => {
    expect(() => assertClientEnv(COMPLETE_ENV)).not.toThrow();
  });

  it('throws a clear message in development', () => {
    expect(() => assertClientEnv({ ...COMPLETE_ENV, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined })).toThrow(
      /EXPO_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it('only logs outside development', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const globals = globalThis as { __DEV__?: boolean };
    const previous = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      expect(() => assertClientEnv({ ...COMPLETE_ENV, EXPO_PUBLIC_TERMS_URL: '' })).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('EXPO_PUBLIC_TERMS_URL'));
    } finally {
      globals.__DEV__ = previous;
    }
  });
});
