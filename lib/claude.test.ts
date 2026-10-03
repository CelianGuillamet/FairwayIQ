import { AiCoachLimitError, postRoundDebrief } from './claude';
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
});
