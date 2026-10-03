import { Alert, Linking } from 'react-native';
import { openLegalUrl } from './legal';

describe('openLegalUrl', () => {
  let openURL: jest.SpyInstance;
  let alert: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true);
    alert = jest.spyOn(Alert, 'alert').mockReset().mockImplementation(() => {});
  });

  it('opens a configured URL', async () => {
    await openLegalUrl('https://example.com/privacy');

    expect(openURL).toHaveBeenCalledWith('https://example.com/privacy');
    expect(alert).not.toHaveBeenCalled();
  });

  it('alerts instead of opening when the URL is empty or blank', async () => {
    await openLegalUrl('');
    await openLegalUrl('   ');

    expect(openURL).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('alerts when the system cannot open the URL', async () => {
    openURL.mockRejectedValue(new Error('Unable to open URL'));

    await openLegalUrl('https://example.com/terms');

    expect(alert).toHaveBeenCalledTimes(1);
  });
});
