const mockCreateClient = jest.fn(() => ({}));

jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockCreateClient(...(args as [])) }));
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('./secure-session-storage', () => ({
  authStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_TERMS_URL',
] as const;

const saved: Record<string, string | undefined> = {};

function loadSupabaseModule() {
  jest.isolateModules(() => {
    require('./supabase');
  });
}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  mockCreateClient.mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('lib/supabase client env check', () => {
  it('creates the client when the client env is complete', () => {
    loadSupabaseModule();

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('lists every missing variable before creating the client', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_TERMS_URL = '';

    expect(loadSupabaseModule).toThrow(/EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_TERMS_URL/);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
