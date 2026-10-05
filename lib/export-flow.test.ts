import { ExportFetchError } from './data-export';
import type { ExportFile } from './export-document';
import { getExportAlert, runExportFlow, type ExportOutcome } from './export-flow';

const FILE: ExportFile = {
  name: 'fairwayiq-donnees-2026-10-05.json',
  content: '{}\n',
  mimeType: 'application/json',
  uti: 'public.json',
};

function deps(overrides: Partial<Parameters<typeof runExportFlow>[0]> = {}) {
  return {
    isAvailable: jest.fn().mockResolvedValue(true),
    prepare: jest.fn().mockResolvedValue(FILE),
    shouldContinue: jest.fn().mockReturnValue(true),
    write: jest.fn().mockReturnValue('file:///cache/fairwayiq-export/export.json'),
    share: jest.fn().mockResolvedValue(undefined),
    onWritten: jest.fn(),
    report: jest.fn(),
    ...overrides,
  };
}

describe('runExportFlow', () => {
  it('prepares, writes then shares the written file', async () => {
    const calls = deps();

    await expect(runExportFlow(calls)).resolves.toBe('done');
    expect(calls.write).toHaveBeenCalledWith(FILE);
    expect(calls.share).toHaveBeenCalledWith('file:///cache/fairwayiq-export/export.json', FILE);
    expect(calls.onWritten).toHaveBeenCalledTimes(1);
    expect(calls.report).not.toHaveBeenCalled();
  });

  it('accepts an asynchronous writer', async () => {
    const calls = deps({ write: jest.fn().mockResolvedValue('file:///cache/async.json') });

    await expect(runExportFlow(calls)).resolves.toBe('done');
    expect(calls.share).toHaveBeenCalledWith('file:///cache/async.json', FILE);
  });

  it('does not fetch anything when sharing is unavailable', async () => {
    const calls = deps({ isAvailable: jest.fn().mockResolvedValue(false) });

    await expect(runExportFlow(calls)).resolves.toBe('unavailable');
    expect(calls.prepare).not.toHaveBeenCalled();
    expect(calls.write).not.toHaveBeenCalled();
    expect(calls.share).not.toHaveBeenCalled();
  });

  it('treats a failing availability check as unavailable', async () => {
    const calls = deps({ isAvailable: jest.fn().mockRejectedValue(new Error('boom')) });

    await expect(runExportFlow(calls)).resolves.toBe('unavailable');
    expect(calls.prepare).not.toHaveBeenCalled();
  });

  it.each([
    ['network', 'offline'],
    ['session', 'session'],
    ['unknown', 'fetch-failed'],
  ] as const)('maps a %s fetch failure to %s without writing', async (kind, outcome) => {
    const failure = new ExportFetchError(kind, 'rounds');
    const calls = deps({ prepare: jest.fn().mockRejectedValue(failure) });

    await expect(runExportFlow(calls)).resolves.toBe(outcome);
    expect(calls.report).toHaveBeenCalledWith('prepare', failure);
    expect(calls.write).not.toHaveBeenCalled();
    expect(calls.share).not.toHaveBeenCalled();
    expect(calls.onWritten).not.toHaveBeenCalled();
  });

  it('classifies a raw network error thrown while preparing', async () => {
    const calls = deps({ prepare: jest.fn().mockRejectedValue(new TypeError('Network request failed')) });

    await expect(runExportFlow(calls)).resolves.toBe('offline');
  });

  it('reports an unexpected error while preparing as a failed export', async () => {
    const calls = deps({ prepare: jest.fn().mockRejectedValue(new Error('bug')) });

    await expect(runExportFlow(calls)).resolves.toBe('fetch-failed');
  });

  it('reports an empty export without writing', async () => {
    const calls = deps({ prepare: jest.fn().mockResolvedValue(null) });

    await expect(runExportFlow(calls)).resolves.toBe('empty');
    expect(calls.write).not.toHaveBeenCalled();
  });

  it('stops quietly when the person left the screen while fetching', async () => {
    const calls = deps({ shouldContinue: jest.fn().mockReturnValue(false) });

    await expect(runExportFlow(calls)).resolves.toBe('cancelled');
    expect(calls.write).not.toHaveBeenCalled();
    expect(calls.share).not.toHaveBeenCalled();
  });

  it('reports a write failure without opening the share sheet', async () => {
    const failure = new Error('No space left on device');
    const calls = deps({
      write: jest.fn(() => {
        throw failure;
      }),
    });

    await expect(runExportFlow(calls)).resolves.toBe('write-failed');
    expect(calls.report).toHaveBeenCalledWith('write', failure);
    expect(calls.share).not.toHaveBeenCalled();
    expect(calls.onWritten).not.toHaveBeenCalled();
  });

  it('reports a rejected asynchronous write the same way', async () => {
    const calls = deps({ write: jest.fn().mockRejectedValue(new Error('disk')) });

    await expect(runExportFlow(calls)).resolves.toBe('write-failed');
  });

  it('reports a share failure after the file was written', async () => {
    const failure = new Error('no view controller');
    const calls = deps({ share: jest.fn().mockRejectedValue(failure) });

    await expect(runExportFlow(calls)).resolves.toBe('share-failed');
    expect(calls.report).toHaveBeenCalledWith('share', failure);
    expect(calls.onWritten).toHaveBeenCalledTimes(1);
  });

  it('frees the busy state before the share sheet settles', async () => {
    const order: string[] = [];
    const calls = deps({
      onWritten: jest.fn(() => order.push('written')),
      share: jest.fn(() => {
        order.push('share');
        return new Promise<void>(() => undefined);
      }),
    });

    void runExportFlow(calls);
    await new Promise((resolve) => setImmediate(resolve));

    expect(order).toEqual(['written', 'share']);
  });

  it('works without the optional callbacks', async () => {
    const { onWritten, report, ...required } = deps();
    void onWritten;
    void report;

    await expect(runExportFlow(required)).resolves.toBe('done');
    await expect(runExportFlow({ ...required, write: () => { throw new Error('x'); } })).resolves.toBe('write-failed');
  });
});

