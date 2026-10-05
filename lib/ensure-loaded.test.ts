const mockRoundsState = { initialized: false, fetchRounds: jest.fn() };
const mockDrillsState = { initialized: false, fetchCompletions: jest.fn() };

jest.mock('../stores/rounds', () => ({ useRoundsStore: { getState: () => mockRoundsState } }));
jest.mock('../stores/drills', () => ({ useDrillsStore: { getState: () => mockDrillsState } }));

import { createLoadOnce, ensureCompletionsLoaded, ensureRoundsLoaded } from './ensure-loaded';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createLoadOnce', () => {
  it('skips the load when already loaded', async () => {
    const load = jest.fn().mockResolvedValue(undefined);
    const ensure = createLoadOnce(() => true, load);

    await ensure();

    expect(load).not.toHaveBeenCalled();
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const pending = deferred();
    const load = jest.fn(() => pending.promise);
    const ensure = createLoadOnce(() => false, load);

    const first = ensure();
    const second = ensure();
    expect(load).toHaveBeenCalledTimes(1);

    pending.resolve();
    await Promise.all([first, second]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again after the previous load settled without loading', async () => {
    const load = jest.fn().mockResolvedValue(undefined);
    const ensure = createLoadOnce(() => false, load);

    await ensure();
    await ensure();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('swallows a rejected load, warns and allows a retry', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const ensure = createLoadOnce(() => false, load);

    await expect(ensure()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[stores] Load failed', 'offline');

    await ensure();
    expect(load).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('handles a load that throws synchronously', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ensure = createLoadOnce(() => false, () => {
      throw new Error('boom');
    });

    await expect(ensure()).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('store bindings', () => {
  beforeEach(() => {
    mockRoundsState.initialized = false;
    mockDrillsState.initialized = false;
    mockRoundsState.fetchRounds.mockReset().mockResolvedValue(undefined);
    mockDrillsState.fetchCompletions.mockReset().mockResolvedValue(undefined);
  });

  it('fetches rounds only while the store is not initialised', async () => {
    await ensureRoundsLoaded();
    expect(mockRoundsState.fetchRounds).toHaveBeenCalledTimes(1);

    mockRoundsState.initialized = true;
    await ensureRoundsLoaded();
    expect(mockRoundsState.fetchRounds).toHaveBeenCalledTimes(1);
  });

  it('fetches completions only while the store is not initialised', async () => {
    await ensureCompletionsLoaded();
    expect(mockDrillsState.fetchCompletions).toHaveBeenCalledTimes(1);

    mockDrillsState.initialized = true;
    await ensureCompletionsLoaded();
    expect(mockDrillsState.fetchCompletions).toHaveBeenCalledTimes(1);
  });
});
