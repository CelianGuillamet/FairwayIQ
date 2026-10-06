import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const DAY_MS = 24 * 60 * 60 * 1000;

export const REVIEW_STORAGE_KEY = 'fairwayiq:review-prompt:v1';
export const REVIEW_MIN_INTERVAL_MS = 120 * DAY_MS;
export const REVIEW_MAX_ASKS = 3;
export const REVIEW_MIN_ROUNDS = 3;
export const REVIEW_DELAY_MS = 2000;
export const REVIEW_PAYWALL_QUIET_MS = 30 * 60 * 1000;

export type ReviewHistory = {
  askCount: number;
  lastAskedAt: number | null;
};

export type SaveOutcome = 'online' | 'queued' | 'failed';

export type ReviewDecisionInput = {
  now: number;
  history: ReviewHistory | null;
  saveOutcome: SaveOutcome;
  savedRoundCount: number;
  errorAlertShown: boolean;
  askedThisSession: boolean;
  paywallViewedAt: number | null;
  celebrationPending: boolean;
};

export function shouldAskForReview(input: ReviewDecisionInput): boolean {
  const { now, history } = input;

  if (!history) return false;
  if (input.saveOutcome !== 'online') return false;
  if (input.savedRoundCount < REVIEW_MIN_ROUNDS) return false;
  if (input.errorAlertShown || input.askedThisSession || input.celebrationPending) return false;
  if (history.askCount >= REVIEW_MAX_ASKS) return false;
  if (history.lastAskedAt !== null && now - history.lastAskedAt < REVIEW_MIN_INTERVAL_MS) return false;
  if (input.paywallViewedAt !== null && now - input.paywallViewedAt < REVIEW_PAYWALL_QUIET_MS) return false;

  return true;
}

// A record that cannot be trusted is never read as "never asked": the caller restarts the quiet period instead.
export function parseReviewHistory(raw: string | null, now: number): ReviewHistory | null {
  if (raw === null) return { askCount: 0, lastAskedAt: null };

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;

  const { askCount, lastAskedAt } = value as Record<string, unknown>;

  if (typeof askCount !== 'number' || !Number.isInteger(askCount) || askCount < 0) return null;
  if (lastAskedAt === null) return askCount === 0 ? { askCount, lastAskedAt: null } : null;
  if (typeof lastAskedAt !== 'number' || !Number.isFinite(lastAskedAt) || lastAskedAt < 0 || lastAskedAt > now) {
    return null;
  }

  return { askCount, lastAskedAt };
}

async function saveReviewHistory(history: ReviewHistory) {
  try {
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

// Returns null when storage cannot be read: without a trustworthy record nothing is asked.
export async function loadReviewHistory(now: number): Promise<ReviewHistory | null> {
  let raw: string | null;

  try {
    raw = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
  } catch {
    return null;
  }

  const parsed = parseReviewHistory(raw, now);
  if (parsed) return parsed;

  const restarted: ReviewHistory = { askCount: 0, lastAskedAt: now };
  await saveReviewHistory(restarted);
  return restarted;
}

type ReviewSession = {
  askedThisSession: boolean;
  errorAlertShown: boolean;
  paywallViewedAt: number | null;
  inFlight: boolean;
};

const createSession = (): ReviewSession => ({
  askedThisSession: false,
  errorAlertShown: false,
  paywallViewedAt: null,
  inFlight: false,
});

let session = createSession();

export function getReviewSession(): Readonly<ReviewSession> {
  return { ...session };
}

export function resetReviewSession() {
  session = createSession();
}

export function noteErrorAlert() {
  session.errorAlertShown = true;
}

export function notePaywallViewed(now: number = Date.now()) {
  session.paywallViewedAt = now;
}

type AlertButtons = Parameters<typeof Alert.alert>[2];

// A dialog with a cancel button asks a question; any other alert reports something that went wrong or needs attention.
export function isConfirmationAlert(buttons: AlertButtons) {
  return Array.isArray(buttons) && buttons.some((button) => button.style === 'cancel');
}

let alertTrackingInstalled = false;

export function trackAlertsForReview() {
  if (alertTrackingInstalled) return;
  alertTrackingInstalled = true;

  const original = Alert.alert.bind(Alert);

  Alert.alert = (title, message, buttons, options) => {
    if (!isConfirmationAlert(buttons)) noteErrorAlert();
    original(title, message, buttons, options);
  };
}

export type ReviewRequestOptions = {
  saveOutcome: SaveOutcome;
  getSavedRoundCount: () => number;
  isCelebrationPending: () => boolean;
  delayMs?: number;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// The ask is recorded before the system prompt is requested: a crash in between must not let it repeat.
export async function requestReviewAfterRound(options: ReviewRequestOptions): Promise<boolean> {
  if (session.inFlight || session.askedThisSession) return false;
  session.inFlight = true;

  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
    if (options.isCelebrationPending()) return false;

    await wait(options.delayMs ?? REVIEW_DELAY_MS);

    const now = Date.now();
    const history = await loadReviewHistory(now);

    const allowed = shouldAskForReview({
      now,
      history,
      saveOutcome: options.saveOutcome,
      savedRoundCount: options.getSavedRoundCount(),
      errorAlertShown: session.errorAlertShown,
      askedThisSession: session.askedThisSession,
      paywallViewedAt: session.paywallViewedAt,
      celebrationPending: options.isCelebrationPending(),
    });

    if (!allowed || !history || AppState.currentState !== 'active') return false;
    if (!(await saveReviewHistory({ askCount: history.askCount + 1, lastAskedAt: now }))) return false;

    session.askedThisSession = true;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  } finally {
    session.inFlight = false;
  }
}
