import { DIAGNOSTIC_SAVE_FAILED_MESSAGE, persistDiagnostic } from './diagnostics';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: { from: jest.fn() },
}));

const from = supabase.from as jest.Mock;

const result = {
  strengths: ['Putting'],
  weaknesses: ['Driving'],
  weekly_plan: 'Plan',
  raw_analysis: 'Analyse',
  recommended_categories: ['driving'],
};

function mockUpsertResponse(response: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(response);
  const select = jest.fn().mockReturnValue({ single });
  const upsert = jest.fn().mockReturnValue({ select });
  from.mockReturnValue({ upsert });
  return upsert;
}

describe('persistDiagnostic', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    from.mockReset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('never persists a fallback diagnostic', async () => {
    const outcome = await persistDiagnostic({ userId: 'user-1', roundId: 'round-1', result, isFallback: true });

    expect(outcome).toBe('skipped');
    expect(from).not.toHaveBeenCalled();
  });

  it('upserts an AI diagnostic on round_id', async () => {
    const upsert = mockUpsertResponse({ data: { id: 'diag-1' }, error: null });

    const outcome = await persistDiagnostic({ userId: 'user-1', roundId: 'round-1', result, isFallback: false });

    expect(outcome).toBe('saved');
    expect(from).toHaveBeenCalledWith('diagnostics');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', round_id: 'round-1', weekly_plan: 'Plan' }),
      { onConflict: 'round_id' },
    );
  });

  it('reports a failure instead of swallowing it, logging only the error code', async () => {
    mockUpsertResponse({
      data: null,
      error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' },
    });

    const outcome = await persistDiagnostic({ userId: 'user-1', roundId: 'round-1', result, isFallback: false });

    expect(outcome).toBe('failed');
    expect(warn).toHaveBeenCalledWith('[diagnostic] save failed', '42P10');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('ON CONFLICT');
    expect(DIAGNOSTIC_SAVE_FAILED_MESSAGE).toContain('n’a pas pu être enregistré');
  });

  it('reports a failure when the request itself throws', async () => {
    from.mockImplementation(() => {
      throw new TypeError('Network request failed');
    });

    const outcome = await persistDiagnostic({ userId: 'user-1', roundId: 'round-1', result, isFallback: false });

    expect(outcome).toBe('failed');
    expect(warn).toHaveBeenCalledWith('[diagnostic] save failed', 'TypeError');
  });
});
