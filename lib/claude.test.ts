import {
  AI_COACH_TIMEOUT_MS,
  AiCoachLimitError,
  AiCoachPremiumRequiredError,
  AiCoachTimeoutError,
  analyzeRound,
  postRoundDebrief,
} from './claude';
import { supabase } from './supabase';
import type { Profile, Round } from '../types';

jest.mock('./supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;

function makeHttpError(status: number, body: unknown) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: {
      status,
      json: async () => body,
    },
  };
}

const round = { id: 'round-1', user_id: 'user-1', total_score: 90, par: 72 } as Round;
const profile = { user_id: 'user-1', handicap: 18 } as Profile;

describe('invokeAiCoach error handling', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('surfaces the French limit message from a 429 response', async () => {
    const message = 'Tu as atteint ta limite quotidienne de 3 utilisations du coach IA. Réessaie demain.';
    invoke.mockResolvedValue({ data: null, error: makeHttpError(429, { error: message }) });

    const promise = postRoundDebrief(round, profile, 'Salut', []);

    await expect(promise).rejects.toBeInstanceOf(AiCoachLimitError);
    await expect(promise).rejects.toThrow(message);
  });

  it('keeps the generic error for other failures', async () => {
    invoke.mockResolvedValue({ data: null, error: makeHttpError(500, { error: 'Boom' }) });

    const promise = postRoundDebrief(round, profile, 'Salut', []);

    await expect(promise).rejects.not.toBeInstanceOf(AiCoachLimitError);
    await expect(promise).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('falls back to the generic error when the 429 body is unreadable', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'limit', context: { status: 429, json: async () => { throw new Error('bad json'); } } },
    });

    await expect(postRoundDebrief(round, profile, 'Salut', [])).rejects.toThrow('limit');
  });

  it('surfaces the premium message from a 403 premium_required response', async () => {
    const message = 'Le débrief conversationnel est réservé aux abonnés Premium.';
    invoke.mockResolvedValue({ data: null, error: makeHttpError(403, { error: message, code: 'premium_required' }) });

    const promise = postRoundDebrief(round, profile, 'Salut', []);

    await expect(promise).rejects.toBeInstanceOf(AiCoachPremiumRequiredError);
    await expect(promise).rejects.toThrow(message);
  });

  it('uses a default message when the premium_required body has none', async () => {
    invoke.mockResolvedValue({ data: null, error: makeHttpError(403, { code: 'premium_required' }) });

    const promise = postRoundDebrief(round, profile, 'Salut', []);

    await expect(promise).rejects.toBeInstanceOf(AiCoachPremiumRequiredError);
    await expect(promise).rejects.toThrow('réservé aux abonnés Premium');
  });

  it('does not treat other 403 responses as premium required', async () => {
    invoke.mockResolvedValue({ data: null, error: makeHttpError(403, { error: 'Round ou profil non autorisé.' }) });

    const promise = postRoundDebrief(round, profile, 'Salut', []);

    await expect(promise).rejects.not.toBeInstanceOf(AiCoachPremiumRequiredError);
    await expect(promise).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('falls back to the generic error when the 403 body is unreadable', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'forbidden', context: { status: 403, json: async () => { throw new Error('bad json'); } } },
    });

    const promise = postRoundDebrief(round, profile, 'Salut', []);

    await expect(promise).rejects.not.toBeInstanceOf(AiCoachPremiumRequiredError);
    await expect(promise).rejects.toThrow('forbidden');
  });
});

describe('invokeAiCoach timeout', () => {
  beforeEach(() => {
    invoke.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects with AiCoachTimeoutError when the edge function never answers', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));

    const promise = postRoundDebrief(round, profile, 'Salut', []);
    const assertion = expect(promise).rejects.toBeInstanceOf(AiCoachTimeoutError);

    await jest.advanceTimersByTimeAsync(AI_COACH_TIMEOUT_MS);
    await assertion;
  });

  it('does not report a timeout as a daily limit or premium error', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));

    const settled = analyzeRound(round, profile, []).catch((error) => error);

    await jest.advanceTimersByTimeAsync(AI_COACH_TIMEOUT_MS);
    const error = await settled;

    expect(error).toBeInstanceOf(AiCoachTimeoutError);
    expect(error).not.toBeInstanceOf(AiCoachLimitError);
    expect(error).not.toBeInstanceOf(AiCoachPremiumRequiredError);
    expect(error.message).toContain('trop de temps');
  });

  it('passes an abort signal to the edge function call', async () => {
    invoke.mockResolvedValue({ data: { reply: 'Bien joue' }, error: null });

    await expect(postRoundDebrief(round, profile, 'Salut', [])).resolves.toBe('Bien joue');

    expect(invoke).toHaveBeenCalledWith('ai-coach', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
