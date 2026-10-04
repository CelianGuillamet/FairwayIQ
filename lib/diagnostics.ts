import { supabase } from './supabase';
import type { Diagnostic } from '../types';
import type { DiagnosticResult } from './claude';
import { getErrorCode } from './round-save';

type SaveDiagnosticInput = {
  userId: string;
  roundId: string;
  result: DiagnosticResult;
};

export async function saveDiagnostic({ userId, roundId, result }: SaveDiagnosticInput) {
  const { data, error } = await supabase
    .from('diagnostics')
    .upsert({
      user_id: userId,
      round_id: roundId,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      weekly_plan: result.weekly_plan,
      raw_analysis: result.raw_analysis,
      recommended_categories: result.recommended_categories ?? [],
    }, { onConflict: 'round_id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Diagnostic;
}

export const DIAGNOSTIC_SAVE_FAILED_MESSAGE =
  'Le diagnostic n’a pas pu être enregistré. Il reste consultable ici ; relance-le depuis le détail du round pour le retrouver plus tard.';

export type PersistDiagnosticOutcome = 'saved' | 'skipped' | 'failed';

// A rule-based fallback must never replace a stored AI diagnostic, hence 'skipped'.
export async function persistDiagnostic(
  input: SaveDiagnosticInput & { isFallback: boolean },
): Promise<PersistDiagnosticOutcome> {
  if (input.isFallback) {
    return 'skipped';
  }

  try {
    await saveDiagnostic({ userId: input.userId, roundId: input.roundId, result: input.result });
    return 'saved';
  } catch (error) {
    console.warn('[diagnostic] save failed', getErrorCode(error));
    return 'failed';
  }
}

export async function fetchDiagnosticByRound(roundId: string) {
  const { data, error } = await supabase
    .from('diagnostics')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Diagnostic | null;
}

export async function fetchLatestDiagnostic() {
  const { data, error } = await supabase
    .from('diagnostics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Diagnostic | null;
}
