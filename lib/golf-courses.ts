import { invokeWithTimeout } from './invoke-timeout';
import { supabase } from './supabase';

export type GolfCourse = {
  id: string;
  name: string;
  city: string;
  region: string;
  par18: number;
  par9: number;
  holes: number;
  clubName?: string | null;
  country?: string | null;
  countryCode?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  provider?: string | null;
  providerCourseId?: string | null;
  providerClubId?: string | null;
  teeOptions?: TeeOption[];
  holeDetails?: CourseHoleDetail[];
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type TeeKey = string;
export type DistanceUnit = 'm' | 'yd';

export type CourseHoleGpsPoint = {
  id?: string | null;
  providerPointId?: string | null;
  pointType:
    | 'tee'
    | 'green_front'
    | 'green_center'
    | 'green_back'
    | 'pin'
    | 'centerline'
    | 'hazard'
    | 'bunker'
    | 'water'
    | 'layup'
    | 'poi';
  name?: string | null;
  latitude: number;
  longitude: number;
  teeKey?: TeeKey | null;
  distanceM?: number | null;
  sortOrder: number;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type TeeOption = {
  id?: string | null;
  key: TeeKey;
  label: string;
  shortLabel: string;
  color: string;
  distanceOffset: number;
  totalDistance?: number | null;
  courseRating?: number | null;
  slopeRating?: number | null;
  gender?: string | null;
  providerTeeSetId?: string | null;
  metadata?: Record<string, unknown>;
};

export type CourseHoleDetail = {
  holeNumber: number;
  par: number;
  handicapIndex: number;
  distanceByTee: Partial<Record<TeeKey, number>>;
  latitude?: number | null;
  longitude?: number | null;
  gpsPoints?: CourseHoleGpsPoint[];
  unit?: DistanceUnit;
};

export type CourseSearchResult = GolfCourse & {
  isCustom?: boolean;
};

type CourseCatalogSearchResponse = {
  courses: GolfCourse[];
};

type CourseCatalogGetResponse = {
  course: GolfCourse | null;
};

export type CourseSearchOutcome = {
  courses: CourseSearchResult[];
  remoteUnavailable: boolean;
};

export const COURSE_CATALOG_TIMEOUT_MS = 12_000;

export const COURSE_SEARCH_UNAVAILABLE_MESSAGE = 'La recherche en ligne est indisponible. Seule la liste de parcours intégrée à l’app est proposée.';

export const DEFAULT_TEE_KEY = 'yellow';

const DEFAULT_DISTANCE_OFFSETS = {
  back: 28,
  white: 12,
  yellow: 0,
  blue: -18,
  red: -34,
} as const;

const DEFAULT_TEE_ORDER = ['back', 'white', 'yellow', 'blue', 'red'] as const;

export const TEE_OPTIONS: TeeOption[] = [
  { key: 'back', label: 'Back', shortLabel: 'BK', color: '#111827', distanceOffset: 28 },
  { key: 'white', label: 'White', shortLabel: 'W', color: '#e5e7eb', distanceOffset: 12 },
  { key: 'yellow', label: 'Yellow', shortLabel: 'Y', color: '#fbbf24', distanceOffset: 0 },
  { key: 'blue', label: 'Blue', shortLabel: 'B', color: '#60a5fa', distanceOffset: -18 },
  { key: 'red', label: 'Red', shortLabel: 'R', color: '#f87171', distanceOffset: -34 },
] as const;

const courseCache = new Map<string, GolfCourse>();

export const FRENCH_COURSES: GolfCourse[] = [
  { id: 'golf-national', name: 'Golf National', city: 'Saint-Quentin-en-Yvelines', region: 'Ile-de-France', par18: 72, par9: 36, holes: 18 },
  { id: 'morfontaine', name: 'Golf de Morfontaine', city: 'Morfontaine', region: 'Hauts-de-France', par18: 72, par9: 36, holes: 18 },
  { id: 'chantilly-vineuil', name: 'Golf de Chantilly', city: 'Chantilly', region: 'Hauts-de-France', par18: 72, par9: 36, holes: 36 },
  { id: 'saint-cloud', name: 'Golf de Saint-Cloud', city: 'Saint-Cloud', region: 'Ile-de-France', par18: 71, par9: 36, holes: 18 },
  { id: 'fontainebleau', name: 'Golf de Fontainebleau', city: 'Fontainebleau', region: 'Ile-de-France', par18: 72, par9: 36, holes: 18 },
  { id: 'racing-la-boulie', name: 'Golf du Racing Club de France', city: 'La Boulie', region: 'Ile-de-France', par18: 72, par9: 36, holes: 36 },
  { id: 'saint-nom', name: 'Golf de Saint-Nom-la-Breteche', city: 'Saint-Nom-la-Breteche', region: 'Ile-de-France', par18: 71, par9: 35, holes: 36 },
  { id: 'joyenval', name: 'Golf de Joyenval', city: 'Chambourcy', region: 'Ile-de-France', par18: 72, par9: 36, holes: 18 },
  { id: 'etretat', name: "Golf d'Etretat", city: 'Etretat', region: 'Normandie', par18: 72, par9: 36, holes: 18 },
  { id: 'deauville', name: 'Golf de Deauville Saint-Gatien', city: 'Deauville', region: 'Normandie', par18: 72, par9: 36, holes: 18 },
  { id: 'omaha-beach', name: 'Golf Omaha Beach', city: 'Port-en-Bessin', region: 'Normandie', par18: 72, par9: 36, holes: 27 },
  { id: 'saint-malo', name: 'Golf de Saint-Malo', city: 'Saint-Malo', region: 'Bretagne', par18: 72, par9: 36, holes: 18 },
  { id: 'dinard', name: 'Golf de Dinard', city: 'Dinard', region: 'Bretagne', par18: 68, par9: 34, holes: 18 },
  { id: 'la-baule', name: 'Golf de La Baule', city: 'La Baule', region: 'Pays de la Loire', par18: 72, par9: 36, holes: 18 },
  { id: 'nantes-erdre', name: "Golf de l'Erdre", city: 'Nantes', region: 'Pays de la Loire', par18: 72, par9: 36, holes: 18 },
  { id: 'bordeaux-lac', name: 'Golf de Bordeaux-Lac', city: 'Bordeaux', region: 'Nouvelle-Aquitaine', par18: 71, par9: 36, holes: 18 },
  { id: 'arcachon', name: "Golf d'Arcachon", city: 'La Teste-de-Buch', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'lacanau', name: 'Golf de Lacanau', city: 'Lacanau', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'hossegor', name: "Golf d'Hossegor", city: 'Hossegor', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'seignosse', name: 'Golf de Seignosse', city: 'Seignosse', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'chiberta', name: 'Golf de Chiberta', city: 'Anglet', region: 'Nouvelle-Aquitaine', par18: 70, par9: 35, holes: 18 },
  { id: 'biarritz', name: 'Golf de Biarritz Le Phare', city: 'Biarritz', region: 'Nouvelle-Aquitaine', par18: 69, par9: 35, holes: 18 },
  { id: 'moliets', name: 'Golf de Moliets', city: 'Moliets-et-Maa', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'toulouse-seilh', name: 'Golf de Toulouse Seilh', city: 'Toulouse', region: 'Occitanie', par18: 71, par9: 36, holes: 27 },
  { id: 'toulouse-palmola', name: 'Golf de Toulouse Palmola', city: 'Bruguieres', region: 'Occitanie', par18: 72, par9: 36, holes: 18 },
  { id: 'montpellier-massane', name: 'Golf de Montpellier Massane', city: 'Baillargues', region: 'Occitanie', par18: 72, par9: 36, holes: 18 },
  { id: 'grande-motte', name: 'Golf de la Grande Motte', city: 'La Grande-Motte', region: 'Occitanie', par18: 72, par9: 36, holes: 18 },
  { id: 'nimes-campagne', name: 'Golf de Nimes Campagne', city: 'Nimes', region: 'Occitanie', par18: 72, par9: 36, holes: 18 },
  { id: 'cap-dagde', name: "Golf du Cap d'Agde", city: "Cap d'Agde", region: 'Occitanie', par18: 72, par9: 36, holes: 18 },
  { id: 'cannes-mougins', name: 'Golf de Cannes Mougins', city: 'Mougins', region: "Provence-Alpes-Cote d'Azur", par18: 71, par9: 36, holes: 18 },
  { id: 'monte-carlo', name: 'Golf de Monte-Carlo', city: 'Mont-Agel', region: "Provence-Alpes-Cote d'Azur", par18: 72, par9: 36, holes: 18 },
  { id: 'valescure', name: 'Golf de Valescure', city: 'Saint-Raphael', region: "Provence-Alpes-Cote d'Azur", par18: 71, par9: 35, holes: 18 },
  { id: 'beauvallon', name: 'Golf de Beauvallon', city: 'Grimaud', region: "Provence-Alpes-Cote d'Azur", par18: 71, par9: 36, holes: 18 },
  { id: 'aixenprovence', name: "Golf d'Aix-Marseille", city: 'Aix-en-Provence', region: "Provence-Alpes-Cote d'Azur", par18: 72, par9: 36, holes: 18 },
  { id: 'evian', name: 'Evian Resort Golf Club', city: 'Evian-les-Bains', region: 'Auvergne-Rhone-Alpes', par18: 71, par9: 35, holes: 18 },
  { id: 'lyon-chassieu', name: 'Golf de Lyon', city: 'Chassieu', region: 'Auvergne-Rhone-Alpes', par18: 72, par9: 36, holes: 18 },
  { id: 'grenoble-bresson', name: 'Golf de Grenoble Bresson', city: 'Grenoble', region: 'Auvergne-Rhone-Alpes', par18: 71, par9: 36, holes: 18 },
  { id: 'aix-les-bains', name: "Golf d'Aix-les-Bains", city: 'Aix-les-Bains', region: 'Auvergne-Rhone-Alpes', par18: 72, par9: 36, holes: 18 },
  { id: 'megeve', name: 'Golf de Megeve', city: 'Megeve', region: 'Auvergne-Rhone-Alpes', par18: 71, par9: 36, holes: 18 },
  { id: 'strasbourg-illkirch', name: 'Golf de Strasbourg', city: 'Illkirch-Graffenstaden', region: 'Grand Est', par18: 72, par9: 36, holes: 18 },
  { id: 'amneville', name: "Golf d'Amneville", city: 'Amneville', region: 'Grand Est', par18: 72, par9: 36, holes: 18 },
  { id: 'nancy-pulnoy', name: 'Golf de Nancy Pulnoy', city: 'Pulnoy', region: 'Grand Est', par18: 72, par9: 36, holes: 18 },
  { id: 'rouen-moulineaux', name: 'Golf de Rouen', city: 'Moulineaux', region: 'Normandie', par18: 72, par9: 36, holes: 18 },
  { id: 'caen-garcelles', name: 'Golf de Caen', city: 'Garcelles-Secqueville', region: 'Normandie', par18: 72, par9: 36, holes: 18 },
  { id: 'rennes-saint-jacques', name: 'Golf de Rennes', city: 'Saint-Jacques-de-la-Lande', region: 'Bretagne', par18: 72, par9: 36, holes: 18 },
  { id: 'la-rochelle', name: 'Golf de La Rochelle', city: 'Prezerville', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'poitiers', name: 'Golf de Poitiers', city: 'Mignaloux-Beauvoir', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'limoges', name: 'Golf de Limoges', city: 'Isle', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'clermont-ferrand', name: 'Golf de Charade', city: 'Clermont-Ferrand', region: 'Auvergne-Rhone-Alpes', par18: 72, par9: 36, holes: 18 },
  { id: 'dijon-bourgogne', name: 'Golf de Bourgogne', city: 'Dijon', region: 'Bourgogne-Franche-Comte', par18: 72, par9: 36, holes: 18 },
  { id: 'reims', name: 'Golf de Reims', city: 'Sept-Saulx', region: 'Grand Est', par18: 72, par9: 36, holes: 18 },
  { id: 'paris-country-club', name: 'Paris Country Club', city: 'Saint-Cloud', region: 'Ile-de-France', par18: 72, par9: 36, holes: 18 },
  { id: 'fourqueux', name: 'Golf de Fourqueux', city: 'Fourqueux', region: 'Ile-de-France', par18: 71, par9: 36, holes: 18 },
  { id: 'rochefort', name: 'Golf de Rochefort-Ocean', city: 'Saint-Laurent-de-la-Pree', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
  { id: 'ile-de-france-feucherolles', name: 'Golf de Feucherolles', city: 'Feucherolles', region: 'Ile-de-France', par18: 72, par9: 36, holes: 18 },
  { id: 'chamonix', name: 'Golf de Chamonix', city: 'Chamonix', region: 'Auvergne-Rhone-Alpes', par18: 72, par9: 36, holes: 18 },
  { id: 'gujan-mestras', name: 'Golf de Gujan-Mestras', city: 'Gujan-Mestras', region: 'Nouvelle-Aquitaine', par18: 72, par9: 36, holes: 18 },
];

const GOLF_NATIONAL_HOLE_DETAILS: CourseHoleDetail[] = [
  { holeNumber: 1, par: 4, handicapIndex: 4, distanceByTee: { back: 383, white: 353, yellow: 318, blue: 287, red: 273 }, unit: 'yd' },
  { holeNumber: 2, par: 3, handicapIndex: 6, distanceByTee: { back: 192, white: 171, yellow: 141, blue: 130, red: 120 }, unit: 'yd' },
  { holeNumber: 3, par: 5, handicapIndex: 12, distanceByTee: { back: 510, white: 475, yellow: 456, blue: 437, red: 408 }, unit: 'yd' },
  { holeNumber: 4, par: 4, handicapIndex: 8, distanceByTee: { back: 445, white: 399, yellow: 385, blue: 355, red: 338 }, unit: 'yd' },
  { holeNumber: 5, par: 4, handicapIndex: 16, distanceByTee: { back: 370, white: 351, yellow: 339, blue: 291, red: 281 }, unit: 'yd' },
  { holeNumber: 6, par: 4, handicapIndex: 18, distanceByTee: { back: 348, white: 328, yellow: 295, blue: 286, red: 280 }, unit: 'yd' },
  { holeNumber: 7, par: 4, handicapIndex: 2, distanceByTee: { back: 440, white: 418, yellow: 411, blue: 359, red: 346 }, unit: 'yd' },
  { holeNumber: 8, par: 3, handicapIndex: 14, distanceByTee: { back: 190, white: 178, yellow: 169, blue: 147, red: 134 }, unit: 'yd' },
  { holeNumber: 9, par: 5, handicapIndex: 10, distanceByTee: { back: 541, white: 529, yellow: 499, blue: 405, red: 398 }, unit: 'yd' },
  { holeNumber: 10, par: 4, handicapIndex: 9, distanceByTee: { back: 343, white: 321, yellow: 298, blue: 286, red: 279 }, unit: 'yd' },
  { holeNumber: 11, par: 3, handicapIndex: 17, distanceByTee: { back: 163, white: 153, yellow: 132, blue: 125, red: 113 }, unit: 'yd' },
  { holeNumber: 12, par: 4, handicapIndex: 7, distanceByTee: { back: 396, white: 375, yellow: 337, blue: 304, red: 304 }, unit: 'yd' },
  { holeNumber: 13, par: 4, handicapIndex: 3, distanceByTee: { back: 379, white: 351, yellow: 339, blue: 311, red: 299 }, unit: 'yd' },
  { holeNumber: 14, par: 5, handicapIndex: 11, distanceByTee: { back: 544, white: 497, yellow: 437, blue: 370, red: 361 }, unit: 'yd' },
  { holeNumber: 15, par: 4, handicapIndex: 1, distanceByTee: { back: 373, white: 362, yellow: 345, blue: 320, red: 301 }, unit: 'yd' },
  { holeNumber: 16, par: 3, handicapIndex: 13, distanceByTee: { back: 162, white: 151, yellow: 137, blue: 112, red: 112 }, unit: 'yd' },
  { holeNumber: 17, par: 4, handicapIndex: 5, distanceByTee: { back: 439, white: 424, yellow: 405, blue: 329, red: 321 }, unit: 'yd' },
  { holeNumber: 18, par: 5, handicapIndex: 15, distanceByTee: { back: 431, white: 409, yellow: 411, blue: 392, red: 370 }, unit: 'yd' },
];

const FALLBACK_HOLE_DETAILS: Partial<Record<string, CourseHoleDetail[]>> = {
  'golf-national': GOLF_NATIONAL_HOLE_DETAILS,
};

function normalizeCourseValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function slugify(value: string) {
  return normalizeCourseValue(value).replace(/\s+/g, '-').replace(/'/g, '') || 'course';
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toObject(value: unknown) {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function formatTeeShortLabel(label: string) {
  const compact = label
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();

  return compact || 'TEE';
}

function resolveDefaultDistanceOffset(key: string) {
  const normalizedKey = normalizeCourseValue(key);

  if (normalizedKey.includes('back') || normalizedKey.includes('black') || normalizedKey.includes('champ')) {
    return DEFAULT_DISTANCE_OFFSETS.back;
  }

  if (normalizedKey.includes('white') || normalizedKey.includes('blanc')) {
    return DEFAULT_DISTANCE_OFFSETS.white;
  }

  if (normalizedKey.includes('yellow') || normalizedKey.includes('jaune') || normalizedKey.includes('member')) {
    return DEFAULT_DISTANCE_OFFSETS.yellow;
  }

  if (normalizedKey.includes('blue') || normalizedKey.includes('bleu')) {
    return DEFAULT_DISTANCE_OFFSETS.blue;
  }

  if (normalizedKey.includes('red') || normalizedKey.includes('rouge') || normalizedKey.includes('forward')) {
    return DEFAULT_DISTANCE_OFFSETS.red;
  }

  return 0;
}

function resolveDefaultTeeColor(key: string) {
  const normalizedKey = normalizeCourseValue(key);

  if (normalizedKey.includes('back') || normalizedKey.includes('black') || normalizedKey.includes('champ')) {
    return '#111827';
  }

  if (normalizedKey.includes('white') || normalizedKey.includes('blanc')) {
    return '#e5e7eb';
  }

  if (normalizedKey.includes('yellow') || normalizedKey.includes('jaune') || normalizedKey.includes('member')) {
    return '#fbbf24';
  }

  if (normalizedKey.includes('blue') || normalizedKey.includes('bleu')) {
    return '#60a5fa';
  }

  if (normalizedKey.includes('red') || normalizedKey.includes('rouge') || normalizedKey.includes('forward')) {
    return '#f87171';
  }

  return '#94a3b8';
}

function sortTeeOptions(left: TeeOption, right: TeeOption) {
  const leftDistance = left.totalDistance ?? null;
  const rightDistance = right.totalDistance ?? null;

  if (leftDistance != null && rightDistance != null && leftDistance !== rightDistance) {
    return rightDistance - leftDistance;
  }

  const leftOrder = DEFAULT_TEE_ORDER.indexOf(left.key as typeof DEFAULT_TEE_ORDER[number]);
  const rightOrder = DEFAULT_TEE_ORDER.indexOf(right.key as typeof DEFAULT_TEE_ORDER[number]);

  if (leftOrder !== -1 || rightOrder !== -1) {
    if (leftOrder === -1) return 1;
    if (rightOrder === -1) return -1;
    return leftOrder - rightOrder;
  }

  return left.label.localeCompare(right.label, 'fr');
}

function normalizeTeeOption(value: TeeOption, index = 0, teeOptions: TeeOption[] = []) {
  const totalDistance = toNumber(value.totalDistance) ?? null;
  const sortedDistances = teeOptions
    .map((teeOption) => toNumber(teeOption.totalDistance))
    .filter((distance): distance is number => distance != null)
    .sort((left, right) => right - left);
  const baselineDistance = sortedDistances[Math.floor(sortedDistances.length / 2)] ?? null;
  const key = value.key.trim();

  return {
    id: value.id ?? null,
    key,
    label: value.label.trim() || key,
    shortLabel: value.shortLabel.trim() || formatTeeShortLabel(value.label || key),
    color: value.color.trim() || resolveDefaultTeeColor(key),
    distanceOffset: typeof value.distanceOffset === 'number'
      ? value.distanceOffset
      : totalDistance != null && baselineDistance != null
        ? Math.round((totalDistance - baselineDistance) / 18)
        : resolveDefaultDistanceOffset(key) - index * 4,
    totalDistance,
    courseRating: toNumber(value.courseRating),
    slopeRating: toNumber(value.slopeRating),
    gender: value.gender ?? null,
    providerTeeSetId: value.providerTeeSetId ?? null,
    metadata: value.metadata ?? {},
  } satisfies TeeOption;
}

function normalizeHoleDetail(detail: CourseHoleDetail): CourseHoleDetail {
  const distanceByTee = Object.entries(detail.distanceByTee).reduce((distances, [teeKey, distance]) => {
    const parsedDistance = toNumber(distance);

    if (!isTeeKey(teeKey) || parsedDistance == null) {
      return distances;
    }

    return {
      ...distances,
      [teeKey]: parsedDistance,
    };
  }, {} as Partial<Record<TeeKey, number>>);

  return {
    holeNumber: detail.holeNumber,
    par: detail.par,
    handicapIndex: detail.handicapIndex,
    distanceByTee,
    latitude: detail.latitude ?? null,
    longitude: detail.longitude ?? null,
    gpsPoints: detail.gpsPoints ?? [],
    unit: detail.unit ?? 'm',
  };
}

function convertDistance(distance: number, unit: DistanceUnit = 'm') {
  return unit === 'yd' ? Math.round(distance * 0.9144) : distance;
}

function getFallbackHoleDetails(courseId: string) {
  const details = FALLBACK_HOLE_DETAILS[courseId];

  if (!details) {
    return undefined;
  }

  return details.map((detail) => ({
    ...detail,
    unit: 'm' as const,
    distanceByTee: Object.fromEntries(
      Object.entries(detail.distanceByTee).map(([teeKey, distance]) => [
        teeKey,
        typeof distance === 'number' ? convertDistance(distance, detail.unit) : distance,
      ])
    ) as Partial<Record<TeeKey, number>>,
  }));
}

function withFallbackCourseData(course: GolfCourse): GolfCourse {
  const fallbackCourse = FRENCH_COURSES.find((entry) => entry.id === course.id) ?? null;
  const baseCourse = fallbackCourse ? { ...fallbackCourse, ...course } : course;
  const teeOptions = baseCourse.teeOptions?.length
    ? [...baseCourse.teeOptions].sort(sortTeeOptions).map((teeOption, index, teeOptionList) => normalizeTeeOption(teeOption, index, teeOptionList))
    : TEE_OPTIONS.map((teeOption) => ({ ...teeOption }));
  const holeDetails = baseCourse.holeDetails?.length
    ? baseCourse.holeDetails.map(normalizeHoleDetail)
    : getFallbackHoleDetails(baseCourse.id);

  return {
    ...baseCourse,
    teeOptions,
    holeDetails,
  };
}

function mergeCourseIntoCache(course: GolfCourse) {
  const normalizedCourse = withFallbackCourseData(course);
  const cachedCourse = courseCache.get(normalizedCourse.id);

  const nextCourse = withFallbackCourseData({
    ...(cachedCourse ?? {}),
    ...normalizedCourse,
    teeOptions: normalizedCourse.teeOptions ?? cachedCourse?.teeOptions,
    holeDetails: normalizedCourse.holeDetails ?? cachedCourse?.holeDetails,
  });

  courseCache.set(nextCourse.id, nextCourse);
  return nextCourse;
}

function createCustomCourse(name: string): CourseSearchResult {
  const normalizedName = normalizeCourseValue(name);
  const idSuffix = normalizedName.replace(/\s+/g, '-').replace(/'/g, '') || 'course';

  return {
    id: `custom-${idSuffix}`,
    name: name.trim(),
    city: 'Parcours non catalogue',
    region: 'Saisie manuelle',
    par18: 72,
    par9: 36,
    holes: 18,
    teeOptions: TEE_OPTIONS.map((teeOption) => ({ ...teeOption })),
    isCustom: true,
  };
}

function scoreCourse(course: GolfCourse, query: string, queryTokens: string[]) {
  const normalizedName = normalizeCourseValue(course.name);
  const normalizedCity = normalizeCourseValue(course.city);
  const normalizedRegion = normalizeCourseValue(course.region);
  const normalizedClubName = normalizeCourseValue(course.clubName ?? '');
  const searchable = `${normalizedName} ${normalizedClubName} ${normalizedCity} ${normalizedRegion}`;

  let score = 0;

  if (normalizedName === query) score += 120;
  if (normalizedName.startsWith(query)) score += 80;
  if (normalizedClubName.startsWith(query)) score += 70;
  if (normalizedCity.startsWith(query)) score += 45;
  if (normalizedRegion.startsWith(query)) score += 35;
  if (searchable.includes(query)) score += 20;

  if (queryTokens.length > 1 && queryTokens.every((token) => searchable.includes(token))) {
    score += 30;
  } else {
    score += queryTokens.filter((token) => searchable.includes(token)).length * 8;
  }

  return score;
}

function searchFallbackCourses(query: string, limit = 8): CourseSearchResult[] {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const normalizedQuery = normalizeCourseValue(trimmedQuery);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  const rankedCourses = FRENCH_COURSES
    .map((course) => ({ course: withFallbackCourseData(course), score: scoreCourse(course, normalizedQuery, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.course.name.localeCompare(right.course.name, 'fr');
    })
    .map(({ course }) => course);

  const hasExactMatch = rankedCourses.some(
    (course) => normalizeCourseValue(course.name) === normalizedQuery
  );

  if (hasExactMatch) {
    return rankedCourses.slice(0, limit);
  }

  return [createCustomCourse(trimmedQuery), ...rankedCourses].slice(0, limit);
}

async function invokeCourseCatalog<TRequest extends { action: string }, TResponse>(payload: TRequest) {
  const { data, error } = await invokeWithTimeout(
    (signal) => supabase.functions.invoke('course-catalog', { body: payload, signal }),
    COURSE_CATALOG_TIMEOUT_MS
  );

  if (error) {
    throw new Error(error.message || 'La synchronisation du catalogue parcours a échoué.');
  }

  if (!data) {
    throw new Error('Le catalogue parcours n’a renvoyé aucune donnée.');
  }

  return data as TResponse;
}

function dedupeCourses(courses: CourseSearchResult[]) {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const dedupedCourses: CourseSearchResult[] = [];

  for (const course of courses) {
    const normalizedName = normalizeCourseValue(course.name);

    if (seenIds.has(course.id) || seenNames.has(normalizedName)) {
      continue;
    }

    seenIds.add(course.id);
    seenNames.add(normalizedName);
    dedupedCourses.push(course);
  }

  return dedupedCourses;
}

export function isTeeKey(value: unknown): value is TeeKey {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function searchCoursesWithStatus(query: string, limit = 8): Promise<CourseSearchOutcome> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return { courses: [], remoteUnavailable: false };
  }

  const fallbackCourses = searchFallbackCourses(trimmedQuery, limit);

  try {
    const response = await invokeCourseCatalog<{ action: 'search_courses'; query: string; limit: number }, CourseCatalogSearchResponse>({
      action: 'search_courses',
      query: trimmedQuery,
      limit,
    });

    const remoteCourses = (response.courses ?? []).map(mergeCourseIntoCache);
    const combinedCourses = dedupeCourses([...remoteCourses, ...fallbackCourses]);
    const normalizedQuery = normalizeCourseValue(trimmedQuery);
    const hasExactMatch = combinedCourses.some((course) => normalizeCourseValue(course.name) === normalizedQuery);

    if (hasExactMatch) {
      return { courses: combinedCourses.slice(0, limit), remoteUnavailable: false };
    }

    return {
      courses: dedupeCourses([createCustomCourse(trimmedQuery), ...combinedCourses]).slice(0, limit),
      remoteUnavailable: false,
    };
  } catch {
    return { courses: fallbackCourses, remoteUnavailable: true };
  }
}

export async function searchCourses(query: string, limit = 8): Promise<CourseSearchResult[]> {
  return (await searchCoursesWithStatus(query, limit)).courses;
}

export function getParForHoles(course: GolfCourse, holes: 9 | 18): number {
  return holes === 9 ? course.par9 : course.par18;
}

export async function getCourseById(courseId: string | null | undefined) {
  if (!courseId) {
    return null;
  }

  const cachedCourse = courseCache.get(courseId);

  if (cachedCourse?.holeDetails?.length || cachedCourse?.teeOptions?.length) {
    return cachedCourse;
  }

  const fallbackCourse = FRENCH_COURSES.find((course) => course.id === courseId) ?? null;

  if (fallbackCourse) {
    return mergeCourseIntoCache(fallbackCourse);
  }

  try {
    const response = await invokeCourseCatalog<{ action: 'get_course'; courseId: string }, CourseCatalogGetResponse>({
      action: 'get_course',
      courseId,
    });

    return response.course ? mergeCourseIntoCache(response.course) : null;
  } catch {
    return cachedCourse ?? null;
  }
}

function resolveCourse(courseOrId?: GolfCourse | string | null) {
  if (!courseOrId) {
    return null;
  }

  if (typeof courseOrId === 'string') {
    const cachedCourse = courseCache.get(courseOrId);

    if (cachedCourse) {
      return cachedCourse;
    }

    const fallbackCourse = FRENCH_COURSES.find((course) => course.id === courseOrId) ?? null;
    return fallbackCourse ? withFallbackCourseData(fallbackCourse) : null;
  }

  return withFallbackCourseData(courseOrId);
}

export function getKnownCourse(courseId: string | null | undefined) {
  return courseId ? resolveCourse(courseId) : null;
}

export function createPlaceholderCourse(name: string, courseId?: string | null): CourseSearchResult {
  const course = createCustomCourse(name);

  return courseId ? { ...course, id: courseId, isCustom: false } : course;
}

export function getCourseHoleDetails(courseOrId?: GolfCourse | string | null, holes?: 9 | 18) {
  const course = resolveCourse(courseOrId);

  if (!course?.holeDetails || course.holeDetails.length === 0) {
    return null;
  }

  const limitedDetails = typeof holes === 'number' ? course.holeDetails.slice(0, holes) : course.holeDetails;
  return limitedDetails.map(normalizeHoleDetail);
}

export function hasCompleteCourseHoleDetails(courseOrId?: GolfCourse | string | null, holes?: 9 | 18) {
  const details = getCourseHoleDetails(courseOrId, holes);
  const teeOptions = getTeeOptions(courseOrId);

  if (!details || details.length === 0) {
    return false;
  }

  if (typeof holes === 'number' && details.length !== holes) {
    return false;
  }

  return details.every((detail) => teeOptions.every((teeOption) => typeof detail.distanceByTee[teeOption.key] === 'number'));
}

export function getCourseParSequence(courseOrId: GolfCourse | string | null | undefined, holes: 9 | 18) {
  const details = getCourseHoleDetails(courseOrId, holes);

  if (!details || details.length !== holes) {
    return null;
  }

  return details.map((detail) => detail.par);
}

export function getTeeOptions(courseOrId?: GolfCourse | string | null) {
  const course = resolveCourse(courseOrId);
  const teeOptions = course?.teeOptions?.length
    ? course.teeOptions
    : TEE_OPTIONS;

  return teeOptions
    .map((teeOption, index, teeOptionList) => normalizeTeeOption(teeOption, index, teeOptionList))
    .sort(sortTeeOptions);
}

export function getDefaultTeeKey(courseOrId?: GolfCourse | string | null) {
  const teeOptions = getTeeOptions(courseOrId);

  return teeOptions.find((teeOption) => teeOption.key === DEFAULT_TEE_KEY)?.key
    ?? teeOptions[0]?.key
    ?? DEFAULT_TEE_KEY;
}

export function getValidTeeKey(courseOrId: GolfCourse | string | null | undefined, teeKey: string | null | undefined) {
  const teeOptions = getTeeOptions(courseOrId);

  if (teeKey && teeOptions.some((teeOption) => teeOption.key === teeKey)) {
    return teeKey;
  }

  return getDefaultTeeKey(courseOrId);
}
