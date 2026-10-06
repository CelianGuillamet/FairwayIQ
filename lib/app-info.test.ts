import { formatVersionLabel, resolveAppVersion } from './app-info';

describe('formatVersionLabel', () => {
  it('shows the version and the build number', () => {
    expect(formatVersionLabel({ version: '1.0.0', build: '12' })).toBe('FairwayIQ 1.0.0 (12)');
  });

  it('drops the build number when it is unknown', () => {
    expect(formatVersionLabel({ version: '1.0.0', build: null })).toBe('FairwayIQ 1.0.0');
  });

  it('degrades to the app name when nothing is known', () => {
    expect(formatVersionLabel({ version: null, build: null })).toBe('FairwayIQ');
    expect(formatVersionLabel({ version: null, build: '12' })).toBe('FairwayIQ (12)');
  });
});

describe('resolveAppVersion', () => {
  it('reads the version from the app config and the build from the native binary', () => {
    expect(
      resolveAppVersion({ configVersion: '1.0.0', nativeVersion: '0.9.0', configBuild: '3', nativeBuild: '12' }),
    ).toEqual({ version: '1.0.0', build: '12' });
  });

  it('falls back to the other source when one is missing', () => {
    expect(resolveAppVersion({ nativeVersion: '1.1.0', configBuild: 7 })).toEqual({ version: '1.1.0', build: '7' });
  });

  it('ignores empty and blank values', () => {
    expect(
      resolveAppVersion({ configVersion: ' ', nativeVersion: '1.0.0', configBuild: '', nativeBuild: null }),
    ).toEqual({ version: '1.0.0', build: null });
  });

  it('turns numeric build numbers into text', () => {
    expect(resolveAppVersion({ configVersion: '1.0.0', nativeBuild: 12 }).build).toBe('12');
  });
});
