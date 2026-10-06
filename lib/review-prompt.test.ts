import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import {
  REVIEW_MAX_ASKS,
  REVIEW_MIN_INTERVAL_MS,
  REVIEW_MIN_ROUNDS,
  REVIEW_PAYWALL_QUIET_MS,
  REVIEW_STORAGE_KEY,
  getReviewSession,
  isConfirmationAlert,
  loadReviewHistory,
  noteErrorAlert,
  notePaywallViewed,
  parseReviewHistory,
  requestReviewAfterRound,
  resetReviewSession,
  shouldAskForReview,
  type ReviewDecisionInput,
  type ReviewRequestOptions,
} from './review-prompt';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);

const originalAppState = AppState.currentState;

function setAppState(state: string) {
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: state });
}

const isAvailable = StoreReview.isAvailableAsync as jest.Mock;
const requestReview = StoreReview.requestReview as jest.Mock;

const ELIGIBLE: ReviewDecisionInput = {
  now: NOW,
  history: { askCount: 0, lastAskedAt: null },
  saveOutcome: 'online',
  savedRoundCount: REVIEW_MIN_ROUNDS,
  errorAlertShown: false,
  askedThisSession: false,
  paywallViewedAt: null,
  celebrationPending: false,
};

const decide = (overrides: Partial<ReviewDecisionInput>) => shouldAskForReview({ ...ELIGIBLE, ...overrides });

describe('shouldAskForReview', () => {
  it('asks after a positive moment on a fresh install', () => {
    expect(decide({})).toBe(true);
  });

  it('never asks without a readable history', () => {
    expect(decide({ history: null })).toBe(false);
  });

  it.each(['queued', 'failed'] as const)('never asks after a save that ended %s', (saveOutcome) => {
    expect(decide({ saveOutcome })).toBe(false);
  });

  it('needs at least 3 saved rounds', () => {
    expect(decide({ savedRoundCount: 0 })).toBe(false);
    expect(decide({ savedRoundCount: REVIEW_MIN_ROUNDS - 1 })).toBe(false);
    expect(decide({ savedRoundCount: REVIEW_MIN_ROUNDS })).toBe(true);
    expect(decide({ savedRoundCount: 40 })).toBe(true);
  });

  it('stays quiet once an error alert was shown in the session', () => {
    expect(decide({ errorAlertShown: true })).toBe(false);
  });

  it('asks at most once per session', () => {
    expect(decide({ askedThisSession: true })).toBe(false);
  });

  it('skips when a trophy celebration is queued', () => {
    expect(decide({ celebrationPending: true })).toBe(false);
  });

  describe('lifetime limit', () => {
    it('allows the last permitted ask and blocks any further one', () => {
      const lastAskedAt = NOW - 200 * DAY_MS;

      expect(decide({ history: { askCount: REVIEW_MAX_ASKS - 1, lastAskedAt } })).toBe(true);
      expect(decide({ history: { askCount: REVIEW_MAX_ASKS, lastAskedAt } })).toBe(false);
      expect(decide({ history: { askCount: REVIEW_MAX_ASKS + 5, lastAskedAt } })).toBe(false);
    });
  });

  describe('120 day interval', () => {
    const askedAgo = (ms: number) => ({ askCount: 1, lastAskedAt: NOW - ms });

    it('blocks before 120 days and allows from exactly 120 days', () => {
      expect(decide({ history: askedAgo(0) })).toBe(false);
      expect(decide({ history: askedAgo(REVIEW_MIN_INTERVAL_MS - 1) })).toBe(false);
      expect(decide({ history: askedAgo(REVIEW_MIN_INTERVAL_MS) })).toBe(true);
      expect(decide({ history: askedAgo(REVIEW_MIN_INTERVAL_MS + 1) })).toBe(true);
    });

    it('uses a 120 day interval', () => {
      expect(REVIEW_MIN_INTERVAL_MS).toBe(120 * DAY_MS);
    });
  });

  describe('after a paywall view', () => {
    it('blocks right after, and allows from exactly the quiet period', () => {
      expect(decide({ paywallViewedAt: NOW })).toBe(false);
      expect(decide({ paywallViewedAt: NOW - 60_000 })).toBe(false);
      expect(decide({ paywallViewedAt: NOW - REVIEW_PAYWALL_QUIET_MS + 1 })).toBe(false);
      expect(decide({ paywallViewedAt: NOW - REVIEW_PAYWALL_QUIET_MS })).toBe(true);
    });

    it('does not block when the paywall was never opened', () => {
      expect(decide({ paywallViewedAt: null })).toBe(true);
    });
  });
});

