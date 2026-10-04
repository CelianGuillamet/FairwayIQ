import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type SearchCoursesRequest = {
  action: 'search_courses';
  query: string;
  limit?: number;
};

type GetCourseRequest = {
  action: 'get_course';
  courseId: string;
};

type CatalogCourse = {
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
  teeOptions?: CatalogTeeOption[];
  holeDetails?: CatalogHoleDetail[];
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown>;
};

type GpsPointType =
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

type CatalogGpsPoint = {
  id?: string | null;
  providerPointId?: string | null;
  pointType: GpsPointType;
  name?: string | null;
  latitude: number;
  longitude: number;
  teeKey?: string | null;
  distanceM?: number | null;
  sortOrder: number;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

type CatalogTeeOption = {
  id?: string | null;
  key: string;
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

type CatalogHoleDetail = {
  holeNumber: number;
  par: number;
  handicapIndex: number;
  distanceByTee: Record<string, number>;
  latitude?: number | null;
  longitude?: number | null;
  gpsPoints?: CatalogGpsPoint[];
  unit: 'm';
};

type ProviderCourseSummary = {
  id: string;
  provider: string;
  providerCourseId: string;
  providerClubId: string | null;
  name: string;
  clubName: string | null;
  city: string;
  region: string;
  state: string | null;
  country: string | null;
  countryCode: string | null;
  holes: number;
  par18: number;
  par9: number;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
};

type ProviderCourseDetail = ProviderCourseSummary & {
  teeOptions: ProviderTeeOption[];
  holeDetails: ProviderHoleDetail[];
};

type ProviderTeeOption = {
  id: string;
  providerTeeSetId: string | null;
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  totalDistance: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  gender: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

type ProviderHoleDetail = {
  id: string;
  holeNumber: number;
  par: number;
  handicapIndex: number | null;
  distanceByTee: Record<string, number>;
  latitude: number | null;
  longitude: number | null;
  gpsPoints: CatalogGpsPoint[];
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  bounds?: {
    minlat?: number;
    minlon?: number;
    maxlat?: number;
    maxlon?: number;
  };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const GOLF_PROVIDER = Deno.env.get('GOLF_DATA_PROVIDER') ?? 'golfapi';
const GOLFAPI_BASE_URL = (Deno.env.get('GOLFAPI_BASE_URL') ?? 'https://api.golfapi.io').replace(/\/+$/, '');
const GOLFAPI_KEY = Deno.env.get('GOLFAPI_KEY');
const GOLFAPI_AUTH_HEADER = Deno.env.get('GOLFAPI_AUTH_HEADER') ?? 'Authorization';
const GOLFAPI_AUTH_SCHEME = Deno.env.get('GOLFAPI_AUTH_SCHEME') ?? 'Bearer';
const COURSE_CATALOG_STALE_HOURS = Number(Deno.env.get('COURSE_CATALOG_STALE_HOURS') ?? '720');
const OSM_PROVIDER = 'openstreetmap';
const OSM_FRANCE_AREA = 'area["ISO3166-1"="FR"][admin_level=2]->.fr;';
const EXTERNAL_FETCH_TIMEOUT_MS = 20_000;
const PROVIDER_COURSE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SEARCH_QUERY_LENGTH = 100;
const OSM_OVERPASS_URL = (Deno.env.get('OSM_OVERPASS_URL') ?? 'https://overpass-api.de/api/interpreter').replace(/\/+$/, '');
const OSM_SEARCH_ENABLED = Deno.env.get('OSM_COURSE_SEARCH_ENABLED') === 'true';
const OSM_DETAIL_ENABLED = Deno.env.get('OSM_COURSE_DETAIL_ENABLED') !== 'false';
const OSM_DEFAULT_RADIUS_METERS = Number(Deno.env.get('OSM_COURSE_DETAIL_RADIUS_METERS') ?? '2500');
const COURSE_CATALOG_RATE_LIMIT_MAX = Number(Deno.env.get('COURSE_CATALOG_RATE_LIMIT_MAX') ?? '30');
const COURSE_CATALOG_RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get('COURSE_CATALOG_RATE_LIMIT_WINDOW_SECONDS') ?? '60');
const COURSE_CATALOG_NEGATIVE_CACHE_TTL_HOURS = Number(Deno.env.get('COURSE_CATALOG_NEGATIVE_CACHE_TTL_HOURS') ?? '24');

class ProviderNotFoundError extends Error {}
class RateLimitExceededError extends Error {}
class ClientError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const GENERIC_ERROR_MESSAGE = 'Service temporairement indisponible. Réessaie plus tard.';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toObject(value: unknown) {
  return isObject(value) ? value : null;
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toStringValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function toNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function clampInt(value: number | null, min: number, max: number, fallback: number) {
  return value == null ? fallback : Math.min(Math.max(Math.round(value), min), max);
}

function normalizeCourseValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function slugify(value: string) {
  return normalizeCourseValue(value).replace(/\s+/g, '-').replace(/'/g, '') || 'value';
}

function formatTeeShortLabel(label: string) {
  return label
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'TEE';
}

function resolveTeeColor(key: string) {
  const normalizedKey = normalizeCourseValue(key);

  if (normalizedKey.includes('back') || normalizedKey.includes('black') || normalizedKey.includes('champ')) return '#111827';
  if (normalizedKey.includes('white') || normalizedKey.includes('blanc')) return '#e5e7eb';
  if (normalizedKey.includes('yellow') || normalizedKey.includes('jaune') || normalizedKey.includes('member')) return '#fbbf24';
  if (normalizedKey.includes('blue') || normalizedKey.includes('bleu')) return '#60a5fa';
  if (normalizedKey.includes('red') || normalizedKey.includes('rouge') || normalizedKey.includes('forward')) return '#f87171';

  return '#94a3b8';
}

function resolveTeeDistanceOffset(key: string) {
  const normalizedKey = normalizeCourseValue(key);

  if (normalizedKey.includes('back') || normalizedKey.includes('black') || normalizedKey.includes('champ')) return 28;
  if (normalizedKey.includes('white') || normalizedKey.includes('blanc')) return 12;
  if (normalizedKey.includes('yellow') || normalizedKey.includes('jaune') || normalizedKey.includes('member')) return 0;
  if (normalizedKey.includes('blue') || normalizedKey.includes('bleu')) return -18;
  if (normalizedKey.includes('red') || normalizedKey.includes('rouge') || normalizedKey.includes('forward')) return -34;

  return 0;
}

function escapeLike(value: string) {
  return value.replace(/[%,()]/g, ' ').trim();
}

function extractArrayByKeys(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return [];
  }

  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function extractStringByKeys(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = toStringValue(source[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function extractNumberByKeys(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = toNumberValue(source[key]);

    if (value != null) {
      return value;
    }
  }

  return null;
}

function ensureSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Configuration Supabase incomplète côté serveur.');
  }
}

function getAdminClient() {
  ensureSupabaseConfig();

  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
    },
  });
}

async function resolveAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization');

  if (!authorization) {
    throw new ClientError(401, 'Authorization manquant.');
  }

  ensureSupabaseConfig();

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ClientError(401, 'Utilisateur non authentifié.');
  }

  return data.user;
}

async function enforceRateLimit(admin: ReturnType<typeof getAdminClient>, userId: string) {
  if (COURSE_CATALOG_RATE_LIMIT_MAX <= 0) {
    return;
  }

  const windowMs = Math.max(COURSE_CATALOG_RATE_LIMIT_WINDOW_SECONDS, 1) * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

  const { data, error } = await admin.rpc('increment_course_catalog_rate_limit', {
    p_user_id: userId,
    p_window_start: windowStart,
  });

  if (error) {
    throw error;
  }

  const requestCount = Number(data);

  if (Number.isFinite(requestCount) && requestCount > COURSE_CATALOG_RATE_LIMIT_MAX) {
    throw new RateLimitExceededError('Trop de requêtes sur la recherche de parcours. Réessaie dans une minute.');
  }
}

