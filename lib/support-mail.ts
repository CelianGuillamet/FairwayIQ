export const SUPPORT_SUBJECT = 'FairwayIQ — aide';

const EMAIL_PATTERN = /^[^\s@?&#%,;:<>"]+@[^\s@?&#%,;:<>".]+(?:\.[^\s@?&#%,;:<>".]+)+$/;

export function normalizeSupportEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

export type SupportMailContext = {
  versionLabel: string;
  platform: string;
  osVersion: string | number | null | undefined;
};

const PLATFORM_NAMES: Record<string, string> = { ios: 'iOS', android: 'Android' };

export function describeSystem(platform: string, osVersion: string | number | null | undefined) {
  const name = PLATFORM_NAMES[platform] ?? platform;
  const version = osVersion == null ? '' : String(osVersion).trim();
  return version ? `${name} ${version}` : name;
}

export function buildSupportBody({ versionLabel, platform, osVersion }: SupportMailContext) {
  return [
    '',
    '',
    '---',
    'Infos techniques, à garder dans ton message :',
    `Application : ${versionLabel}`,
    `Système : ${describeSystem(platform, osVersion)}`,
  ].join('\n');
}

function encodeMailtoValue(value: string) {
  return encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));
}

export function buildSupportMailto(email: string, context: SupportMailContext) {
  const address = encodeURIComponent(email).replace(/%40/g, '@');
  const subject = encodeMailtoValue(SUPPORT_SUBJECT);
  const body = encodeMailtoValue(buildSupportBody(context));

  return `mailto:${address}?subject=${subject}&body=${body}`;
}
