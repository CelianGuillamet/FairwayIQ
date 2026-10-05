import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { getBadge, type BadgeDefinition } from '../../lib/badges';
import { useThemedStyles } from '../../lib/theme';
import { useBadgesStore } from '../../stores/badges';
import { AppButton } from '../ui/AppButton';
import { BadgeMedal } from './BadgeMedal';

type SheetProps = {
  badge: BadgeDefinition;
  remaining: number;
  onClose: () => void;
};

function describeRemaining(remaining: number) {
  return `${remaining} autre${remaining > 1 ? 's' : ''} trophée${remaining > 1 ? 's' : ''} à suivre`;
}

function CelebrationSheet({ badge, remaining, onClose }: SheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [progress]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.xs },
          { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        ]}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        <View style={styles.handle} />
        <Text style={styles.eyebrow}>Nouveau trophée</Text>
        <View style={styles.medal}>
          <BadgeMedal icon={badge.icon} size={72} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {badge.title}
        </Text>
        <Text style={styles.description}>{badge.description}</Text>
        {remaining > 0 ? <Text style={styles.remaining}>{describeRemaining(remaining)}</Text> : null}
        <AppButton label="Super" onPress={onClose} style={styles.button} />
      </Animated.View>
    </View>
  );
}

// A plain overlay rather than a native Modal: a Modal opening while another sheet closes or a
// screen is pushed (a saved round going to its diagnostic) can be dropped by iOS.
export function BadgeCelebration() {
  const queue = useBadgesStore((state) => state.queue);
  const dismiss = useBadgesStore((state) => state.dismissCelebration);
  const id = queue[0];

  if (!id) return null;

  return <CelebrationSheet key={id} badge={getBadge(id)} remaining={queue.length - 1} onClose={dismiss} />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 100,
      elevation: 100,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    sheet: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.lineStrong,
      marginBottom: Spacing.md,
    },
    eyebrow: {
      ...Typography.label,
      color: colors.ink2,
    },
    medal: {
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.title,
      color: colors.ink,
      textAlign: 'center',
    },
    description: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    remaining: {
      ...Typography.caption,
      color: colors.ink3,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    button: {
      alignSelf: 'stretch',
      marginTop: Spacing.lg,
    },
  });