async function isNegativelyCached(
  admin: ReturnType<typeof getAdminClient>,
  lookupType: 'search' | 'course',
  provider: string,
  cacheKey: string
) {
  const { data, error } = await admin
    .from('course_catalog_negative_cache')
    .select('expires_at')
    .eq('id', `${lookupType}:${provider}:${cacheKey}`)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return false;
  }

  return new Date(data.expires_at).getTime() > Date.now();
}

async function recordNegativeCache(
  admin: ReturnType<typeof getAdminClient>,
  lookupType: 'search' | 'course',
  provider: string,
  cacheKey: string
) {
  if (COURSE_CATALOG_NEGATIVE_CACHE_TTL_HOURS <= 0) {
    return;
  }

  const expiresAt = new Date(Date.now() + COURSE_CATALOG_NEGATIVE_CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from('course_catalog_negative_cache').upsert(
    {
      id: `${lookupType}:${provider}:${cacheKey}`,
      lookup_type: lookupType,
      provider,
      cache_key: cacheKey,
      expires_at: expiresAt,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
}

function buildProviderHeaders() {
  if (!GOLFAPI_KEY) {
    return null;
  }

  const headerValue = GOLFAPI_AUTH_SCHEME
    ? `${GOLFAPI_AUTH_SCHEME} ${GOLFAPI_KEY}`
    : GOLFAPI_KEY;

  return {
    [GOLFAPI_AUTH_HEADER]: headerValue,
    Accept: 'application/json',
  };
}

async function providerFetch(path: string, params?: Record<string, string | number | undefined>) {
  const headers = buildProviderHeaders();

  if (!headers) {
    throw new Error('GOLFAPI_KEY est absente. Configure la clé provider côté Supabase.');
  }

  const url = new URL(`${GOLFAPI_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });

  if (response.status === 404) {
    throw new ProviderNotFoundError(`Golf provider 404: ${await response.text()}`);
  }

  if (!response.ok) {
    throw new Error(`Golf provider ${response.status}: ${await response.text()}`);
  }

  return await response.json() as unknown;
}

function buildCourseIdForProvider(provider: string, providerCourseId: string) {
  return `${provider}:course:${providerCourseId}`;
}

function buildCourseId(providerCourseId: string) {
  return buildCourseIdForProvider(GOLF_PROVIDER, providerCourseId);
}

function buildTeeSetId(courseId: string, teeKey: string) {
  return `${courseId}:tee:${teeKey}`;
}

function buildHoleId(courseId: string, holeNumber: number) {
  return `${courseId}:hole:${holeNumber}`;
}

function buildGpsPointId(holeId: string, point: CatalogGpsPoint, index: number) {
  const pointKey = [
    point.pointType,
    point.teeKey ?? 'default',
    point.providerPointId ?? point.name ?? index,
    point.sortOrder,
  ]
    .map((value) => slugify(String(value)))
    .join(':');

  return `${holeId}:gps:${pointKey}`;
}

function inferPar18(par18: number | null, par9: number | null, holes: number, holeDetails: ProviderHoleDetail[]) {
  if (par18 != null) {
    return par18;
  }

  if (par9 != null) {
    return holes === 9 ? par9 * 2 : par9;
  }

  if (holeDetails.length >= 9) {
    const first18 = holeDetails.slice(0, Math.min(18, holeDetails.length));
    const totalPar = first18.reduce((sum, hole) => sum + hole.par, 0);
    return totalPar > 0 ? totalPar : 72;
  }

  return holes === 9 ? 36 : 72;
}

function inferPar9(par9: number | null, par18: number | null, holes: number, holeDetails: ProviderHoleDetail[]) {
  if (par9 != null) {
    return par9;
  }

  if (par18 != null && holes >= 18) {
    return Math.round(par18 / 2);
  }

  if (holeDetails.length >= 9) {
    return holeDetails.slice(0, 9).reduce((sum, hole) => sum + hole.par, 0);
  }

  return 36;
}

function normalizeDistanceToMeters(distance: number, unit: string | null) {
  const normalizedUnit = normalizeCourseValue(unit ?? '');
  return normalizedUnit.startsWith('yd') || normalizedUnit.includes('yard')
    ? Math.round(distance * 0.9144)
    : Math.round(distance);
}

function extractDistanceEntries(rawHole: Record<string, unknown>, fallbackUnit: string | null) {
  const nestedArrayKeys = ['tees', 'tee_sets', 'teeSets', 'distances', 'yardages'];
  const nestedObjectKeys = ['distanceByTee', 'distances_by_tee', 'teeDistances', 'tee_distances'];
  const distanceByTee: Record<string, number> = {};

  for (const key of nestedArrayKeys) {
    const items = toArray(rawHole[key]);

    if (items.length === 0) {
      continue;
    }

    for (const item of items) {
      const tee = toObject(item);

      if (!tee) {
        continue;
      }

      const teeName = extractStringByKeys(tee, ['key', 'name', 'label', 'color', 'tee']) ?? extractStringByKeys(tee, ['id']);
      const distance = extractNumberByKeys(tee, ['distance_m', 'distance', 'meters', 'metres', 'yardage', 'yards']);

      if (!teeName || distance == null) {
        continue;
      }

      const unit = extractStringByKeys(tee, ['unit', 'distance_unit']) ?? fallbackUnit;
      distanceByTee[slugify(teeName)] = normalizeDistanceToMeters(distance, unit);
    }
  }

  for (const key of nestedObjectKeys) {
    const teeDistances = toObject(rawHole[key]);

    if (!teeDistances) {
      continue;
    }

    for (const [teeKey, rawDistance] of Object.entries(teeDistances)) {
      const distance = toNumberValue(rawDistance);

      if (distance == null) {
        continue;
      }

      distanceByTee[slugify(teeKey)] = normalizeDistanceToMeters(distance, fallbackUnit);
    }
  }

  return distanceByTee;
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function extractLatLng(source: unknown): { latitude: number; longitude: number } | null {
  const objectSource = toObject(source);

  if (objectSource) {
    const latitude = extractNumberByKeys(objectSource, ['latitude', 'lat', 'y']);
    const longitude = extractNumberByKeys(objectSource, ['longitude', 'lng', 'lon', 'long', 'x']);

    if (latitude != null && longitude != null && isValidLatitude(latitude) && isValidLongitude(longitude)) {
      return { latitude, longitude };
    }

    for (const key of ['coordinate', 'coordinates', 'location', 'position', 'center']) {
      const nestedLatLng = extractLatLng(objectSource[key]);

      if (nestedLatLng) {
        return nestedLatLng;
      }
    }
  }

  if (Array.isArray(source) && source.length >= 2) {
    const first = toNumberValue(source[0]);
    const second = toNumberValue(source[1]);

    if (first == null || second == null) {
      return null;
    }

    if (isValidLatitude(first) && isValidLongitude(second)) {
      return { latitude: first, longitude: second };
    }

    if (isValidLatitude(second) && isValidLongitude(first)) {
      return { latitude: second, longitude: first };
    }
  }

  return null;
}

function extractHoleNumber(source: Record<string, unknown> | null, fallbackHoleNumber?: number | null) {
  const rawHoleNumber = source
    ? extractNumberByKeys(source, ['hole_number', 'holeNumber', 'hole', 'number', 'ref'])
    : null;

  if (rawHoleNumber != null && rawHoleNumber > 0) {
    return Math.round(rawHoleNumber);
  }

  return fallbackHoleNumber ?? null;
}

function normalizeGpsPointType(value: string | null | undefined, fallback: GpsPointType = 'poi'): GpsPointType {
  const normalizedValue = normalizeCourseValue(value ?? '');

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue.includes('tee')) return 'tee';
  if (normalizedValue.includes('front')) return 'green_front';
  if (normalizedValue.includes('back')) return 'green_back';
  if (normalizedValue.includes('center') || normalizedValue.includes('centre') || normalizedValue.includes('middle')) return 'green_center';
  if (normalizedValue.includes('green')) return 'green_center';
  if (normalizedValue.includes('pin') || normalizedValue.includes('flag')) return 'pin';
  if (normalizedValue.includes('bunker') || normalizedValue.includes('sand')) return 'bunker';
  if (normalizedValue.includes('water') || normalizedValue.includes('lake') || normalizedValue.includes('pond')) return 'water';
  if (normalizedValue.includes('hazard') || normalizedValue.includes('obstacle')) return 'hazard';
  if (normalizedValue.includes('layup') || normalizedValue.includes('landing')) return 'layup';
  if (normalizedValue.includes('line') || normalizedValue.includes('path')) return 'centerline';

  return fallback;
}

function inferPointTypeFromKey(key: string, fallback: GpsPointType = 'poi') {
  return normalizeGpsPointType(key, fallback);
}

function extractTeeKey(source: Record<string, unknown> | null) {
  if (!source) {
    return null;
  }

  const teeValue = extractStringByKeys(source, ['tee_key', 'teeKey', 'tee', 'tee_name', 'teeName', 'color', 'colour']);
  return teeValue ? slugify(teeValue) : null;
}

function createGpsPoint(
  source: unknown,
  fallback: {
    holeNumber?: number | null;
    pointType?: GpsPointType;
    name?: string | null;
    sortOrder?: number;
    teeKey?: string | null;
  } = {}
): (CatalogGpsPoint & { holeNumber: number | null }) | null {
  const objectSource = toObject(source);
  const latLng = extractLatLng(source);

  if (!latLng) {
    return null;
  }

  const rawType = objectSource
    ? extractStringByKeys(objectSource, ['point_type', 'pointType', 'type', 'kind', 'category', 'name'])
    : null;
  const name = objectSource
    ? extractStringByKeys(objectSource, ['name', 'label', 'description'])
    : fallback.name ?? null;
  const teeKey = extractTeeKey(objectSource) ?? fallback.teeKey ?? null;

  return {
    providerPointId: objectSource ? extractStringByKeys(objectSource, ['id', 'point_id', 'pointId']) : null,
    pointType: normalizeGpsPointType(rawType ?? fallback.name ?? null, fallback.pointType ?? 'poi'),
    name,
    latitude: latLng.latitude,
    longitude: latLng.longitude,
    teeKey,
    distanceM: objectSource ? extractNumberByKeys(objectSource, ['distance_m', 'distanceM', 'meters', 'metres', 'distance']) : null,
    sortOrder: fallback.sortOrder ?? 0,
    source: 'provider',
    metadata: objectSource ? { provider: objectSource } : {},
    holeNumber: extractHoleNumber(objectSource, fallback.holeNumber),
  };
}

function collectGpsPoints(
  value: unknown,
  fallback: {
    holeNumber?: number | null;
    pointType?: GpsPointType;
    name?: string | null;
    sortOrder?: number;
    teeKey?: string | null;
  },
  depth = 0
): Array<CatalogGpsPoint & { holeNumber: number | null }> {
  if (depth > 3 || value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectGpsPoints(
      item,
      {
        ...fallback,
        sortOrder: fallback.sortOrder != null ? fallback.sortOrder + index : index,
      },
      depth + 1
    ));
  }

  const directPoint = createGpsPoint(value, fallback);
  const objectValue = toObject(value);
  const points = directPoint ? [directPoint] : [];

  if (!objectValue) {
    return points;
  }

  for (const [key, nestedValue] of Object.entries(objectValue)) {
    if (
      ![
        'front',
        'back',
        'center',
        'centre',
        'green',
        'greens',
        'pin',
        'flag',
        'tee',
        'tees',
        'tee_boxes',
        'teeBoxes',
        'hazards',
        'bunkers',
        'waters',
        'water',
        'layups',
        'landing_zones',
        'landingZones',
        'coordinates',
        'gps',
        'gps_points',
        'gpsPoints',
        'points',
        'pois',
        'features',
        'markers',
      ].includes(key)
    ) {
      continue;
    }

    points.push(...collectGpsPoints(
      nestedValue,
      {
        ...fallback,
        pointType: inferPointTypeFromKey(key, fallback.pointType ?? 'poi'),
        name: fallback.name ?? key,
      },
      depth + 1
    ));
  }

  return points;
}

function dedupeGpsPoints(points: Array<CatalogGpsPoint & { holeNumber?: number | null }>) {
  const seen = new Set<string>();
  const dedupedPoints: Array<CatalogGpsPoint & { holeNumber?: number | null }> = [];

  for (const point of points) {
    const key = [
      point.holeNumber ?? 'course',
      point.pointType,
      point.teeKey ?? '',
      point.name ?? '',
      point.latitude.toFixed(7),
      point.longitude.toFixed(7),
    ].join(':');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedPoints.push(point);
  }

  return dedupedPoints.map((point, index) => ({ ...point, sortOrder: point.sortOrder ?? index }));
}

function extractHoleGpsPoints(rawHole: Record<string, unknown>, holeNumber: number) {
  const pointContainers = [
    'coordinates',
    'gps',
    'gps_points',
    'gpsPoints',
    'points',
    'pois',
    'features',
    'markers',
    'tee_boxes',
    'teeBoxes',
    'tees',
    'green',
    'greens',
    'hazards',
    'bunkers',
    'waters',
    'layups',
    'landing_zones',
    'landingZones',
  ];
  const points = pointContainers.flatMap((key) => collectGpsPoints(
    rawHole[key],
    {
      holeNumber,
      pointType: inferPointTypeFromKey(key, 'poi'),
      name: key,
    }
  ));

  const directLatLng = extractLatLng(rawHole);

  if (directLatLng) {
    points.push({
      pointType: 'green_center',
      name: 'Green center',
      latitude: directLatLng.latitude,
      longitude: directLatLng.longitude,
      sortOrder: points.length,
      source: 'provider',
      metadata: {},
      holeNumber,
    });
  }

  return dedupeGpsPoints(points)
    .filter((point) => point.holeNumber == null || point.holeNumber === holeNumber)
    .map(({ holeNumber: _holeNumber, ...point }) => point);
}

function extractCourseGpsPoints(rawCourse: Record<string, unknown>) {
  const pointContainers = ['coordinates', 'gps', 'gps_points', 'gpsPoints', 'points', 'pois', 'features', 'markers'];

  return dedupeGpsPoints(pointContainers.flatMap((key) => collectGpsPoints(
    rawCourse[key],
    {
      pointType: inferPointTypeFromKey(key, 'poi'),
      name: key,
    }
  )));
}

function pickHoleAnchor(points: CatalogGpsPoint[]) {
  const preferredTypes: GpsPointType[] = ['green_center', 'pin', 'green_front', 'green_back', 'centerline', 'tee'];

  for (const type of preferredTypes) {
    const point = points.find((candidate) => candidate.pointType === type);

    if (point) {
      return point;
    }
  }

  return points[0] ?? null;
}

function normalizeProviderTee(rawTee: Record<string, unknown>, index: number) {
  const keySource = extractStringByKeys(rawTee, ['key', 'slug', 'name', 'label', 'color', 'id']) ?? `tee-${index + 1}`;
  const key = slugify(keySource);
  const label = extractStringByKeys(rawTee, ['name', 'label', 'key', 'color']) ?? keySource;

  return {
    id: buildTeeSetId(`provider:${GOLF_PROVIDER}`, `${key}-${index}`),
    providerTeeSetId: extractStringByKeys(rawTee, ['id', 'tee_id', 'teeId']),
    key,
    label,
    shortLabel: extractStringByKeys(rawTee, ['short_label', 'shortLabel']) ?? formatTeeShortLabel(label),
    color: extractStringByKeys(rawTee, ['color', 'colour']) ?? resolveTeeColor(key),
    totalDistance: extractNumberByKeys(rawTee, ['distance_m', 'total_distance_m', 'totalDistanceM', 'distance', 'yardage', 'yards']),
    courseRating: extractNumberByKeys(rawTee, ['course_rating', 'courseRating']),
    slopeRating: extractNumberByKeys(rawTee, ['slope_rating', 'slopeRating']),
    gender: extractStringByKeys(rawTee, ['gender']),
    sortOrder: extractNumberByKeys(rawTee, ['sort_order', 'sortOrder']) ?? index,
    metadata: {},
  } satisfies ProviderTeeOption;
}

function normalizeCourseSummary(rawCourse: Record<string, unknown>, clubContext: Record<string, unknown> | null): ProviderCourseSummary | null {
  const providerCourseId = extractStringByKeys(rawCourse, ['id', 'course_id', 'courseId']);

  if (!providerCourseId) {
    return null;
  }

  const holes = extractNumberByKeys(rawCourse, ['holes', 'number_of_holes', 'hole_count', 'holes_count']) ?? 18;
  const par18 = extractNumberByKeys(rawCourse, ['par', 'par18', 'par_18', 'total_par']);
  const par9 = extractNumberByKeys(rawCourse, ['par9', 'par_9']);

  return {
    id: buildCourseId(providerCourseId),
    provider: GOLF_PROVIDER,
    providerCourseId,
    providerClubId: extractStringByKeys(clubContext, ['id', 'club_id', 'clubId']),
    name: extractStringByKeys(rawCourse, ['name', 'course_name', 'courseName']) ?? 'Parcours',
    clubName: extractStringByKeys(clubContext, ['name', 'club_name', 'clubName']),
    city: extractStringByKeys(rawCourse, ['city']) ?? extractStringByKeys(clubContext, ['city']) ?? 'Ville non renseignée',
    region: extractStringByKeys(rawCourse, ['region', 'state']) ?? extractStringByKeys(clubContext, ['region', 'state']) ?? 'Région non renseignée',
    state: extractStringByKeys(rawCourse, ['state']) ?? extractStringByKeys(clubContext, ['state']),
    country: extractStringByKeys(rawCourse, ['country']) ?? extractStringByKeys(clubContext, ['country']),
    countryCode: extractStringByKeys(rawCourse, ['country_code', 'countryCode']) ?? extractStringByKeys(clubContext, ['country_code', 'countryCode']),
    holes,
    par18: par18 ?? (holes === 9 ? 36 : 72),
    par9: par9 ?? (holes === 9 ? (par18 ?? 36) : Math.round((par18 ?? 72) / 2)),
    latitude: extractNumberByKeys(rawCourse, ['latitude', 'lat']) ?? extractNumberByKeys(clubContext, ['latitude', 'lat']),
    longitude: extractNumberByKeys(rawCourse, ['longitude', 'lng', 'lon']) ?? extractNumberByKeys(clubContext, ['longitude', 'lng', 'lon']),
    metadata: {},
  };
}

function normalizeProviderCourseDetail(rawCoursePayload: unknown, fallbackSummary: ProviderCourseSummary | null) {
  const rawCourse = toObject(rawCoursePayload);

  if (!rawCourse) {
    throw new Error('Réponse provider course invalide.');
  }

  const summary = normalizeCourseSummary(rawCourse, null) ?? fallbackSummary;

  if (!summary) {
    throw new Error('Impossible de normaliser ce parcours provider.');
  }

  const fallbackUnit = extractStringByKeys(rawCourse, ['distance_unit', 'unit']);
  const rawTeeSets = extractArrayByKeys(rawCourse, ['tees', 'tee_sets', 'teeSets']).map((item) => toObject(item)).filter((item): item is Record<string, unknown> => item != null);
  const initialTeeOptions = rawTeeSets.map((rawTee, index) => normalizeProviderTee(rawTee, index));
  const rawHoles = extractArrayByKeys(rawCourse, ['holes', 'scorecard']).map((item) => toObject(item)).filter((item): item is Record<string, unknown> => item != null);
  const courseGpsPoints = extractCourseGpsPoints(rawCourse);

  const holeDetails: ProviderHoleDetail[] = rawHoles.map((rawHole, index) => {
    const holeNumber = extractNumberByKeys(rawHole, ['hole_number', 'holeNumber', 'number']) ?? index + 1;
    const par = clampInt(extractNumberByKeys(rawHole, ['par']), 3, 6, 4);
    const handicapIndex = extractNumberByKeys(rawHole, ['handicap_index', 'stroke_index', 'strokeIndex', 'hcp']) ?? null;
    const distanceByTee = extractDistanceEntries(rawHole, extractStringByKeys(rawHole, ['unit', 'distance_unit']) ?? fallbackUnit);
    const gpsPoints = [
      ...extractHoleGpsPoints(rawHole, holeNumber),
      ...courseGpsPoints
        .filter((point) => point.holeNumber === holeNumber)
        .map(({ holeNumber: _holeNumber, ...point }) => point),
    ];
    const anchor = pickHoleAnchor(gpsPoints);

    return {
      id: buildHoleId(summary.id, holeNumber),
      holeNumber,
      par,
      handicapIndex,
      distanceByTee,
      latitude: anchor?.latitude ?? null,
      longitude: anchor?.longitude ?? null,
      gpsPoints: dedupeGpsPoints(gpsPoints).map(({ holeNumber: _holeNumber, ...point }) => point),
    };
  }).filter((hole) => hole.holeNumber > 0);

  const teeKeysFromHoles = new Set<string>();

  for (const hole of holeDetails) {
    for (const teeKey of Object.keys(hole.distanceByTee)) {
      teeKeysFromHoles.add(teeKey);
    }
  }

  const teeOptions = initialTeeOptions.length > 0
    ? initialTeeOptions
    : [...teeKeysFromHoles].map((teeKey, index) => ({
        id: buildTeeSetId(summary.id, teeKey),
        providerTeeSetId: null,
        key: teeKey,
        label: teeKey.replace(/-/g, ' '),
        shortLabel: formatTeeShortLabel(teeKey),
        color: resolveTeeColor(teeKey),
        totalDistance: null,
        courseRating: null,
        slopeRating: null,
        gender: null,
        sortOrder: index,
        metadata: {},
      }));

  for (const teeOption of teeOptions) {
    if (teeOption.totalDistance == null && holeDetails.length > 0) {
      teeOption.totalDistance = holeDetails.reduce((sum, hole) => sum + (hole.distanceByTee[teeOption.key] ?? 0), 0) || null;
    }

    teeOption.id = buildTeeSetId(summary.id, teeOption.key);
  }

  const holes = extractNumberByKeys(rawCourse, ['holes', 'number_of_holes', 'hole_count']) ?? (holeDetails.length || summary.holes);
  const par18 = inferPar18(
    extractNumberByKeys(rawCourse, ['par', 'par18', 'par_18', 'total_par']) ?? summary.par18,
    extractNumberByKeys(rawCourse, ['par9', 'par_9']) ?? summary.par9,
    holes,
    holeDetails
  );
  const par9 = inferPar9(
    extractNumberByKeys(rawCourse, ['par9', 'par_9']) ?? summary.par9,
    par18,
    holes,
    holeDetails
  );

  return {
    ...summary,
    holes,
    par18,
    par9,
    teeOptions: teeOptions.sort((left, right) => {
      const leftDistance = left.totalDistance ?? null;
      const rightDistance = right.totalDistance ?? null;

      if (leftDistance != null && rightDistance != null && leftDistance !== rightDistance) {
        return rightDistance - leftDistance;
      }

      return left.sortOrder - right.sortOrder;
    }),
    holeDetails,
  } satisfies ProviderCourseDetail;
}

function mapCourseSummaryToRow(course: ProviderCourseSummary) {
  return {
    id: course.id,
    provider: course.provider,
    provider_course_id: course.providerCourseId,
    provider_club_id: course.providerClubId,
    name: course.name,
    club_name: course.clubName,
    city: course.city,
    region: course.region,
    state: course.state,
    country: course.country,
    country_code: course.countryCode,
    latitude: course.latitude,
    longitude: course.longitude,
    holes: clampInt(course.holes, 1, 54, 18),
    par18: clampInt(course.par18, 27, 108, 72),
    par9: clampInt(course.par9, 27, 54, 36),
    metadata: course.metadata,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertCourseSummaries(admin: ReturnType<typeof getAdminClient>, courses: ProviderCourseSummary[]) {
  if (courses.length === 0) {
    return;
  }

  const { error } = await admin.from('golf_courses').upsert(
    courses.map(mapCourseSummaryToRow),
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
}

async function upsertCourseDetail(admin: ReturnType<typeof getAdminClient>, course: ProviderCourseDetail) {
  const { error: courseError } = await admin.from('golf_courses').upsert(
    [mapCourseSummaryToRow(course)],
    { onConflict: 'id' }
  );

  if (courseError) {
    throw courseError;
  }

  const holeIds = course.holeDetails.map((hole) => hole.id);

  if (holeIds.length > 0) {
    const [{ error: deleteDistancesError }, { error: deleteGpsError }] = await Promise.all([
      admin.from('course_hole_tee_distances').delete().in('hole_id', holeIds),
      admin.from('course_hole_gps_points').delete().in('hole_id', holeIds),
    ]);

    if (deleteDistancesError) {
      throw deleteDistancesError;
    }

    if (deleteGpsError) {
      throw deleteGpsError;
    }
  }

  const { error: deleteHolesError } = await admin.from('course_holes').delete().eq('course_id', course.id);

  if (deleteHolesError) {
    throw deleteHolesError;
  }

  const { error: deleteTeesError } = await admin.from('course_tee_sets').delete().eq('course_id', course.id);

  if (deleteTeesError) {
    throw deleteTeesError;
  }

  if (course.teeOptions.length > 0) {
    const { error: teeInsertError } = await admin.from('course_tee_sets').insert(
      course.teeOptions.map((teeOption) => ({
        id: teeOption.id,
        course_id: course.id,
        provider_tee_set_id: teeOption.providerTeeSetId,
        key: teeOption.key,
        name: teeOption.label,
        short_label: teeOption.shortLabel,
        color: teeOption.color,
        gender: teeOption.gender,
        total_distance_m: teeOption.totalDistance,
        course_rating: teeOption.courseRating,
        slope_rating: teeOption.slopeRating,
        sort_order: teeOption.sortOrder,
        metadata: teeOption.metadata,
        updated_at: new Date().toISOString(),
      }))
    );

    if (teeInsertError) {
      throw teeInsertError;
    }
  }

  if (course.holeDetails.length > 0) {
    const { error: holeInsertError } = await admin.from('course_holes').insert(
      course.holeDetails.map((hole) => ({
        id: hole.id,
        course_id: course.id,
        hole_number: hole.holeNumber,
        par: hole.par,
        handicap_index: hole.handicapIndex,
        latitude: hole.latitude,
        longitude: hole.longitude,
        metadata: {},
        updated_at: new Date().toISOString(),
      }))
    );

    if (holeInsertError) {
      throw holeInsertError;
    }
  }

  const distanceRows = course.holeDetails.flatMap((hole) => (
    course.teeOptions.flatMap((teeOption) => {
      const distance = hole.distanceByTee[teeOption.key];

      return typeof distance === 'number'
        ? [{
            hole_id: hole.id,
            tee_set_id: teeOption.id!,
            distance_m: distance,
          }]
        : [];
    })
  ));

  if (distanceRows.length > 0) {
    const { error: distanceInsertError } = await admin.from('course_hole_tee_distances').insert(distanceRows);

    if (distanceInsertError) {
      throw distanceInsertError;
    }
  }

  const teeSetIdByKey = new Map(course.teeOptions.map((teeOption) => [teeOption.key, teeOption.id]));
  const gpsRows = course.holeDetails.flatMap((hole) => (
    hole.gpsPoints.map((point, index) => ({
      id: point.id ?? buildGpsPointId(hole.id, point, index),
      course_id: course.id,
      hole_id: hole.id,
      tee_set_id: point.teeKey ? teeSetIdByKey.get(point.teeKey) ?? null : null,
      provider_point_id: point.providerPointId ?? null,
      hole_number: hole.holeNumber,
      point_type: point.pointType,
      name: point.name ?? null,
      latitude: point.latitude,
      longitude: point.longitude,
      distance_m: point.distanceM ?? null,
      sort_order: point.sortOrder ?? index,
      source: point.source ?? course.provider,
      metadata: point.metadata ?? {},
      updated_at: new Date().toISOString(),
    }))
  ));

  if (gpsRows.length > 0) {
    const { error: gpsInsertError } = await admin.from('course_hole_gps_points').insert(gpsRows);

    if (gpsInsertError) {
      throw gpsInsertError;
    }
  }
}

function scoreCourse(course: CatalogCourse, query: string, queryTokens: string[]) {
  const normalizedName = normalizeCourseValue(course.name);
  const normalizedClubName = normalizeCourseValue(course.clubName ?? '');
  const normalizedCity = normalizeCourseValue(course.city);
  const normalizedRegion = normalizeCourseValue(course.region);
  const searchable = `${normalizedName} ${normalizedClubName} ${normalizedCity} ${normalizedRegion}`;

  let score = 0;

  if (normalizedName === query) score += 120;
  if (normalizedName.startsWith(query)) score += 80;
  if (normalizedClubName.startsWith(query)) score += 60;
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

async function searchLocalCourses(admin: ReturnType<typeof getAdminClient>, query: string, limit: number) {
  const sanitizedQuery = escapeLike(query);

  if (sanitizedQuery.length < 2) {
    return [] as CatalogCourse[];
  }

  const pattern = `%${sanitizedQuery}%`;
  const { data, error } = await admin
    .from('golf_courses')
    .select('id, provider, provider_course_id, provider_club_id, name, club_name, city, region, state, country, country_code, latitude, longitude, holes, par18, par9, last_synced_at')
    .or(`name.ilike.${pattern},club_name.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern}`)
    .limit(Math.max(limit * 4, 20));

  if (error) {
    throw error;
  }

  const normalizedQuery = normalizeCourseValue(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  return (data ?? [])
    .map((course) => ({
      id: course.id,
      name: course.name,
      city: course.city ?? 'Ville non renseignée',
      region: course.region ?? 'Région non renseignée',
      par18: course.par18 ?? 72,
      par9: course.par9 ?? 36,
      holes: course.holes ?? 18,
      clubName: course.club_name,
      country: course.country,
      countryCode: course.country_code,
      state: course.state,
      latitude: course.latitude,
      longitude: course.longitude,
      provider: course.provider,
      providerCourseId: course.provider_course_id,
      providerClubId: course.provider_club_id,
      lastSyncedAt: course.last_synced_at,
    } satisfies CatalogCourse))
    .map((course) => ({ course, score: scoreCourse(course, normalizedQuery, queryTokens) }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.course.name.localeCompare(right.course.name, 'fr');
    })
    .slice(0, limit)
    .map(({ course }) => course);
}

async function fetchProviderClubSearch(query: string, limit: number) {
  const payload = await providerFetch('/clubs', { name: query, limit });
  const root = toObject(payload);
  return extractArrayByKeys(root, ['clubs', 'data', 'results']).map((item) => toObject(item)).filter((item): item is Record<string, unknown> => item != null);
}

async function fetchProviderClubCourses(rawClub: Record<string, unknown>) {
  const providerClubId = extractStringByKeys(rawClub, ['id', 'club_id', 'clubId']);

  if (!providerClubId) {
    return [] as ProviderCourseSummary[];
  }

  const payload = await providerFetch(`/clubs/${providerClubId}`);
  const rawClubDetail = toObject(payload);
  const rawCourses = extractArrayByKeys(rawClubDetail, ['courses']).map((item) => toObject(item)).filter((item): item is Record<string, unknown> => item != null);

  return rawCourses
    .map((rawCourse) => normalizeCourseSummary(rawCourse, rawClubDetail ?? rawClub))
    .filter((course): course is ProviderCourseSummary => course != null);
}

async function syncProviderSearch(admin: ReturnType<typeof getAdminClient>, query: string, limit: number) {
  if (!GOLFAPI_KEY) {
    return false;
  }

  const rawClubs = await fetchProviderClubSearch(query, Math.min(Math.max(limit, 4), 8));
  const rawClubSubset = rawClubs.slice(0, 4);
  const courseBatches = await Promise.all(rawClubSubset.map((rawClub) => fetchProviderClubCourses(rawClub)));
  const courses = courseBatches.flat();

  await upsertCourseSummaries(admin, courses);
  return courses.length > 0;
}

function escapeOverpassRegex(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|"]/g, '\\$&');
}

async function overpassFetch(query: string) {
  const response = await fetch(OSM_OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
      'User-Agent': 'FairwayIQ/1.0 (+https://github.com/CelianGuillamet/FairwayIQ)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Overpass ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as { elements?: OverpassElement[] };
  return payload.elements ?? [];
}

function getOsmProviderCourseId(element: OverpassElement) {
  return `${element.type}/${element.id}`;
}

function parseOsmProviderCourseId(providerCourseId: string | null | undefined) {
  if (!providerCourseId) {
    return null;
  }

  const [type, rawId] = providerCourseId.split('/');
  const id = Number(rawId);

  if (!['node', 'way', 'relation'].includes(type) || !Number.isFinite(id)) {
    return null;
  }

  return { type: type as OverpassElement['type'], id };
}

function getOsmElementCenter(element: OverpassElement) {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { latitude: element.lat, longitude: element.lon };
  }

  if (typeof element.center?.lat === 'number' && typeof element.center?.lon === 'number') {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }

  if (element.geometry?.length) {
    const totals = element.geometry.reduce(
      (sum, point) => ({
        latitude: sum.latitude + point.lat,
        longitude: sum.longitude + point.lon,
      }),
      { latitude: 0, longitude: 0 }
    );

    return {
      latitude: totals.latitude / element.geometry.length,
      longitude: totals.longitude / element.geometry.length,
    };
  }

  if (
    typeof element.bounds?.minlat === 'number'
    && typeof element.bounds?.maxlat === 'number'
    && typeof element.bounds?.minlon === 'number'
    && typeof element.bounds?.maxlon === 'number'
  ) {
    return {
      latitude: (element.bounds.minlat + element.bounds.maxlat) / 2,
      longitude: (element.bounds.minlon + element.bounds.maxlon) / 2,
    };
  }

  return null;
}

function getOsmBoundsQuery(element: OverpassElement) {
  if (
    typeof element.bounds?.minlat === 'number'
    && typeof element.bounds?.maxlat === 'number'
    && typeof element.bounds?.minlon === 'number'
    && typeof element.bounds?.maxlon === 'number'
  ) {
    const margin = 0.006;
    return `${element.bounds.minlat - margin},${element.bounds.minlon - margin},${element.bounds.maxlat + margin},${element.bounds.maxlon + margin}`;
  }

  const center = getOsmElementCenter(element);

  if (!center) {
    return null;
  }

  const delta = Math.max(0.01, OSM_DEFAULT_RADIUS_METERS / 111_320);
  return `${center.latitude - delta},${center.longitude - delta},${center.latitude + delta},${center.longitude + delta}`;
}

function mapOsmCourseElementToSummary(element: OverpassElement): ProviderCourseSummary | null {
  const tags = element.tags ?? {};
  const name = toStringValue(tags.name);
  const center = getOsmElementCenter(element);

  if (!name || !center) {
    return null;
  }

  const providerCourseId = getOsmProviderCourseId(element);
  const holeCountRaw = tags['golf:course'] ?? tags.holes ?? tags['golf:holes'];
  const holes = toNumberValue(holeCountRaw?.replace?.('_hole', '')) ?? 18;
  const par18 = toNumberValue(tags['golf:par']) ?? (holes === 9 ? 36 : 72);

  return {
    id: buildCourseIdForProvider(OSM_PROVIDER, providerCourseId),
    provider: OSM_PROVIDER,
    providerCourseId,
    providerClubId: null,
    name,
    clubName: null,
    city: toStringValue(tags['addr:city']) ?? toStringValue(tags['is_in:city']) ?? 'Ville non renseignée',
    region: toStringValue(tags['addr:state']) ?? toStringValue(tags['addr:region']) ?? 'Région non renseignée',
    state: toStringValue(tags['addr:state']),
    country: toStringValue(tags['addr:country']),
    countryCode: toStringValue(tags['addr:country']),
    holes,
    par18,
    par9: holes === 9 ? par18 : Math.round(par18 / 2),
    latitude: center.latitude,
    longitude: center.longitude,
    metadata: {
      osm: {
        type: element.type,
        id: element.id,
        tags,
        bounds: element.bounds ?? null,
      },
      license: 'ODbL-1.0',
      attribution: 'OpenStreetMap contributors',
    },
  };
}

async function syncOpenStreetMapSearch(admin: ReturnType<typeof getAdminClient>, query: string, limit: number) {
  if (!OSM_SEARCH_ENABLED || query.trim().length < 3) {
    return false;
  }

  const overpassQuery = `
    [out:json][timeout:20];
    ${OSM_FRANCE_AREA}
    (
      nwr["leisure"="golf_course"]["name"~"${escapeOverpassRegex(query.trim())}",i](area.fr);
    );
    out tags center ${Math.min(Math.max(limit * 2, 8), 24)};
  `;
  const elements = await overpassFetch(overpassQuery);
  const courses = elements
    .map(mapOsmCourseElementToSummary)
    .filter((course): course is ProviderCourseSummary => course != null);

  await upsertCourseSummaries(admin, courses);
  return courses.length > 0;
}

function parseDistanceValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value.replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0]);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const normalizedValue = normalizeCourseValue(value);
  return normalizedValue.includes('yd') || normalizedValue.includes('yard')
    ? Math.round(numericValue * 0.9144)
    : Math.round(numericValue);
}

function mapOsmHoleElementToDetail(courseId: string, element: OverpassElement, fallbackIndex: number): ProviderHoleDetail | null {
  const tags = element.tags ?? {};
  const holeNumber = extractHoleNumber(tags, fallbackIndex + 1);

  if (!holeNumber) {
    return null;
  }

  const geometry = element.geometry?.filter((point) => isValidLatitude(point.lat) && isValidLongitude(point.lon)) ?? [];
  const distanceByTee = Object.entries(tags).reduce((distances, [key, value]) => {
    if (!key.startsWith('dist')) {
      return distances;
    }

    const distance = parseDistanceValue(value);

    if (distance == null) {
      return distances;
    }

    const [, teeName] = key.split(':');
    distances[teeName ? slugify(teeName) : 'default'] = distance;
    return distances;
  }, {} as Record<string, number>);
  const defaultDistance = parseDistanceValue(tags.dist ?? tags.distance);

  if (defaultDistance != null && Object.keys(distanceByTee).length === 0) {
    distanceByTee.default = defaultDistance;
  }

  const gpsPoints: CatalogGpsPoint[] = geometry.map((point, index) => {
    const isFirst = index === 0;
    const isLast = index === geometry.length - 1;

    return {
      pointType: isFirst ? 'tee' : isLast ? 'green_center' : 'centerline',
      name: isFirst ? 'Tee' : isLast ? 'Green center' : `Centerline ${index}`,
      latitude: point.lat,
      longitude: point.lon,
      sortOrder: index,
      source: OSM_PROVIDER,
      metadata: {
        osm: {
          type: element.type,
          id: element.id,
        },
      },
    };
  });
  const anchor = pickHoleAnchor(gpsPoints);

  return {
    id: buildHoleId(courseId, holeNumber),
    holeNumber,
    par: clampInt(toNumberValue(tags.par), 3, 6, 4),
    handicapIndex: toNumberValue(tags.handicap ?? tags.hcp ?? tags['stroke_index']),
    distanceByTee,
    latitude: anchor?.latitude ?? null,
    longitude: anchor?.longitude ?? null,
    gpsPoints,
  };
}

async function syncOpenStreetMapCourseDetail(
  admin: ReturnType<typeof getAdminClient>,
  existingCourse: CatalogCourse
) {
  if (!OSM_DETAIL_ENABLED || existingCourse.provider !== OSM_PROVIDER) {
    return existingCourse;
  }

  const osmCourseRef = parseOsmProviderCourseId(existingCourse.providerCourseId);

  if (!osmCourseRef) {
    return existingCourse;
  }

  const cacheKey = existingCourse.providerCourseId ?? existingCourse.id;

  if (await isNegativelyCached(admin, 'course', OSM_PROVIDER, cacheKey)) {
    return existingCourse;
  }

  const elementSelector =
    osmCourseRef.type === 'node'
      ? `node(${osmCourseRef.id})(area.fr);`
      : osmCourseRef.type === 'way'
        ? `way(${osmCourseRef.id})(area.fr);`
        : `relation(${osmCourseRef.id})(area.fr);`;
  const courseElements = await overpassFetch(`
    [out:json][timeout:20];
    ${OSM_FRANCE_AREA}
    ${elementSelector}
    out body geom;
  `);
  const courseElement = courseElements.find((element) => element.id === osmCourseRef.id && element.type === osmCourseRef.type);

  if (!courseElement) {
    await recordNegativeCache(admin, 'course', OSM_PROVIDER, cacheKey);
    return existingCourse;
  }

  const boundsQuery = getOsmBoundsQuery(courseElement);

  if (!boundsQuery) {
    return existingCourse;
  }

  const holeElements = await overpassFetch(`
    [out:json][timeout:20];
    ${OSM_FRANCE_AREA}
    (
      way["golf"="hole"](${boundsQuery})(area.fr);
    );
    out body geom;
  `);
  const holes = holeElements
    .map((element, index) => mapOsmHoleElementToDetail(existingCourse.id, element, index))
    .filter((hole): hole is ProviderHoleDetail => hole != null)
    .sort((left, right) => left.holeNumber - right.holeNumber);
  const summary = mapOsmCourseElementToSummary(courseElement);

  if (!summary || holes.length === 0) {
    return existingCourse;
  }

  const courseDetail: ProviderCourseDetail = {
    ...summary,
    holes: Math.max(summary.holes, holes.length),
    par18: holes.length >= 18 ? holes.slice(0, 18).reduce((sum, hole) => sum + hole.par, 0) : summary.par18,
    par9: holes.length >= 9 ? holes.slice(0, 9).reduce((sum, hole) => sum + hole.par, 0) : summary.par9,
    teeOptions: [],
    holeDetails: holes,
  };

  await upsertCourseDetail(admin, courseDetail);
  return await loadCourseDetailFromDb(admin, existingCourse.id);
}

async function loadCourseDetailFromDb(admin: ReturnType<typeof getAdminClient>, courseId: string) {
  const { data: courseRow, error: courseError } = await admin
    .from('golf_courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle();

  if (courseError) {
    throw courseError;
  }

  if (!courseRow) {
    return null;
  }

  const [{ data: teeRows, error: teeError }, { data: holeRows, error: holeError }] = await Promise.all([
    admin.from('course_tee_sets').select('*').eq('course_id', courseId).order('sort_order', { ascending: true }),
    admin.from('course_holes').select('*').eq('course_id', courseId).order('hole_number', { ascending: true }),
  ]);

  if (teeError) {
    throw teeError;
  }

  if (holeError) {
    throw holeError;
  }

  const holeIds = (holeRows ?? []).map((hole) => hole.id);
  let distanceRows: Array<{ hole_id: string; tee_set_id: string; distance_m: number }> = [];
  let gpsRows: Array<{
    id: string;
    hole_id: string;
    tee_set_id: string | null;
    provider_point_id: string | null;
    point_type: GpsPointType;
    name: string | null;
    latitude: number;
    longitude: number;
    distance_m: number | null;
    sort_order: number;
    source: string | null;
    metadata: Record<string, unknown> | null;
  }> = [];

  if (holeIds.length > 0) {
    const [{ data: distanceData, error: distanceError }, { data: gpsData, error: gpsError }] = await Promise.all([
      admin
        .from('course_hole_tee_distances')
        .select('hole_id, tee_set_id, distance_m')
        .in('hole_id', holeIds),
      admin
        .from('course_hole_gps_points')
        .select('id, hole_id, tee_set_id, provider_point_id, point_type, name, latitude, longitude, distance_m, sort_order, source, metadata')
        .in('hole_id', holeIds)
        .order('sort_order', { ascending: true }),
    ]);

    if (distanceError) {
      throw distanceError;
    }

    if (gpsError) {
      throw gpsError;
    }

    distanceRows = distanceData ?? [];
    gpsRows = gpsData ?? [];
  }

  const teeOptionById = new Map<string, CatalogTeeOption>();

  for (const teeRow of teeRows ?? []) {
    teeOptionById.set(teeRow.id, {
      id: teeRow.id,
      key: teeRow.key,
      label: teeRow.name,
      shortLabel: teeRow.short_label ?? formatTeeShortLabel(teeRow.name),
      color: teeRow.color ?? resolveTeeColor(teeRow.key),
      distanceOffset: resolveTeeDistanceOffset(teeRow.key),
      totalDistance: teeRow.total_distance_m,
      courseRating: toNumberValue(teeRow.course_rating),
      slopeRating: teeRow.slope_rating,
      gender: teeRow.gender,
      providerTeeSetId: teeRow.provider_tee_set_id,
      metadata: teeRow.metadata ?? {},
    });
  }

  const distanceByHoleId = new Map<string, Record<string, number>>();
  const gpsPointsByHoleId = new Map<string, CatalogGpsPoint[]>();

  for (const distanceRow of distanceRows ?? []) {
    const teeOption = teeOptionById.get(distanceRow.tee_set_id);

    if (!teeOption) {
      continue;
    }

    const currentDistances = distanceByHoleId.get(distanceRow.hole_id) ?? {};
    currentDistances[teeOption.key] = distanceRow.distance_m;
    distanceByHoleId.set(distanceRow.hole_id, currentDistances);
  }

  for (const gpsRow of gpsRows) {
    const currentGpsPoints = gpsPointsByHoleId.get(gpsRow.hole_id) ?? [];
    const teeOption = gpsRow.tee_set_id ? teeOptionById.get(gpsRow.tee_set_id) : null;

    currentGpsPoints.push({
      id: gpsRow.id,
      providerPointId: gpsRow.provider_point_id,
      pointType: gpsRow.point_type,
      name: gpsRow.name,
      latitude: gpsRow.latitude,
      longitude: gpsRow.longitude,
      teeKey: teeOption?.key ?? null,
      distanceM: gpsRow.distance_m,
      sortOrder: gpsRow.sort_order,
      source: gpsRow.source,
      metadata: gpsRow.metadata ?? {},
    });
    gpsPointsByHoleId.set(gpsRow.hole_id, currentGpsPoints);
  }

  const holeDetails: CatalogHoleDetail[] = (holeRows ?? []).map((holeRow) => ({
    holeNumber: holeRow.hole_number,
    par: holeRow.par,
    handicapIndex: holeRow.handicap_index ?? holeRow.hole_number,
    distanceByTee: distanceByHoleId.get(holeRow.id) ?? {},
    latitude: holeRow.latitude,
    longitude: holeRow.longitude,
    gpsPoints: gpsPointsByHoleId.get(holeRow.id) ?? [],
    unit: 'm',
  }));

  return {
    id: courseRow.id,
    name: courseRow.name,
    city: courseRow.city ?? 'Ville non renseignée',
    region: courseRow.region ?? 'Région non renseignée',
    par18: courseRow.par18 ?? 72,
    par9: courseRow.par9 ?? 36,
    holes: courseRow.holes ?? 18,
    clubName: courseRow.club_name,
    country: courseRow.country,
    countryCode: courseRow.country_code,
    state: courseRow.state,
    latitude: courseRow.latitude,
    longitude: courseRow.longitude,
    provider: courseRow.provider,
    providerCourseId: courseRow.provider_course_id,
    providerClubId: courseRow.provider_club_id,
    teeOptions: [...teeOptionById.values()],
    holeDetails,
    lastSyncedAt: courseRow.last_synced_at,
    metadata: courseRow.metadata ?? {},
  } satisfies CatalogCourse;
}

function isCatalogCourseComplete(course: CatalogCourse | null) {
  if (!course || !course.teeOptions?.length || !course.holeDetails?.length) {
    return false;
  }

  return course.holeDetails.every((hole) => course.teeOptions!.every((teeOption) => typeof hole.distanceByTee[teeOption.key] === 'number'));
}

function isCourseStale(course: CatalogCourse | null) {
  if (!course?.lastSyncedAt) {
    return true;
  }

  const syncedAt = new Date(course.lastSyncedAt).getTime();

  if (Number.isNaN(syncedAt)) {
    return true;
  }

  return Date.now() - syncedAt > COURSE_CATALOG_STALE_HOURS * 60 * 60 * 1000;
}

async function syncProviderCourseDetail(admin: ReturnType<typeof getAdminClient>, courseId: string, providerCourseId: string) {
  if (await isNegativelyCached(admin, 'course', GOLF_PROVIDER, providerCourseId)) {
    return await loadCourseDetailFromDb(admin, courseId);
  }

  let rawPayload: unknown;

  try {
    rawPayload = await providerFetch(`/courses/${encodeURIComponent(providerCourseId)}`);
  } catch (error) {
    if (!(error instanceof ProviderNotFoundError)) {
      throw error;
    }

    await recordNegativeCache(admin, 'course', GOLF_PROVIDER, providerCourseId);
    return await loadCourseDetailFromDb(admin, courseId);
  }

  const existingCourse = await loadCourseDetailFromDb(admin, courseId);
  const fallbackSummary = existingCourse
    ? {
        id: existingCourse.id,
        provider: existingCourse.provider ?? GOLF_PROVIDER,
        providerCourseId: existingCourse.providerCourseId ?? providerCourseId,
        providerClubId: existingCourse.providerClubId ?? null,
        name: existingCourse.name,
        clubName: existingCourse.clubName ?? null,
        city: existingCourse.city,
        region: existingCourse.region,
        state: existingCourse.state ?? null,
        country: existingCourse.country ?? null,
        countryCode: existingCourse.countryCode ?? null,
        holes: existingCourse.holes,
        par18: existingCourse.par18,
        par9: existingCourse.par9,
        latitude: existingCourse.latitude ?? null,
        longitude: existingCourse.longitude ?? null,
        metadata: existingCourse.metadata ?? {},
      } satisfies ProviderCourseSummary
    : null;
  const courseDetail = normalizeProviderCourseDetail(rawPayload, fallbackSummary);

  await upsertCourseDetail(admin, courseDetail);
  return await loadCourseDetailFromDb(admin, courseDetail.id);
}

function extractProviderCourseIdFromCatalogId(courseId: string) {
  const parts = courseId.split(':');
  return parts.length >= 3 ? parts[2] : null;
}

async function handleSearchCourses(admin: ReturnType<typeof getAdminClient>, payload: SearchCoursesRequest) {
  const query = payload.query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const limit = Math.min(Math.max(payload.limit ?? 8, 1), 12);
  const normalizedQuery = normalizeCourseValue(query);

  let localCourses = await searchLocalCourses(admin, query, limit);

  if (localCourses.length < limit && GOLFAPI_KEY && normalizedQuery.length >= 2) {
    const cached = await isNegativelyCached(admin, 'search', GOLF_PROVIDER, normalizedQuery);

    if (!cached) {
      try {
        const foundAny = await syncProviderSearch(admin, query, limit);

        if (!foundAny) {
          await recordNegativeCache(admin, 'search', GOLF_PROVIDER, normalizedQuery);
        }

        localCourses = await searchLocalCourses(admin, query, limit);
      } catch (error) {
        console.error('course-catalog: provider search failed', error);
      }
    }
  }

  if (localCourses.length < limit && OSM_SEARCH_ENABLED && normalizedQuery.length >= 3) {
    const cached = await isNegativelyCached(admin, 'search', OSM_PROVIDER, normalizedQuery);

    if (!cached) {
      try {
        const foundAny = await syncOpenStreetMapSearch(admin, query, limit);

        if (!foundAny) {
          await recordNegativeCache(admin, 'search', OSM_PROVIDER, normalizedQuery);
        }

        localCourses = await searchLocalCourses(admin, query, limit);
      } catch (error) {
        console.error('course-catalog: OSM search failed', error);
      }
    }
  }

  return jsonResponse(200, { courses: localCourses });
}

async function handleGetCourse(admin: ReturnType<typeof getAdminClient>, payload: GetCourseRequest) {
  const courseId = payload.courseId.trim();
  const requestedProvider = courseId.split(':')[0] || null;
  let course: CatalogCourse | null = await loadCourseDetailFromDb(admin, courseId);

  if (
    (!course || !isCatalogCourseComplete(course) || isCourseStale(course))
    && GOLFAPI_KEY
    && course?.provider !== OSM_PROVIDER
    && requestedProvider !== OSM_PROVIDER
  ) {
    const providerCourseId = course?.providerCourseId ?? extractProviderCourseIdFromCatalogId(courseId);

    if (providerCourseId) {
      if (!PROVIDER_COURSE_ID_PATTERN.test(providerCourseId)) {
        throw new ClientError(400, 'Identifiant de parcours invalide.');
      }

      course = await syncProviderCourseDetail(admin, courseId, providerCourseId);
    }
  }

  if (course?.provider === OSM_PROVIDER && (!course.holeDetails?.length || isCourseStale(course))) {
    course = await syncOpenStreetMapCourseDetail(admin, course);
  }

  return jsonResponse(200, { course });
}

function isSearchCoursesRequest(value: unknown): value is SearchCoursesRequest {
  return isObject(value)
    && value.action === 'search_courses'
    && typeof value.query === 'string';
}

function isGetCourseRequest(value: unknown): value is GetCourseRequest {
  return isObject(value)
    && value.action === 'get_course'
    && typeof value.courseId === 'string';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    const user = await resolveAuthenticatedUser(request);
    const admin = getAdminClient();

    await enforceRateLimit(admin, user.id);

    const payload = await request.json().catch(() => null) as unknown;

    if (isSearchCoursesRequest(payload)) {
      return await handleSearchCourses(admin, payload);
    }

    if (isGetCourseRequest(payload)) {
      return await handleGetCourse(admin, payload);
    }

    return jsonResponse(400, { error: 'Payload invalide.' });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return jsonResponse(429, { error: error.message });
    }

    if (error instanceof ClientError) {
      return jsonResponse(error.status, { error: error.message });
    }

    console.error('course-catalog: erreur inattendue', error);
    return jsonResponse(500, { error: GENERIC_ERROR_MESSAGE });
  }
});
