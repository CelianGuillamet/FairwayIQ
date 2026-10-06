import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

export type AppVersionInfo = {
  version: string | null;
  build: string | null;
};

type AppVersionSources = {
  configVersion?: string | null;
  nativeVersion?: string | null;
  configBuild?: string | number | null;
  nativeBuild?: string | number | null;
};

function clean(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value).trim();
  return text === '' ? null : text;
}

// The native build number comes first: with EAS remote versioning it is not written back to app.json.
export function resolveAppVersion(sources: AppVersionSources): AppVersionInfo {
  return {
    version: clean(sources.configVersion) ?? clean(sources.nativeVersion),
    build: clean(sources.nativeBuild) ?? clean(sources.configBuild),
  };
}

export function formatVersionLabel({ version, build }: AppVersionInfo) {
  const parts = ['FairwayIQ'];
  if (version) parts.push(version);
  if (build) parts.push(`(${build})`);
  return parts.join(' ');
}

export function getAppVersionInfo(): AppVersionInfo {
  const config = Constants.expoConfig;

  return resolveAppVersion({
    configVersion: config?.version,
    nativeVersion: Application.nativeApplicationVersion,
    configBuild: Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode,
    nativeBuild: Application.nativeBuildVersion,
  });
}

export function getAppVersionLabel() {
  return formatVersionLabel(getAppVersionInfo());
}
