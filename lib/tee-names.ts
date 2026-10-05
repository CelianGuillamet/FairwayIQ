const FRENCH_TEE_NAMES: Record<string, string> = {
  back: 'Noir',
  black: 'Noir',
  noir: 'Noir',
  white: 'Blanc',
  blanc: 'Blanc',
  yellow: 'Jaune',
  jaune: 'Jaune',
  blue: 'Bleu',
  bleu: 'Bleu',
  red: 'Rouge',
  rouge: 'Rouge',
  gold: 'Or',
  or: 'Or',
  green: 'Vert',
  vert: 'Vert',
  orange: 'Orange',
};

function normalizeTeeName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function formatTeeName(name: string | null | undefined): string {
  if (!name) return '';

  return FRENCH_TEE_NAMES[normalizeTeeName(name)] ?? name;
}
