import { InvokeTimeoutError, invokeWithTimeout } from './invoke-timeout';

describe('invokeWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the result and clears the timer', async () => {
    const result = await invokeWithTimeout(async () => 'ok', 1000);

    expect(result).toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates rejections from the wrapped call', async () => {
    await expect(invokeWithTimeout(async () => { throw new Error('boom'); }, 1000)).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with InvokeTimeoutError and aborts the signal when the call hangs', async () => {
    let receivedSignal: AbortSignal | undefined;
    const promise = invokeWithTimeout((signal) => {
      receivedSignal = signal;
      return new Promise<string>(() => {});
    }, 1000);
    const assertion = expect(promise).rejects.toBeInstanceOf(InvokeTimeoutError);

    await jest.advanceTimersByTimeAsync(999);
    expect(receivedSignal?.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await assertion;
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('ignores a late rejection once the timeout has fired', async () => {
    let rejectLate: (reason: Error) => void = () => {};
    const promise = invokeWithTimeout(
      () => new Promise<string>((_, reject) => { rejectLate = reject; }),
      1000
    );
    const assertion = expect(promise).rejects.toBeInstanceOf(InvokeTimeoutError);

    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
    rejectLate(new Error('late'));
    await Promise.resolve();
  });
});
