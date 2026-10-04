import { Linking, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { DRILL_CATEGORY_LABELS, DRILL_DIFFICULTY_LABELS } from '../../lib/drill-library';
import { extractDrillGoal, type PlanStatus } from '../../lib/drill-plan';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { Drill } from '../../types';
import { AppButton } from '../ui/AppButton';
import { Icon } from '../ui/Icon';
import { TextAction } from '../ui/TextAction';

type Props = {
  drill: Drill;
  status: PlanStatus;
  expanded: boolean;
  doneToday: boolean;
  totalCompletions: number;
  onToggle: () => void;
  onMarkDone: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  done: 'Fait cette semaine',
  next: 'À faire ensuite',
  todo: 'À faire',
};

export function DrillCard({
  drill,
  status,
  expanded,
  doneToday,
  totalCompletions,
  onToggle,
  onMarkDone,
  onLayout,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const category = DRILL_CATEGORY_LABELS[drill.category];
  const goal = extractDrillGoal(drill.description);
  const detail = [
    DRILL_DIFFICULTY_LABELS[drill.difficulty],
    totalCompletions > 0 ? `${totalCompletions}× réalisé` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, status === 'next' && styles.cardNext]} onLayout={onLayout}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${drill.title}, ${category}, ${drill.duration_minutes} minutes, ${STATUS_LABELS[status]}`}
        accessibilityHint={expanded ? 'Masque les détails' : 'Affiche les détails et la validation'}
      >
        <View style={styles.copy}>
          <Text style={styles.kicker}>{status === 'next' ? `${category} · à faire ensuite` : category}</Text>
          <Text style={[styles.title, status === 'done' && styles.titleDone]}>{drill.title}</Text>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Icon name="clock" size={16} color={colors.ink3} />
              <Text style={styles.metaText}>{drill.duration_minutes} min</Text>
            </View>
            <Text style={[styles.metaText, styles.metaGoal]} numberOfLines={1}>
              {goal ? `Objectif ${goal}` : DRILL_DIFFICULTY_LABELS[drill.difficulty]}
            </Text>
          </View>
        </View>
        <View style={[styles.status, status === 'done' && styles.statusDone]}>
          {status === 'done' ? <Icon name="check" size={16} strokeWidth={2.5} color={colors.surface} /> : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <Text style={styles.description}>{drill.description}</Text>
          <Text style={styles.detailMeta}>{detail}</Text>
          <View style={styles.actions}>
            {drill.youtube_url ? (
              <TextAction
                label="Vidéo"
                role="link"
                tone="muted"
                underline
                accessibilityHint="Ouvre la vidéo dans le navigateur"
                onPress={() => void Linking.openURL(drill.youtube_url!)}
              />
            ) : null}
            <AppButton
              label={doneToday ? 'Terminé' : 'Marquer fait'}
              variant="secondary"
              onPress={onMarkDone}
              disabled={doneToday}
              style={styles.markDone}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 18,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    cardNext: {
      borderWidth: 2,
      borderColor: colors.ink,
      paddingHorizontal: Spacing.md - 1,
      paddingVertical: 13,
    },
    header: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    kicker: {
      ...Typography.label,
      color: colors.ink2,
    },
    title: {
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    titleDone: {
      color: colors.ink2,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...Typography.label,
      fontFamily: Typography.body.fontFamily,
      color: colors.ink3,
    },
    metaGoal: {
      flexShrink: 1,
    },
    status: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDone: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },
    details: {
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    description: {
      ...Typography.body,
      color: colors.ink2,
    },
    detailMeta: {
      ...Typography.caption,
      color: colors.ink3,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      marginTop: Spacing.xxs,
    },
    markDone: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 140,
    },
  });
