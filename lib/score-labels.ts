const MINUS = '−';

function plural(count: number, one: string, many: string) {
  return count > 1 ? many : one;
}

export function formatScoreToPar(value: number): string {
  if (!Number.isFinite(value) || value === 0) return 'E';
  return value > 0 ? `+${value}` : `${MINUS}${Math.abs(value)}`;
}

export function describeToPar(value: number): string {
  if (!Number.isFinite(value) || value === 0) return 'à égalité avec le par';
  const distance = Math.abs(value);
  return value > 0 ? `${distance} au-dessus du par` : `${distance} sous le par`;
}

export function formatHolesPlayed(count: number): string {
  if (!(count > 0)) return 'aucun trou joué';
  return `après ${count} ${plural(count, 'trou', 'trous')}`;
}

export function formatRemainingHoles(count: number): string {
  return `Il reste ${count} ${plural(count, 'trou', 'trous')} à saisir`;
}

export function getRelativeLabel(strokes: number, par: number): string {
  const diff = strokes - par;
  if (!Number.isFinite(diff)) return '';
  if (diff === 0) return 'par';
  if (diff < -2 || diff > 3) return '';
  return diff > 0 ? `+${diff}` : `${MINUS}${-diff}`;
}

export function getNotationWord(strokes: number, par: number): string {
  const diff = strokes - par;
  if (!Number.isFinite(diff)) return '';
  if (strokes === 1) return 'Trou en un';
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double bogey';
  return `+${diff}`;
}

export function describeStrokes(strokes: number, par: number): string {
  const diff = strokes - par;
  const word = diff >= 3 ? `${diff} au-dessus du par` : getNotationWord(strokes, par).toLowerCase();
  return `${strokes} ${plural(strokes, 'coup', 'coups')}, ${word}`;
}
