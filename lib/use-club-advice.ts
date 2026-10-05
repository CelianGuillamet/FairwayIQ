import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/auth';
import { useBagStore } from '../stores/bag';
import { adviseClub, type ClubAdvice } from './club-advice';

export function useClubAdvice(distanceM: number | null | undefined): ClubAdvice | null {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const distances = useBagStore((state) => state.distances);
  const load = useBagStore((state) => state.load);
  const hasDistance = distanceM != null;

  useEffect(() => {
    if (hasDistance && userId) {
      load(userId).catch(() => undefined);
    }
  }, [hasDistance, userId, load]);

  return useMemo(() => adviseClub(distanceM, distances), [distanceM, distances]);
}
