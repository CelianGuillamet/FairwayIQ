import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

type SentryMock = { init: jest.Mock };

function loadSentry(dsn: string) {
  jest.resetModules();
  process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  return {
    Sentry: require('@sentry/react-native') as SentryMock,
    sentry: require('./sentry') as typeof import('./sentry'),
  };
}

function setDev(value: boolean) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = value;
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  setDev(true);
  jest.restoreAllMocks();
});

describe('initSentry', () => {
  it('skips init without a DSN', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { Sentry, sentry } = loadSentry('');
    sentry.initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('samples 10% of traces and disables default PII in production', () => {
    setDev(false);
    const { Sentry, sentry } = loadSentry('https://public@example.ingest.sentry.io/1');
    sentry.initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
        beforeSend: sentry.scrubEvent,
        beforeBreadcrumb: sentry.scrubBreadcrumb,
      }),
    );
  });

  it('samples every trace in development', () => {
    setDev(true);
    const { Sentry, sentry } = loadSentry('https://public@example.ingest.sentry.io/1');
    sentry.initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 1.0 }));
  });
});

describe('scrubBreadcrumb', () => {
  it('redacts sensitive params in breadcrumb urls and messages', () => {
    const { sentry } = loadSentry('');
    const breadcrumb: Breadcrumb = {
      category: 'xhr',
      message: 'GET https://example.com/cb?code=abc&type=signup',
      data: {
        url: 'https://example.com/auth/v1/verify?token_hash=th_1&type=recovery',
        to: 'fairwayiq://auth-callback#access_token=a&expires_in=3600',
        status_code: 200,
      },
    };
    expect(sentry.scrubBreadcrumb(breadcrumb)).toEqual({
      category: 'xhr',
      message: 'GET https://example.com/cb?code=[redacted]&type=signup',
      data: {
        url: 'https://example.com/auth/v1/verify?token_hash=[redacted]&type=recovery',
        to: 'fairwayiq://auth-callback#access_token=[redacted]&expires_in=3600',
        status_code: 200,
      },
    });
  });

  it('leaves breadcrumbs without data untouched', () => {
    const { sentry } = loadSentry('');
    expect(sentry.scrubBreadcrumb({ message: 'tapped' })).toEqual({ message: 'tapped' });
  });
});

describe('scrubEvent', () => {
  it('redacts request urls, query strings, exception values and breadcrumbs', () => {
    const { sentry } = loadSentry('');
    const event = {
      type: undefined,
      request: {
        url: 'https://example.com/cb?secret=s1&page=2',
        query_string: 'refresh_token=r1&page=2',
      },
      exception: { values: [{ value: 'failed: https://example.com/x?token=t1' }] },
      breadcrumbs: [{ data: { url: 'https://example.com/y?code=c1' } }],
    } as ErrorEvent;

    const scrubbed = sentry.scrubEvent(event);

    expect(scrubbed.request).toEqual({
      url: 'https://example.com/cb?secret=[redacted]&page=2',
      query_string: 'refresh_token=[redacted]&page=2',
    });
    expect(scrubbed.exception?.values?.[0].value).toBe('failed: https://example.com/x?token=[redacted]');
    expect(scrubbed.breadcrumbs?.[0].data?.url).toBe('https://example.com/y?code=[redacted]');
  });
});
