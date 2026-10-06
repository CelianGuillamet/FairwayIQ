import { Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { contactSupport, getSupportEmail } from './support';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('./app-info', () => ({ getAppVersionLabel: () => 'FairwayIQ 1.0.0 (12)' }));

const setString = Clipboard.setStringAsync as jest.Mock;

describe('contactSupport', () => {
  let openURL: jest.SpyInstance;
  let alert: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true);
    alert = jest.spyOn(Alert, 'alert').mockReset().mockImplementation(() => {});
    setString.mockReset().mockResolvedValue(true);
  });

  it('opens a prefilled mail and stays silent', async () => {
    await expect(contactSupport('aide@fairwayiq.app')).resolves.toBe('opened');

    const url = openURL.mock.calls[0][0] as string;
    expect(url.startsWith('mailto:aide@fairwayiq.app?subject=FairwayIQ%20%E2%80%94%20aide&body=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('FairwayIQ 1.0.0 (12)');
    expect(alert).not.toHaveBeenCalled();
    expect(setString).not.toHaveBeenCalled();
  });

  it('copies the address and says so when no mail app can open the link', async () => {
    openURL.mockRejectedValue(new Error('Unable to open URL'));

    await expect(contactSupport('aide@fairwayiq.app')).resolves.toBe('copied');

    expect(setString).toHaveBeenCalledWith('aide@fairwayiq.app');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][1]).toContain('aide@fairwayiq.app');
    expect(alert.mock.calls[0][1]).toContain('copiée');
  });

  it('still shows the address when the clipboard fails too', async () => {
    openURL.mockRejectedValue(new Error('Unable to open URL'));
    setString.mockRejectedValue(new Error('clipboard unavailable'));

    await expect(contactSupport('aide@fairwayiq.app')).resolves.toBe('unavailable');

    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][1]).toContain('aide@fairwayiq.app');
    expect(alert.mock.calls[0][1]).not.toContain('copiée');
  });
});

describe('getSupportEmail', () => {
  it('is hidden when the environment variable is not set', () => {
    expect(getSupportEmail()).toBeNull();
  });
});
