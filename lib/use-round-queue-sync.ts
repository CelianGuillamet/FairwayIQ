import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/auth';
import { onQueuedRoundSent, useRoundQueueStore, type FlushReason } from '../stores/round-queue';
import { awardAfterRound } from './badge-awards';

export const FLUSH_INTERVAL_MS = 30_000;

type ConnectivityState = { isConnected?: boolean; isInternetReachable?: boolean | null };

export function isBackOnline(state: ConnectivityState) {
  return state.isConnected === true && state.isInternetReachable !== false;
}

// expo-network is a native module: a JS bundle running on a build that predates it must not crash at launch.
function subscribeToReconnection(onReconnected: () => void) {
  try {
    const Network = require('expo-network') as typeof import('expo-network');
    const subscription = Network.addNetworkStateListener((state) => {
      if (isBackOnline(state)) onReconnected();
    });

    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}

async function syncQueue(userId: string, reason: FlushReason) {
  await useRoundQueueStore.getState().load(userId);
  await useRoundQueueStore.getState().flush(reason);
}

export function useRoundQueueSync() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authLoading = useAuthStore((state) => state.loading);
  const hasPending = useRoundQueueStore((state) => state.entries.some((entry) => entry.status === 'pending'));

  useEffect(() => onQueuedRoundSent(({ round, scorecard }) => void awardAfterRound(round, scorecard)), []);

  useEffect(() => {
    if (authLoading || !userId) return;
    void syncQueue(userId, 'session');
  }, [authLoading, userId]);

  useEffect(() => {
    if (authLoading || !userId) return;

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncQueue(userId, 'foreground');
    });
    const unsubscribeNetwork = subscribeToReconnection(() => void syncQueue(userId, 'network'));

    return () => {
      appState.remove();
      unsubscribeNetwork();
    };
  }, [authLoading, userId]);

  useEffect(() => {
    if (!userId || !hasPending) return;

    const timer = setInterval(() => void syncQueue(userId, 'timer'), FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId, hasPending]);
}
