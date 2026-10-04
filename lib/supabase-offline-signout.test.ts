import { createClient } from '@supabase/supabase-js';

const SESSION = {
  access_token: 'header.payload.signature',
  refresh_token: 'refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
};

function createOfflineClient() {
  const store = new Map<string, string>([['sb-test-auth-token', JSON.stringify(SESSION)]]);
  const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
  const client = createClient('https://test.supabase.co', 'anon-key', {
    auth: {
      storage: {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => void store.set(key, value),
        removeItem: async (key: string) => void store.delete(key),
      },
      storageKey: 'sb-test-auth-token',
      autoRefreshToken: false,
    },
    global: { fetch: fetchMock },
  });
  return { client, store, fetchMock };
}

describe('supabase-js sign-out while offline', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the stored session after a global sign-out', async () => {
    const { client, store } = createOfflineClient();

    const { error } = await client.auth.signOut();

    expect(error).not.toBeNull();
    expect(store.has('sb-test-auth-token')).toBe(true);
  });

  it('keeps the stored session after a local sign-out too', async () => {
    const { client, store } = createOfflineClient();

    const { error } = await client.auth.signOut({ scope: 'local' });

    expect(error).not.toBeNull();
    expect(store.has('sb-test-auth-token')).toBe(true);
  });

  it('reads no session once the stored keys are removed directly', async () => {
    const { client, store } = createOfflineClient();

    store.delete('sb-test-auth-token');
    const { data } = await client.auth.getSession();

    expect(data.session).toBeNull();
  });
});
