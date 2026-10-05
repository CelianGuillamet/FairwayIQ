import { isSameWeek } from 'date-fns';

export type DrillResult = {
  made: number;
  attempts: number;
};

export type CompletionWithResult = {
  drill_id: string;
  completed_at: string;
  result_made?: number | null;
  result_attempts?: number | null;
};

export type ResultTarget = {
  attempts: number;
  success_threshold: number;
};

export const DEFAULT_RESULT_ATTEMPTS = 10;
export const MAX_RESULT_ATTEMPTS = 100;

export function parseResult(made: unknown, attempts: unknown): DrillResult | null {
  if (typeof made !== 'number' || typeof attempts !== 'number') return null;
  if (!Number.isInteger(made) || !Number.isInteger(attempts)) return null;
  if (attempts < 1 || attempts > MAX_RESULT_ATTEMPTS) return null;
  if (made < 0 || made > attempts) return null;

  return { made, attempts };
}

export function formatResult(result: DrillResult) {
  return `${result.made}/${result.attempts}`;
}

export function formatSuccessRate(rate: number) {
  return `${Math.round(rate * 100)} %`;
}

export function getDefaultAttempts(drillAttempts: number | null | undefined) {
  return parseResult(0, drillAttempts)?.attempts ?? DEFAULT_RESULT_ATTEMPTS;
}

export function withAttempts(result: DrillResult, attempts: number): DrillResult {
  const next = Math.min(MAX_RESULT_ATTEMPTS, Math.max(1, Math.trunc(attempts)));

  return { attempts: next, made: Math.min(result.made, next) };
}

export function withMade(result: DrillResult, made: number): DrillResult {
  return { attempts: result.attempts, made: Math.min(result.attempts, Math.max(0, Math.trunc(made))) };
}

export function getCompletionResult(completion: CompletionWithResult) {
  return parseResult(completion.result_made, completion.result_attempts);
}

function timeOf(completion: CompletionWithResult) {
  const time = new Date(completion.completed_at).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function collectResults(completions: CompletionWithResult[]) {
  return completions
    .map((completion, index) => ({ result: getCompletionResult(completion), time: timeOf(completion), index }))
    .filter((entry): entry is { result: DrillResult; time: number; index: number } => entry.result !== null)
    .sort((left, right) => right.time - left.time || left.index - right.index)
    .map((entry) => entry.result);
}

export function getDrillResults(drillId: string, completions: CompletionWithResult[]) {
  return collectResults(completions.filter((completion) => completion.drill_id === drillId));
}

export function getLastResult(drillId: string, completions: CompletionWithResult[]) {
  return getDrillResults(drillId, completions)[0] ?? null;
}

export function compareResults(left: DrillResult, right: DrillResult) {
  return left.made * right.attempts - right.made * left.attempts || left.attempts - right.attempts;
}

export function getBestResult(drillId: string, completions: CompletionWithResult[]) {
  return getDrillResults(drillId, completions).reduce<DrillResult | null>(
    (best, result) => (best === null || compareResults(result, best) > 0 ? result : best),
    null,
  );
}

export function getSuccessRate(drillId: string, completions: CompletionWithResult[]) {
  const results = getDrillResults(drillId, completions);
  const attempts = results.reduce((total, result) => total + result.attempts, 0);

  if (attempts === 0) return null;

  return results.reduce((total, result) => total + result.made, 0) / attempts;
}

export function isTargetReached(result: DrillResult, target: ResultTarget) {
  return result.made * target.attempts >= target.success_threshold * result.attempts;
}

export function getResultThisWeek(drillId: string, completions: CompletionWithResult[], now = new Date()) {
  return getLastResult(
    drillId,
    completions.filter((completion) => isSameWeek(new Date(completion.completed_at), now, { weekStartsOn: 1 })),
  );
}
