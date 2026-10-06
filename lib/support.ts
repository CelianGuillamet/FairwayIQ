import { Alert, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SUPPORT_EMAIL } from '../constants/legal';
import { getAppVersionLabel } from './app-info';
import { buildSupportMailto, normalizeSupportEmail } from './support-mail';

export type ContactSupportResult = 'opened' | 'copied' | 'unavailable';

export function getSupportEmail() {
  return normalizeSupportEmail(SUPPORT_EMAIL);
}

async function copyAddress(email: string) {
  let copied = false;

  try {
    copied = await Clipboard.setStringAsync(email);
  } catch {
    copied = false;
  }

  Alert.alert(
    'Messagerie indisponible',
    copied
      ? `L’adresse ${email} est copiée. Colle-la dans ton application mail pour nous écrire.`
      : `Écris-nous depuis ton application mail : ${email}`,
  );

  return copied;
}

export async function contactSupport(email: string): Promise<ContactSupportResult> {
  const url = buildSupportMailto(email, {
    versionLabel: getAppVersionLabel(),
    platform: Platform.OS,
    osVersion: Platform.Version,
  });

  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return (await copyAddress(email)) ? 'copied' : 'unavailable';
  }
}
