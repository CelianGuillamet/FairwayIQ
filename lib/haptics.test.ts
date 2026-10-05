const mockImpact = jest.fn();
const mockNotification = jest.fn();

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpact(...args),
  notificationAsync: (...args: unknown[]) => mockNotification(...args),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

import { Platform } from 'react-native';
import { hapticLight, hapticSuccess, hapticWarning } from './haptics';

const originalOS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

beforeEach(() => {
  mockImpact.mockReset().mockResolvedValue(undefined);
  mockNotification.mockReset().mockResolvedValue(undefined);
  setPlatform('ios');
});

afterAll(() => {
  setPlatform(originalOS);
});

describe('haptics', () => {
  it('fires a light impact', () => {
    hapticLight();
    expect(mockImpact).toHaveBeenCalledWith('light');
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('fires success and warning notifications', () => {
    hapticSuccess();
    hapticWarning();
    expect(mockNotification).toHaveBeenNthCalledWith(1, 'success');
    expect(mockNotification).toHaveBeenNthCalledWith(2, 'warning');
  });

  it('works on android', () => {
    setPlatform('android');
    hapticLight();
    expect(mockImpact).toHaveBeenCalledTimes(1);
  });

  it('does nothing on web', () => {
    setPlatform('web');
    hapticLight();
    hapticSuccess();
    hapticWarning();
    expect(mockImpact).not.toHaveBeenCalled();
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('never throws when the native call rejects', async () => {
    mockImpact.mockRejectedValue(new Error('unsupported'));
    expect(() => hapticLight()).not.toThrow();
    await Promise.resolve();
  });

  it('never throws when the native call throws synchronously', () => {
    mockNotification.mockImplementation(() => {
      throw new Error('module missing');
    });
    expect(() => hapticSuccess()).not.toThrow();
    expect(() => hapticWarning()).not.toThrow();
  });

  it('never throws when the native call returns nothing', () => {
    mockImpact.mockReturnValue(undefined);
    expect(() => hapticLight()).not.toThrow();
  });
});
