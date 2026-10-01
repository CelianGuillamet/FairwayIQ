import { isSameDay } from 'date-fns';
import type { Drill } from '../types';

export type DrillCategory = Drill['category'];

export type DrillCompletion = {
  drill_id: string;
  completed_at: string;
};

export const DRILL_CATEGORY_LABELS: Record<DrillCategory, string> = {
  putting: 'Putting',
  short_game: 'Petit jeu',
  approach: 'Approches',
  driving: 'Mise en jeu',
  mental: 'Mental',
};

export const DRILL_DIFFICULTY_LABELS: Record<Drill['difficulty'], string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

export const DRILLS: Drill[] = [
  { id: '1', title: 'Gate Drill', description: 'Place deux tees à la largeur de ton putter à 50cm du trou. Rentre 10 putts de suite sans toucher les tees.', youtube_url: 'https://www.youtube.com/watch?v=k9nN-FTM6eA', category: 'putting', difficulty: 'beginner', duration_minutes: 10 },
  { id: '2', title: 'Clock Drill — distance', description: 'Place 4 balles à 1m, 2m, 3m et 4m du trou (comme une horloge). Fais le tour complet sans 3-putter.', youtube_url: null, category: 'putting', difficulty: 'intermediate', duration_minutes: 15 },
  { id: '3', title: '100 putts de 1 mètre', description: 'Rentre 100 putts de 1 mètre consécutifs. Si tu rates, recommence depuis 0. Construit la confiance.', youtube_url: null, category: 'putting', difficulty: 'beginner', duration_minutes: 20 },
  { id: '4', title: 'Chip & Run 50/50', description: "Depuis le rough, chipe vers une cible à 10m. L'objectif est que la balle roule autant qu'elle vole.", youtube_url: 'https://www.youtube.com/watch?v=dTy2Aqf5ZCY', category: 'short_game', difficulty: 'beginner', duration_minutes: 20 },
  { id: '5', title: 'Sortie de bunker ciblée', description: "Trace un cercle de 1m autour du trou. Sors 10 balles de bunker. Objectif: 7/10 dans le cercle.", youtube_url: 'https://www.youtube.com/watch?v=eCPndwLPSug', category: 'short_game', difficulty: 'intermediate', duration_minutes: 20 },
  { id: '6', title: 'Up & Down challenge', description: "50m du green, 10 essais. Compte tes up & downs réussis. Objectif: 5/10 minimum.", youtube_url: null, category: 'short_game', difficulty: 'intermediate', duration_minutes: 25 },
  { id: '7', title: '9 to 3 — contact propre', description: "Fais des swings courts (9h à 3h) avec un fer 7. Objectif: contact propre et trajectoire droite.", youtube_url: 'https://www.youtube.com/watch?v=27HWglP_x2o', category: 'approach', difficulty: 'beginner', duration_minutes: 15 },
  { id: '8', title: 'Fer contre mur', description: "Debout face à un mur (10cm), descends le club sans le toucher. Corrige les défauts de swing intérieur.", youtube_url: null, category: 'approach', difficulty: 'intermediate', duration_minutes: 10 },
  { id: '9', title: 'Approche 100m / 150m / 200m', description: "10 balles à chaque distance. Note les résultats. Identifie quelle distance te coûte le plus de coups.", youtube_url: null, category: 'approach', difficulty: 'intermediate', duration_minutes: 30 },
  { id: '10', title: 'Drive en douceur 80%', description: "Frappe 20 drives à 80% de puissance. Mesure la précision vs direction. La vitesse sans contrôle ne sert à rien.", youtube_url: null, category: 'driving', difficulty: 'beginner', duration_minutes: 20 },
  { id: '11', title: 'Tempo 3:1', description: 'Monte en 3 temps, descends en 1. Utilise un métronome ou compte "un-deux-trois / frapper".', youtube_url: 'https://www.youtube.com/watch?v=5ojlon_LPDg', category: 'driving', difficulty: 'beginner', duration_minutes: 15 },
  { id: '12', title: 'Drive entre les cibles', description: "Choisis deux repères à 10m d'écart à 200m. Frappe 10 balles dans le couloir. Compte tes réussites.", youtube_url: null, category: 'driving', difficulty: 'intermediate', duration_minutes: 20 },
  { id: '13', title: 'Routine de putting mental', description: "10 putts de 2m. Avant chaque putt: visualise la ligne, 2 pratiques, target focus. Zéro précipitation.", youtube_url: null, category: 'mental', difficulty: 'beginner', duration_minutes: 15 },
  { id: '14', title: 'Simulation de trou', description: "Au practice, joue un trou imaginaire. Drive, approche, chip, putt. Tout avec la même routine qu'en compet.", youtube_url: null, category: 'mental', difficulty: 'advanced', duration_minutes: 30 },
  { id: '15', title: 'Respiration avant coup', description: "Sur 20 coups, impose-toi 3 respirations profondes avant chaque swing. Observe l'effet sur la précision.", youtube_url: null, category: 'mental', difficulty: 'beginner', duration_minutes: 20 },
];

function getDaySeed(date: Date) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
}

export function isDrillDoneToday(
  drillId: string,
  completions: DrillCompletion[],
  now = new Date()
) {
  return completions.some((completion) => (
    completion.drill_id === drillId && isSameDay(new Date(completion.completed_at), now)
  ));
}

export function getRecommendedDrills(categories: string[]) {
  const categorySet = new Set(categories);

  if (categorySet.size === 0) {
    return DRILLS;
  }

  return DRILLS.filter((drill) => categorySet.has(drill.category));
}

export function getDailyFocusDrill(input: {
  categories: string[];
  completions: DrillCompletion[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const recommendedDrills = getRecommendedDrills(input.categories);
  const dueDrills = recommendedDrills.filter((drill) => !isDrillDoneToday(drill.id, input.completions, now));
  const pool = dueDrills.length > 0 ? dueDrills : recommendedDrills;

  if (pool.length === 0) {
    return null;
  }

  return pool[getDaySeed(now) % pool.length];
}
