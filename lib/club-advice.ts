import { CLUBS, isValidCarry, type ClubDistances, type ClubId } from './bag';

export const MIN_CLUBS_FOR_ADVICE = 3;
const SHORT_MARGIN_M = 15;
const LONG_MARGIN_M = 10;
const LONGER_CLUB_TOLERANCE_M = 3;

export type ClubAdvice = {
  club: ClubId;
  label: string;
  carryM: number;
  // carry minus distance: negative means the club comes up short
  gapM: number;
};

export function adviseClub(
  distanceM: number | null | undefined,
  distances: ClubDistances,
): ClubAdvice | null {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM) || distanceM <= 0) {
    return null;
  }

  const bag = CLUBS.flatMap(({ id, label }) => {
    const carryM = distances[id];
    return isValidCarry(carryM) ? [{ club: id, label, carryM }] : [];
  });

  if (bag.length < MIN_CLUBS_FOR_ADVICE) {
    return null;
  }

  const carries = bag.map((entry) => entry.carryM);
  if (distanceM < Math.min(...carries) - SHORT_MARGIN_M || distanceM > Math.max(...carries) + LONG_MARGIN_M) {
    return null;
  }

  const closest = bag.reduce((best, entry) => {
    const gap = Math.abs(entry.carryM - distanceM);
    const bestGap = Math.abs(best.carryM - distanceM);
    return gap < bestGap || (gap === bestGap && entry.carryM > best.carryM) ? entry : best;
  });
  const pick = bag
    .filter((entry) => entry.carryM > closest.carryM && entry.carryM - closest.carryM <= LONGER_CLUB_TOLERANCE_M)
    .reduce((longest, entry) => (entry.carryM > longest.carryM ? entry : longest), closest);

  return { ...pick, gapM: Math.round(pick.carryM - distanceM) };
}

export function formatClubAdvice(advice: ClubAdvice, estimated: boolean) {
  const text = `Conseil : ${advice.label.toLowerCase()} (${advice.carryM} m)`;
  return estimated ? `${text}, à titre indicatif` : text;
}

export function describeClubAdvice(advice: ClubAdvice, estimated: boolean) {
  const text = `Conseil de club : ${advice.label.toLowerCase()}, ${advice.carryM} mètres`;
  return estimated ? `${text}, à titre indicatif` : text;
}

export function describeAdviceReadiness(clubCount: number) {
  if (clubCount <= 0) {
    return `Renseigne au moins ${MIN_CLUBS_FOR_ADVICE} clubs pour recevoir un conseil pendant tes rounds, quand la distance au green est connue.`;
  }

  if (clubCount < MIN_CLUBS_FOR_ADVICE) {
    return `Il en faut au moins ${MIN_CLUBS_FOR_ADVICE} pour recevoir un conseil pendant tes rounds.`;
  }

  return 'Le conseil s’affiche pendant un round, sous la distance au green.';
}
