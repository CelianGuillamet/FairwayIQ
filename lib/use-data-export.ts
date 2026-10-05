import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../stores/auth';
import { prepareExport } from './data-export';
import { writeExportFile } from './export-files';
import { getExportAlert, runExportFlow } from './export-flow';
import type { ExportKind } from './export-document';
import { supabase } from './supabase';

type DataExport = {
  start: (kind: ExportKind) => Promise<void>;
  running: ExportKind | null;
};

export function useDataExport(): DataExport {
  const user = useAuthStore((state) => state.user);
  const [running, setRunning] = useState<ExportKind | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(
    async (kind: ExportKind) => {
      if (!user || inFlight.current) return;

      const userId = user.id;
      let released = false;

      const release = () => {
        if (released) return;
        released = true;
        inFlight.current = false;
        if (mounted.current) setRunning(null);
      };

      inFlight.current = true;
      setRunning(kind);

      try {
        const outcome = await runExportFlow({
          isAvailable: Sharing.isAvailableAsync,
          prepare: () =>
            prepareExport(
              supabase,
              kind,
              { id: userId, email: user.email ?? null },
              { now: new Date(), appVersion: Constants.expoConfig?.version ?? null },
            ),
          shouldContinue: () => mounted.current && useAuthStore.getState().user?.id === userId,
          write: writeExportFile,
          share: (uri, file) =>
            Sharing.shareAsync(uri, {
              mimeType: file.mimeType,
              UTI: file.uti,
              dialogTitle: 'Exporter mes données',
            }),
          onWritten: release,
          report: (stage, error) =>
            console.warn('[data-export] Export failed', {
              stage,
              message: error instanceof Error ? error.message : String(error),
            }),
        });
        const alert = getExportAlert(outcome);

        if (alert && mounted.current) Alert.alert(alert.title, alert.message);
      } finally {
        release();
      }
    },
    [user],
  );

  return { start, running };
}
