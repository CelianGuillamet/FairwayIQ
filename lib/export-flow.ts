import { ExportFetchError, classifyFetchFailure } from './data-export';
import type { ExportFile } from './export-document';
import { getShareAlert, type ShareAlert } from './share-flow';

export type ExportOutcome =
  | 'done'
  | 'cancelled'
  | 'unavailable'
  | 'empty'
  | 'offline'
  | 'session'
  | 'fetch-failed'
  | 'write-failed'
  | 'share-failed';

export type ExportStage = 'prepare' | 'write' | 'share';

type ExportFlowDeps = {
  isAvailable: () => Promise<boolean>;
  prepare: () => Promise<ExportFile | null>;
  shouldContinue: () => boolean;
  write: (file: ExportFile) => string | Promise<string>;
  share: (uri: string, file: ExportFile) => Promise<void>;
  onWritten?: () => void;
  report?: (stage: ExportStage, error: unknown) => void;
};

const ALERTS: Record<'empty' | 'offline' | 'session' | 'fetch-failed' | 'write-failed', ShareAlert> = {
  empty: {
    title: 'Aucun round',
    message: 'Tu n’as pas encore de round à exporter.',
  },
  offline: {
    title: 'Connexion impossible',
    message: 'Vérifie ton réseau puis réessaie.',
  },
  session: {
    title: 'Session expirée',
    message: 'Reconnecte-toi puis réessaie.',
  },
  'fetch-failed': {
    title: 'Export impossible',
    message: 'Ton export n’a pas pu être préparé. Réessaie dans un instant.',
  },
  'write-failed': {
    title: 'Fichier non créé',
    message: 'Le fichier n’a pas pu être créé sur ton téléphone. Vérifie l’espace disponible puis réessaie.',
  },
};

// Nothing to say when the person dismissed the share sheet or left the screen.
export function getExportAlert(outcome: ExportOutcome): ShareAlert | null {
  if (outcome === 'done' || outcome === 'cancelled') return null;
  if (outcome === 'unavailable' || outcome === 'share-failed') return getShareAlert(outcome);
  return ALERTS[outcome];
}

function prepareFailure(error: unknown): ExportOutcome {
  const kind = error instanceof ExportFetchError ? error.kind : classifyFetchFailure(error);
  return kind === 'network' ? 'offline' : kind === 'session' ? 'session' : 'fetch-failed';
}

export async function runExportFlow({
  isAvailable,
  prepare,
  shouldContinue,
  write,
  share,
  onWritten,
  report,
}: ExportFlowDeps): Promise<ExportOutcome> {
  try {
    if (!(await isAvailable())) return 'unavailable';
  } catch {
    return 'unavailable';
  }

  let file: ExportFile | null;

  try {
    file = await prepare();
  } catch (error) {
    report?.('prepare', error);
    return prepareFailure(error);
  }

  if (!shouldContinue()) return 'cancelled';
  if (!file) return 'empty';

  let uri: string;

  try {
    uri = await write(file);
  } catch (error) {
    report?.('write', error);
    return 'write-failed';
  }

  // expo-sharing never settles when the user opens an activity then cancels it, so the busy state must not wait for it.
  onWritten?.();

  try {
    await share(uri, file);
    return 'done';
  } catch (error) {
    report?.('share', error);
    return 'share-failed';
  }
}
