export type ScoreNotation = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double';

export function getScoreNotation(strokes: number, par: number): ScoreNotation {
  const diff = strokes - par;
  if (!Number.isFinite(diff)) return 'par';
  if (diff <= -2) return 'eagle';
  if (diff < 0) return 'birdie';
  if (diff === 0) return 'par';
  if (diff < 2) return 'bogey';
  return 'double';
}

export const SCORE_NOTATION_LABELS: Record<ScoreNotation, string> = {
  eagle: 'eagle ou mieux',
  birdie: 'birdie',
  par: 'par',
  bogey: 'bogey',
  double: 'double bogey ou plus',
};