describe('getExportAlert', () => {
  const OUTCOMES: ExportOutcome[] = [
    'done',
    'cancelled',
    'unavailable',
    'empty',
    'offline',
    'session',
    'fetch-failed',
    'write-failed',
    'share-failed',
  ];

  it('stays silent when the export went through or the person dismissed it', () => {
    expect(getExportAlert('done')).toBeNull();
    expect(getExportAlert('cancelled')).toBeNull();
  });

  it('gives every failure a French title and message', () => {
    for (const outcome of OUTCOMES.filter((entry) => entry !== 'done' && entry !== 'cancelled')) {
      const alert = getExportAlert(outcome);

      expect(alert).not.toBeNull();
      expect(alert?.title.length).toBeGreaterThan(0);
      expect(alert?.message.length).toBeGreaterThan(0);
    }
  });

  it('never shows a raw error, a status code or an English message', () => {
    for (const outcome of OUTCOMES) {
      const alert = getExportAlert(outcome);
      const text = `${alert?.title ?? ''} ${alert?.message ?? ''}`;

      expect(text).not.toMatch(/error|exception|undefined|null|PGRST|JWT|network request|supabase|\d{3}/i);
    }
  });

  it('keeps the share wording used by the share card', () => {
    expect(getExportAlert('unavailable')).toEqual({
      title: 'Partage indisponible',
      message: 'Le partage n’est pas disponible sur cet appareil.',
    });
    expect(getExportAlert('share-failed')?.title).toBe('Partage impossible');
  });

  it('tells a network problem apart from an expired session', () => {
    expect(getExportAlert('offline')?.message).toContain('réseau');
    expect(getExportAlert('session')?.message).toContain('Reconnecte-toi');
    expect(getExportAlert('offline')).not.toEqual(getExportAlert('fetch-failed'));
  });
});
