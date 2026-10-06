import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { onDrillCompleted, useDrillsStore } from '../stores/drills';
import { useRoundsStore } from '../stores/rounds';
import { awardAfterDrill, syncBadges } from './badge-awards';

export function useBadgeSync() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authLoading = useAuthStore((state) => state.loading);
  const roundsReady = useRoundsStore((state) => state.initialized && state.error === null);
  const drillsReady = useDrillsStore((state) => state.initialized);

  useEffect(() => onDrillCompleted((completion) => void awardAfterDrill(completion)), []);

  useEffect(() => {
    if (authLoading || !userId) return;
    void syncBadges();
  }, [authLoading, userId, roundsReady, drillsReady]);
}
