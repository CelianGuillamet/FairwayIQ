import type { DiagnosticResult } from './ai-contract';
import { DRILL_CATEGORY_LABELS } from './drill-library';

const MAX_PARAM_LENGTH = 20000;
const MAX_TEXT_LENGTH = 4000;
const MAX_ITEMS = 10;

const KNOWN_CATEGORIES = new Set(Object.keys(DRILL_CATEGORY_LABELS));

function readText(value: unknown) {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : null;
}

function readTextList(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return null;
  }
  return value
    .map((item: string) => item.trim().slice(0, MAX_TEXT_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

export function parseDiagnosticResult(value: unknown): DiagnosticResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const rawAnalysis = readText(candidate.raw_analysis);
  const weeklyPlan = readText(candidate.weekly_plan);
  const strengths = readTextList(candidate.strengths);
  const weaknesses = readTextList(candidate.weaknesses);

  if (rawAnalysis === null || weeklyPlan === null || !strengths || !weaknesses) {
    return null;
  }

  const categories = Array.isArray(candidate.recommended_categories)
    ? candidate.recommended_categories.filter(
        (category): category is string => typeof category === 'string' && KNOWN_CATEGORIES.has(category)
      )
    : [];

  return {
    strengths,
    weaknesses,
    weekly_plan: weeklyPlan,
    raw_analysis: rawAnalysis,
    recommended_categories: Array.from(new Set(categories)),
  };
}

export function parseDiagnosisParam(param: string | string[] | undefined) {
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PARAM_LENGTH) {
    return null;
  }

  try {
    return parseDiagnosticResult(JSON.parse(raw));
  } catch {
    return null;
  }
}
