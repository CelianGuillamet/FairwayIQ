export * from './colors';
export * from './design';
export * from './theme';
export * from './legal';

export const HANDICAP_LEVELS = [
  { label: 'Débutant (30+)', value: 36 },
  { label: 'Amateur (20-30)', value: 25 },
  { label: 'Intermédiaire (10-20)', value: 15 },
  { label: 'Confirmé (5-10)', value: 7 },
  { label: 'Expert (0-5)', value: 3 },
] as const;

export const PLAY_FREQUENCIES = [
  { label: '1 fois par mois', value: 'monthly' },
  { label: '2-3 fois par mois', value: 'biweekly' },
  { label: '1 fois par semaine', value: 'weekly' },
  { label: '2-3 fois par semaine', value: 'frequent' },
] as const;

export const GOALS = [
  { label: 'Descendre mon handicap', value: 'lower_handicap' },
  { label: 'Être plus régulier', value: 'consistency' },
  { label: 'Améliorer mon short game', value: 'short_game' },
  { label: 'Améliorer mon putting', value: 'putting' },
  { label: 'Jouer pour le plaisir', value: 'enjoyment' },
] as const;
