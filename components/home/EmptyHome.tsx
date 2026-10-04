import { StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants';
import type { ThemeColors } from '../../constants';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { AppCard } from '../ui/AppCard';
import { Icon, type IconName } from '../ui/Icon';

const OUTCOMES: readonly { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'trophy',
    title: 'Ton Handicap Index estimé',
    text: 'Calculé dès 3 rounds de 18 trous, avec la méthode WHS (non officiel).',
  },
  {
    icon: 'target',
    title: 'Ton diagnostic',
    text: 'Où tu perds des coups : putting, approches, départs ou pénalités.',
  },
  {
    icon: 'flag',
    title: 'Ton plan d’exercices',
    text: 'Des exercices choisis d’après ton diagnostic, à faire chaque semaine.',
  },
];

export function EmptyHome({ declaredHandicap }: { declaredHandicap: number | null }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <AppCard>
        <Text style={styles.title} accessibilityRole="header">
          Ton premier round lance tout
        </Text>
        <Text style={styles.intro}>
          Saisis un round trou par trou, même sur 9 trous. Ensuite, FairwayIQ prépare pour toi :
        </Text>
        <View style={styles.list}>
          {OUTCOMES.map((item) => (
            <View key={item.title} style={styles.item}>
              <View style={styles.iconWrap}>
                <Icon name={item.icon} size={20} color={colors.ink} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </AppCard>
      {declaredHandicap != null ? (
        <Text style={styles.declared}>Handicap déclaré : {declaredHandicap}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.sm,
    },
    title: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    intro: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    list: {
      gap: Spacing.md,
      marginTop: Spacing.md,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.sunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemCopy: {
      flex: 1,
    },
    itemTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    itemText: {
      ...Typography.body,
      color: colors.ink2,
    },
    declared: {
      ...Typography.label,
      color: colors.ink3,
      paddingHorizontal: 2,
    },
  });
