import { useMemo, useRef, useState, type ReactElement } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef, type CaptureOptions } from 'react-native-view-shot';
import { buildShareCardModel } from '../../lib/share-card';
import { getShareAlert, runShareFlow } from '../../lib/share-flow';
import type { Round, RoundAggregate } from '../../types';
import type { ScorecardHalf } from '../rounds-detail/scorecard-model';
import {
  RoundShareCard,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
} from './RoundShareCard';

// iOS renders at the screen scale (3x on current iPhones); Android only reaches 1080x1350 when given the pixel size.
const CAPTURE_OPTIONS: CaptureOptions = {
  format: 'png',
  quality: 1,
  result: 'tmpfile',
  ...(Platform.OS === 'android'
    ? {
        width: SHARE_CARD_WIDTH * SHARE_CARD_PIXEL_RATIO,
        height: SHARE_CARD_HEIGHT * SHARE_CARD_PIXEL_RATIO,
      }
    : {}),
};

const SHARE_OPTIONS = {
  mimeType: 'image/png',
  UTI: 'public.png',
  dialogTitle: 'Partager mon round',
};

type Input = {
  round: Round | null;
  aggregate: RoundAggregate | null;
  halves: ScorecardHalf[];
};

type ShareRound = {
  share: () => Promise<void>;
  capturing: boolean;
  shareCard: ReactElement | null;
};

export function useShareRound({ round, aggregate, halves }: Input): ShareRound {
  const cardRef = useRef<View>(null);
  const inFlight = useRef(false);
  const [capturing, setCapturing] = useState(false);

  const model = useMemo(
    () => (round ? buildShareCardModel({ round, aggregate, halves }) : null),
    [round, aggregate, halves],
  );

  const release = () => {
    inFlight.current = false;
    setCapturing(false);
  };

  const share = async () => {
    if (!model || inFlight.current) return;

    inFlight.current = true;
    setCapturing(true);

    try {
      const outcome = await runShareFlow({
        isAvailable: Sharing.isAvailableAsync,
        capture: () => captureRef(cardRef, CAPTURE_OPTIONS),
        share: (uri) => Sharing.shareAsync(uri, SHARE_OPTIONS),
        onCaptured: release,
      });
      const alert = getShareAlert(outcome);

      if (alert) Alert.alert(alert.title, alert.message);
    } finally {
      release();
    }
  };

  const shareCard = model ? (
    <View
      ref={cardRef}
      collapsable={false}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.offscreen}
    >
      <RoundShareCard model={model} />
    </View>
  ) : null;

  return { share, capturing, shareCard };
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -(SHARE_CARD_WIDTH * 2),
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  },
});
