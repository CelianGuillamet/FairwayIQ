import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry() {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.warn('[sentry] Missing EXPO_PUBLIC_SENTRY_DSN — skipping init.');
    }
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
