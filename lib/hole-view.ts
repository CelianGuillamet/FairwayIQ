import type { RoundDraftHole } from '../types';
import type { CourseHoleGpsPoint, GolfCourse, TeeKey, TeeOption } from './golf-courses';
import { getCourseHoleDetails, getDefaultTeeKey, getTeeOptions } from './golf-courses';

type HoleShape = 'straight' | 'dogleg-left' | 'dogleg-right';
type HoleHazard = 'bunker' | 'water' | 'trees';

export type HoleViewData = {
  holeNumber: number;
  par: number;
  handicapIndex: number;
  distanceByTee: Partial<Record<TeeKey, number>>;
  distanceSource: 'catalog' | 'generated';
  shape: HoleShape;
  hazards: HoleHazard[];
  difficultyLabel: string;
  summary: string;
  gpsPointCount: number;
  gpsAvailable: boolean;
  gpsPoints: CourseHoleGpsPoint[];
};

export type ScoreDescriptor = {
  label: string;
  diffLabel: string;
  tone: 'elite' | 'positive' | 'neutral' | 'warning' | 'danger';
};

const MIN_DISTANCE_BY_PAR = {
  3: 80,
  4: 250,
  5: 395,
  6: 520,
} as const;

const MAX_DISTANCE_BY_PAR = {
  3: 245,
  4: 490,
  5: 610,
  6: 670,
} as const;

