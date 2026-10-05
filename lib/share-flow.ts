export type ShareOutcome = 'done' | 'unavailable' | 'capture-failed' | 'share-failed';

type ShareFlowDeps = {
  isAvailable: () => Promise<boolean>;
  capture: () => Promise<string>;
  share: (uri: string) => Promise<void>;
  onCaptured?: () => void;
};

export type ShareAlert = {
  title: string;
  message: string;
};

const ALERTS: Record<Exclude<ShareOutcome, 'done'>, ShareAlert> = {
  unavailable: {
    title: 'Partage indisponible',
    message: 'Le partage n’est pas disponible sur cet appareil.',
  },
  'capture-failed': {
    title: 'Image non créée',
    message: 'La carte n’a pas pu être créée. Réessaie dans un instant.',
  },
  'share-failed': {
    title: 'Partage impossible',
    message: 'Le partage n’a pas pu s’ouvrir. Réessaie dans un instant.',
  },
};

export function getShareAlert(outcome: ShareOutcome): ShareAlert | null {
  return outcome === 'done' ? null : ALERTS[outcome];
}

export async function runShareFlow({ isAvailable, capture, share, onCaptured }: ShareFlowDeps): Promise<ShareOutcome> {
  try {
    if (!(await isAvailable())) return 'unavailable';
  } catch {
    return 'unavailable';
  }

  let uri: string;

  try {
    uri = await capture();
  } catch {
    return 'capture-failed';
  }

  // expo-sharing never settles when the user opens an activity then cancels it, so the busy state must not wait for it.
  onCaptured?.();

  try {
    await share(uri);
    return 'done';
  } catch {
    return 'share-failed';
  }
}
