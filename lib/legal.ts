import { Alert, Linking } from 'react-native';

function showUnavailableAlert() {
  Alert.alert('Lien indisponible', 'Ce document n’est pas disponible pour le moment.');
}

export async function openLegalUrl(url: string) {
  const target = url.trim();
  if (!target) {
    showUnavailableAlert();
    return;
  }

  try {
    await Linking.openURL(target);
  } catch {
    showUnavailableAlert();
  }
}