function hashValue(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getSeedUnit(...values: Array<string | number | undefined | null>) {
  const key = values.join(':');
  return (hashValue(key) % 1000) / 999;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBaseYellowDistance(par: number, seed: number) {
  switch (par) {
    case 3:
      return 118 + Math.round(seed * 82);
    case 4:
      return 308 + Math.round(seed * 118);
    case 5:
      return 445 + Math.round(seed * 105);
    case 6:
      return 560 + Math.round(seed * 80);
    default:
      return 340;
  }
}

function buildDistanceByTee(courseKey: string, hole: RoundDraftHole, teeOptions: TeeOption[]): Partial<Record<TeeKey, number>> {
  const baseSeed = getSeedUnit(courseKey, hole.hole_number, hole.par);
  const baseDistance = getBaseYellowDistance(hole.par, baseSeed);

  return teeOptions.reduce((distances, teeOption) => {
    const perTeeSeed = getSeedUnit(courseKey, hole.hole_number, hole.par, teeOption.key);
    const variation = Math.round((perTeeSeed - 0.5) * 10);
    const minDistance = MIN_DISTANCE_BY_PAR[hole.par as keyof typeof MIN_DISTANCE_BY_PAR] ?? 80;
    const maxDistance = MAX_DISTANCE_BY_PAR[hole.par as keyof typeof MAX_DISTANCE_BY_PAR] ?? 670;

    return {
      ...distances,
      [teeOption.key]: clamp(baseDistance + teeOption.distanceOffset + variation, minDistance, maxDistance),
    };
  }, {} as Partial<Record<TeeKey, number>>);
}

function buildShape(courseKey: string, holeNumber: number): HoleShape {
  const seed = getSeedUnit(courseKey, holeNumber, 'shape');

  if (seed < 0.34) {
    return 'dogleg-left';
  }

  if (seed > 0.67) {
    return 'dogleg-right';
  }

  return 'straight';
}

function buildHazards(courseKey: string, hole: RoundDraftHole) {
  const hazardSeed = getSeedUnit(courseKey, hole.hole_number, hole.par, 'hazards');
  const hazards: HoleHazard[] = ['bunker'];

  if (hole.par > 3 && hazardSeed > 0.42) {
    hazards.push('water');
  }

  if (hazardSeed > 0.62) {
    hazards.push('trees');
  }

  return [...new Set(hazards)].slice(0, 3);
}

function getDistanceForTee(distanceByTee: Partial<Record<TeeKey, number>>, teeKey: TeeKey) {
  return distanceByTee[teeKey] ?? Object.values(distanceByTee).find((distance) => typeof distance === 'number') ?? 0;
}

function buildDifficultyScore(
  distanceByTee: Partial<Record<TeeKey, number>>,
  defaultTeeKey: TeeKey,
  shape: HoleShape,
  hazards: HoleHazard[],
  par: number
) {
  const selectedDistance = getDistanceForTee(distanceByTee, defaultTeeKey);
  const shapeWeight = shape === 'straight' ? 0 : 18;
  const hazardWeight = hazards.length * 12;

  return selectedDistance + shapeWeight + hazardWeight + par * 18;
}

function getDifficultyLabel(rank: number, holeCount: number) {
  if (rank <= Math.ceil(holeCount / 3)) {
    return 'Exigeant';
  }

  if (rank >= holeCount - Math.ceil(holeCount / 3) + 1) {
    return 'Accessible';
  }

  return 'Équilibré';
}

function buildSummary(par: number, shape: HoleShape, hazards: HoleHazard[]) {
  const shapeLabel =
    shape === 'dogleg-left'
      ? 'dogleg gauche'
      : shape === 'dogleg-right'
        ? 'dogleg droite'
        : 'ligne directe';

  const strategyLabel =
    par >= 5
      ? 'gestion du placement'
      : par === 3
        ? 'attaque de green'
        : 'mise en jeu solide';

  return `${shapeLabel} · ${strategyLabel}${hazards.includes('water') ? ' · eau en jeu' : ''}`;
}

export function buildHoleViewData(input: {
  course: GolfCourse | null;
  scorecard: RoundDraftHole[];
}) {
  const courseKey = input.course?.id ?? input.course?.name ?? 'custom-course';
  const teeOptions = getTeeOptions(input.course);
  const defaultTeeKey = getDefaultTeeKey(input.course);
  const courseHoleDetails = input.course
    ? getCourseHoleDetails(input.course, input.scorecard.length === 9 ? 9 : 18)
    : null;

  const baseViews = input.scorecard.map((hole) => {
    const courseHoleDetail = courseHoleDetails?.find((detail) => detail.holeNumber === hole.hole_number) ?? null;
    const gpsPoints = courseHoleDetail?.gpsPoints ?? [];
    const gpsPointCount = gpsPoints.length;
    const generatedDistances = buildDistanceByTee(courseKey, hole, teeOptions);
    const hasCompleteCatalogDistances = courseHoleDetail
      ? teeOptions.every((teeOption) => typeof courseHoleDetail.distanceByTee[teeOption.key] === 'number')
      : false;
    const distanceByTee = courseHoleDetail?.distanceByTee
      ? teeOptions.reduce((distances, teeOption) => ({
          ...distances,
          [teeOption.key]: courseHoleDetail.distanceByTee[teeOption.key] ?? generatedDistances[teeOption.key],
        }), {} as Partial<Record<TeeKey, number>>)
      : generatedDistances;
    const shape = buildShape(courseKey, hole.hole_number);
    const hazards = buildHazards(courseKey, hole);

    return {
      holeNumber: hole.hole_number,
      par: courseHoleDetail?.par ?? hole.par,
      handicapIndex: courseHoleDetail?.handicapIndex ?? hole.hole_number,
      hasCatalogHandicap: !!courseHoleDetail,
      distanceByTee,
      distanceSource: hasCompleteCatalogDistances ? 'catalog' as const : 'generated' as const,
      shape,
      hazards,
      difficultyLabel: 'Équilibré',
      summary: buildSummary(courseHoleDetail?.par ?? hole.par, shape, hazards),
      gpsPointCount,
      gpsAvailable: gpsPointCount > 0 || (courseHoleDetail?.latitude != null && courseHoleDetail?.longitude != null),
      gpsPoints,
      difficultyScore: buildDifficultyScore(distanceByTee, defaultTeeKey, shape, hazards, courseHoleDetail?.par ?? hole.par),
    };
  });

  const rankedByDifficulty = [...baseViews]
    .sort((left, right) => right.difficultyScore - left.difficultyScore)
    .map((hole) => hole.holeNumber);

  return baseViews.map((hole) => {
    const handicapIndex = hole.hasCatalogHandicap
      ? hole.handicapIndex
      : rankedByDifficulty.indexOf(hole.holeNumber) + 1;

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      handicapIndex,
      distanceByTee: hole.distanceByTee,
      distanceSource: hole.distanceSource,
      shape: hole.shape,
      hazards: hole.hazards,
      difficultyLabel: getDifficultyLabel(handicapIndex, baseViews.length),
      summary: hole.summary,
      gpsPointCount: hole.gpsPointCount,
      gpsAvailable: hole.gpsAvailable,
      gpsPoints: hole.gpsPoints,
    } satisfies HoleViewData;
  });
}

export function getScoreDescriptor(score: number, par: number): ScoreDescriptor {
  const diff = score - par;

  if (diff <= -2) {
    return {
      label: par === 3 && score === 1 ? 'Hole-in-one' : 'Eagle ou mieux',
      diffLabel: `${diff}`,
      tone: 'elite',
    };
  }

  if (diff === -1) {
    return {
      label: 'Birdie',
      diffLabel: '-1',
      tone: 'positive',
    };
  }

  if (diff === 0) {
    return {
      label: 'Par',
      diffLabel: 'E',
      tone: 'neutral',
    };
  }

  if (diff === 1) {
    return {
      label: 'Bogey',
      diffLabel: '+1',
      tone: 'warning',
    };
  }

  if (diff === 2) {
    return {
      label: 'Double bogey',
      diffLabel: '+2',
      tone: 'danger',
    };
  }

  return {
    label: diff > 2 ? `+${diff}` : `${diff}`,
    diffLabel: diff > 0 ? `+${diff}` : `${diff}`,
    tone: diff > 0 ? 'danger' : 'elite',
  };
}

export function getQuickScoreOptions(par: number) {
  const rawScores = [Math.max(1, par - 1), par, par + 1, par + 2];
  return [...new Set(rawScores)].map((score) => ({
    score,
    ...getScoreDescriptor(score, par),
  }));
}
