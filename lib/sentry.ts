import * as Sentry from '@sentry/react-native';
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import { redactUrlForLogging } from './redact-url';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

const BREADCRUMB_URL_KEYS = ['url', 'to', 'from'];

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = redactUrlForLogging(breadcrumb.message);
  }
  const data = breadcrumb.data;
  if (data) {
    for (const key of BREADCRUMB_URL_KEYS) {
      if (typeof data[key] === 'string') {
        data[key] = redactUrlForLogging(data[key]);
      }
    }
  }
  return breadcrumb;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (typeof event.message === 'string') {
    event.message = redactUrlForLogging(event.message);
  }
  if (event.request) {
    if (typeof event.request.url === 'string') {
      event.request.url = redactUrlForLogging(event.request.url);
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = redactUrlForLogging(`?${event.request.query_string}`).slice(1);
    }
  }
  event.exception?.values?.forEach((exception) => {
    if (typeof exception.value === 'string') {
      exception.value = redactUrlForLogging(exception.value);
    }
  });
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  return event;
}

export function initSentry() {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.warn('[sentry] Missing EXPO_PUBLIC_SENTRY_DSN — skipping init.');
    }
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

export { Sentry };
