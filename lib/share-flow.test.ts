import { getShareAlert, runShareFlow } from './share-flow';

function deps(overrides: Partial<Parameters<typeof runShareFlow>[0]> = {}) {
  return {
    isAvailable: jest.fn().mockResolvedValue(true),
    capture: jest.fn().mockResolvedValue('file:///cache/card.png'),
    share: jest.fn().mockResolvedValue(undefined),
    onCaptured: jest.fn(),
    ...overrides,
  };
}

describe('runShareFlow', () => {
  it('captures then opens the share sheet with the captured file', async () => {
    const calls = deps();

    await expect(runShareFlow(calls)).resolves.toBe('done');
    expect(calls.share).toHaveBeenCalledWith('file:///cache/card.png');
    expect(calls.onCaptured).toHaveBeenCalledTimes(1);
  });

  it('does not capture when sharing is unavailable', async () => {
    const calls = deps({ isAvailable: jest.fn().mockResolvedValue(false) });

    await expect(runShareFlow(calls)).resolves.toBe('unavailable');
    expect(calls.capture).not.toHaveBeenCalled();
    expect(calls.share).not.toHaveBeenCalled();
  });

  it('treats a failing availability check as unavailable', async () => {
    const calls = deps({ isAvailable: jest.fn().mockRejectedValue(new Error('boom')) });

    await expect(runShareFlow(calls)).resolves.toBe('unavailable');
  });

  it('reports a capture failure without opening the share sheet', async () => {
    const calls = deps({ capture: jest.fn().mockRejectedValue(new Error('The view cannot be captured')) });

    await expect(runShareFlow(calls)).resolves.toBe('capture-failed');
    expect(calls.share).not.toHaveBeenCalled();
    expect(calls.onCaptured).not.toHaveBeenCalled();
  });

  it('reports a share failure once the image exists', async () => {
    const calls = deps({ share: jest.fn().mockRejectedValue(new Error('no view controller')) });

    await expect(runShareFlow(calls)).resolves.toBe('share-failed');
    expect(calls.onCaptured).toHaveBeenCalledTimes(1);
  });

  it('frees the caller as soon as the image is captured, before the share sheet settles', async () => {
    const calls = deps({ share: jest.fn(() => new Promise<void>(() => undefined)) });
    void runShareFlow(calls);
    await new Promise((resolve) => setImmediate(resolve));

    expect(calls.share).toHaveBeenCalled();
    expect(calls.onCaptured).toHaveBeenCalledTimes(1);
  });
});

describe('getShareAlert', () => {
  it('stays silent when the share went through or was dismissed', () => {
    expect(getShareAlert('done')).toBeNull();
  });

  it('explains each failure in French without leaking a raw error', () => {
    expect(getShareAlert('unavailable')).toEqual({
      title: 'Partage indisponible',
      message: 'Le partage n’est pas disponible sur cet appareil.',
    });
    expect(getShareAlert('capture-failed')).toEqual({
      title: 'Image non créée',
      message: 'La carte n’a pas pu être créée. Réessaie dans un instant.',
    });
    expect(getShareAlert('share-failed')).toEqual({
      title: 'Partage impossible',
      message: 'Le partage n’a pas pu s’ouvrir. Réessaie dans un instant.',
    });
  });
});