describe('parseReviewHistory', () => {
  it('reads a missing record as never asked', () => {
    expect(parseReviewHistory(null, NOW)).toEqual({ askCount: 0, lastAskedAt: null });
  });

  it('round-trips a valid record and ignores extra fields', () => {
    const record = { askCount: 2, lastAskedAt: NOW - 3 * DAY_MS };

    expect(parseReviewHistory(JSON.stringify(record), NOW)).toEqual(record);
    expect(parseReviewHistory(JSON.stringify({ ...record, extra: true }), NOW)).toEqual(record);
    expect(parseReviewHistory(JSON.stringify({ askCount: 0, lastAskedAt: null }), NOW)).toEqual({
      askCount: 0,
      lastAskedAt: null,
    });
    expect(parseReviewHistory(JSON.stringify({ askCount: 1, lastAskedAt: NOW }), NOW)).toEqual({
      askCount: 1,
      lastAskedAt: NOW,
    });
  });

  it.each([
    ['broken JSON', '{broken'],
    ['empty string', ''],
    ['null literal', 'null'],
    ['a string', '"2026-10-06"'],
    ['a number', '3'],
    ['an array', '[1, 2]'],
    ['an empty object', '{}'],
    ['a string count', JSON.stringify({ askCount: '1', lastAskedAt: NOW - DAY_MS })],
    ['a fractional count', JSON.stringify({ askCount: 1.5, lastAskedAt: NOW - DAY_MS })],
    ['a negative count', JSON.stringify({ askCount: -1, lastAskedAt: NOW - DAY_MS })],
    ['a null count', JSON.stringify({ askCount: null, lastAskedAt: null })],
    ['a count without a date', JSON.stringify({ askCount: 2, lastAskedAt: null })],
    ['a missing date', JSON.stringify({ askCount: 0 })],
    ['a string date', JSON.stringify({ askCount: 1, lastAskedAt: '2026-10-01' })],
    ['a negative date', JSON.stringify({ askCount: 1, lastAskedAt: -5 })],
    ['a date in the future', JSON.stringify({ askCount: 1, lastAskedAt: NOW + 1 })],
  ])('cannot trust %s', (_label, raw) => {
    expect(parseReviewHistory(raw, NOW)).toBeNull();
  });
});

describe('loadReviewHistory', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('starts empty on a fresh install', async () => {
    await expect(loadReviewHistory(NOW)).resolves.toEqual({ askCount: 0, lastAskedAt: null });
  });

  it('reads the stored record', async () => {
    const record = { askCount: 1, lastAskedAt: NOW - 10 * DAY_MS };
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(record));

    await expect(loadReviewHistory(NOW)).resolves.toEqual(record);
  });

  it('restarts the quiet period, and stores it, when the record is corrupted', async () => {
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, '{broken');

    await expect(loadReviewHistory(NOW)).resolves.toEqual({ askCount: 0, lastAskedAt: NOW });
    expect(JSON.parse((await AsyncStorage.getItem(REVIEW_STORAGE_KEY)) ?? '')).toEqual({
      askCount: 0,
      lastAskedAt: NOW,
    });
    expect(
      shouldAskForReview({ ...ELIGIBLE, history: await loadReviewHistory(NOW + 119 * DAY_MS) }),
    ).toBe(false);
    expect(
      shouldAskForReview({
        ...ELIGIBLE,
        now: NOW + 120 * DAY_MS,
        history: await loadReviewHistory(NOW + 120 * DAY_MS),
      }),
    ).toBe(true);
  });

  it('restarts the quiet period when the stored date is in the future', async () => {
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ askCount: 1, lastAskedAt: NOW + 400 * DAY_MS }));

    await expect(loadReviewHistory(NOW)).resolves.toEqual({ askCount: 0, lastAskedAt: NOW });
  });

  it('reports an unreadable store as unavailable', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(loadReviewHistory(NOW)).resolves.toBeNull();
  });
});

describe('alert classification', () => {
  it('treats a dialog with a cancel button as a confirmation', () => {
    expect(isConfirmationAlert([{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive' }])).toBe(
      true,
    );
  });

  it('treats every other alert as something to report', () => {
    expect(isConfirmationAlert(undefined)).toBe(false);
    expect(isConfirmationAlert([{ text: 'OK' }])).toBe(false);
    expect(isConfirmationAlert([{ text: 'Réessayer' }, { text: 'Fermer', style: 'default' }])).toBe(false);
  });

  it('flags the session only for non-confirmation alerts, and wraps the alert once', () => {
    jest.isolateModules(() => {
      const { Alert } = require('react-native');
      const original = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const prompt = require('./review-prompt') as typeof import('./review-prompt');

      prompt.trackAlertsForReview();
      prompt.trackAlertsForReview();

      Alert.alert('Déconnexion', 'Sûr ?', [{ text: 'Annuler', style: 'cancel' }, { text: 'Oui' }]);
      expect(prompt.getReviewSession().errorAlertShown).toBe(false);

      Alert.alert('Erreur', 'Impossible d’enregistrer.');
      expect(prompt.getReviewSession().errorAlertShown).toBe(true);

      expect(original).toHaveBeenCalledTimes(2);
      expect(original).toHaveBeenLastCalledWith('Erreur', 'Impossible d’enregistrer.', undefined, undefined);
    });
  });
});

describe('requestReviewAfterRound', () => {
  const options = (overrides: Partial<ReviewRequestOptions> = {}): ReviewRequestOptions => ({
    saveOutcome: 'online',
    getSavedRoundCount: () => 5,
    isCelebrationPending: () => false,
    delayMs: 0,
    ...overrides,
  });

  const storedHistory = async () => JSON.parse((await AsyncStorage.getItem(REVIEW_STORAGE_KEY)) ?? 'null');

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    setAppState('active');
    resetReviewSession();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    isAvailable.mockReset().mockResolvedValue(true);
    requestReview.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    setAppState(originalAppState);
  });

  it('records the ask and requests the review', async () => {
    await expect(requestReviewAfterRound(options())).resolves.toBe(true);

    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(await storedHistory()).toEqual({ askCount: 1, lastAskedAt: NOW });
    expect(getReviewSession().askedThisSession).toBe(true);
    expect(getReviewSession().inFlight).toBe(false);
  });

  it('checks availability first and does nothing more when the store cannot review', async () => {
    isAvailable.mockResolvedValue(false);
    const getItem = jest.spyOn(AsyncStorage, 'getItem');

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    expect(getItem).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
    expect(await storedHistory()).toBeNull();
  });

  it('calls the availability check before the review request', async () => {
    await requestReviewAfterRound(options());

    expect(isAvailable.mock.invocationCallOrder[0]).toBeLessThan(requestReview.mock.invocationCallOrder[0]);
  });

  it('waits about two seconds so a trophy sheet can come first', async () => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    const result = requestReviewAfterRound(options({ delayMs: undefined }));

    await jest.advanceTimersByTimeAsync(1900);
    expect(requestReview).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toBe(true);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('skips when a celebration is already queued', async () => {
    await expect(requestReviewAfterRound(options({ isCelebrationPending: () => true }))).resolves.toBe(false);

    expect(requestReview).not.toHaveBeenCalled();
    expect(await storedHistory()).toBeNull();
  });

  it('skips when a celebration is queued during the delay', async () => {
    const pending = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);

    await expect(requestReviewAfterRound(options({ isCelebrationPending: pending }))).resolves.toBe(false);

    expect(requestReview).not.toHaveBeenCalled();
  });

  it.each(['queued', 'failed'] as const)('never asks after a save that ended %s', async (saveOutcome) => {
    await expect(requestReviewAfterRound(options({ saveOutcome }))).resolves.toBe(false);

    expect(requestReview).not.toHaveBeenCalled();
  });

  it('never asks below 3 saved rounds', async () => {
    await expect(requestReviewAfterRound(options({ getSavedRoundCount: () => 2 }))).resolves.toBe(false);
    await expect(requestReviewAfterRound(options({ getSavedRoundCount: () => 3 }))).resolves.toBe(true);
  });

  it('never asks after an error alert in the session', async () => {
    noteErrorAlert();

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('never asks right after a paywall view', async () => {
    notePaywallViewed(NOW - 60_000);

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('asks again once the paywall view is old enough', async () => {
    notePaywallViewed(NOW - REVIEW_PAYWALL_QUIET_MS);

    await expect(requestReviewAfterRound(options())).resolves.toBe(true);
  });

  it('asks at most once per session', async () => {
    await expect(requestReviewAfterRound(options())).resolves.toBe(true);
    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('ignores a second call while the first is still waiting', async () => {
    const [first, second] = await Promise.all([
      requestReviewAfterRound(options()),
      requestReviewAfterRound(options()),
    ]);

    expect([first, second].sort()).toEqual([false, true]);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('keeps the 120 day interval across sessions', async () => {
    await AsyncStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ askCount: 1, lastAskedAt: NOW - REVIEW_MIN_INTERVAL_MS + 1 }),
    );
    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    await AsyncStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ askCount: 1, lastAskedAt: NOW - REVIEW_MIN_INTERVAL_MS }),
    );
    await expect(requestReviewAfterRound(options())).resolves.toBe(true);
    expect(await storedHistory()).toEqual({ askCount: 2, lastAskedAt: NOW });
  });

  it('stops after 3 asks in total', async () => {
    await AsyncStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ askCount: REVIEW_MAX_ASKS - 1, lastAskedAt: NOW - 300 * DAY_MS }),
    );
    await expect(requestReviewAfterRound(options())).resolves.toBe(true);
    expect(await storedHistory()).toEqual({ askCount: REVIEW_MAX_ASKS, lastAskedAt: NOW });

    resetReviewSession();
    jest.spyOn(Date, 'now').mockReturnValue(NOW + 1000 * DAY_MS);
    await expect(requestReviewAfterRound(options())).resolves.toBe(false);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('does not ask on a corrupted record and restarts the quiet period', async () => {
    await AsyncStorage.setItem(REVIEW_STORAGE_KEY, '{broken');

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    expect(requestReview).not.toHaveBeenCalled();
    expect(await storedHistory()).toEqual({ askCount: 0, lastAskedAt: NOW });
  });

  it('does not ask when the history cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('does not ask when the ask cannot be recorded', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    expect(requestReview).not.toHaveBeenCalled();
    expect(getReviewSession().askedThisSession).toBe(false);
  });

  it('does not spend an ask when the app is no longer active', async () => {
    setAppState('background');

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    expect(requestReview).not.toHaveBeenCalled();
    expect(await storedHistory()).toBeNull();
  });

  it('swallows an availability check that rejects', async () => {
    isAvailable.mockRejectedValue(new Error('native module missing'));

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);
    expect(getReviewSession().inFlight).toBe(false);
  });

  it('swallows a review request that throws, after the ask was recorded', async () => {
    requestReview.mockRejectedValue(new Error('play services missing'));

    await expect(requestReviewAfterRound(options())).resolves.toBe(false);

    expect(await storedHistory()).toEqual({ askCount: 1, lastAskedAt: NOW });
    expect(getReviewSession().inFlight).toBe(false);
  });

  it('swallows a throwing celebration check', async () => {
    const isCelebrationPending = () => {
      throw new Error('store broken');
    };

    await expect(requestReviewAfterRound(options({ isCelebrationPending }))).resolves.toBe(false);
    expect(requestReview).not.toHaveBeenCalled();
  });
});
