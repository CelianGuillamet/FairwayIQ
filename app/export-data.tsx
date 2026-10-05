import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useDataExport } from '../lib/use-data-export';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';

const INCLUDED = [
  'Ton compte et ton profil : e-mail, prénom, handicap, objectif, fréquence de jeu.',
  'Tes rounds, avec le score trou par trou quand tu l’as saisi.',
  'Tes diagnostics du coach.',
  'Tes exercices réalisés et leurs résultats.',
  'Tes trophées.',
  'Les distances de ton sac.',
  'Tes débriefs avec le coach.',
  'Le statut de ton abonnement.',
] as const;

const EXCLUDED = [
  'Ton mot de passe et tes identifiants de connexion.',
  'Les données des autres joueurs.',
  'Tes informations de paiement : elles restent chez Apple.',
  'Les réglages gardés sur ton téléphone : apparence, rappels, objectif de la semaine, défi du mois.',
] as const;

export default function ExportDataScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { start, running } = useDataExport();
  const busy = running !== null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <PageHeader
          title="Exporter mes données"
          subtitle="Reçois une copie des données que FairwayIQ garde sur toi."
          onBack={goBack}
        />

        <Section title="Ce qui est inclus">
          <AppCard>
            <ItemList items={INCLUDED} icon="check" tint={colors.green} />
          </AppCard>
        </Section>

        <Section title="Ce qui n’est pas inclus">
          <AppCard>
            <ItemList items={EXCLUDED} icon="x" tint={colors.ink3} />
          </AppCard>
        </Section>

        <View style={styles.actions}>
          <View style={styles.action}>
            <AppButton
              label="Exporter tout (JSON)"
              onPress={() => void start('json')}
              loading={running === 'json'}
              disabled={busy}
            />
            <Text style={styles.caption}>Toutes tes données dans un seul fichier.</Text>
          </View>

          <View style={styles.action}>
            <AppButton
              label="Exporter mes rounds (CSV)"
              variant="secondary"
              onPress={() => void start('csv')}
              loading={running === 'csv'}
              disabled={busy}
            />
            <Text style={styles.caption}>Un tableau de tes rounds, à ouvrir dans Excel ou Numbers.</Text>
          </View>

          {busy ? (
            <View style={styles.progress} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.ink2} />
              <Text style={styles.progressText}>Préparation de ton export…</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.note}>
          Le fichier est créé sur ton téléphone, puis tu choisis où l’envoyer : Fichiers, Mail, AirDrop… Il contient des
          données personnelles, garde-le en lieu sûr.
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ItemList({ items, icon, tint }: { items: readonly string[]; icon: 'check' | 'x'; tint: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <View style={styles.itemIcon} accessible={false} importantForAccessibility="no-hide-descendants">
            <Icon name={icon} size={18} color={tint} />
          </View>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.xl,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
    },
    list: {
      gap: Spacing.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    itemIcon: {
      height: 22,
      justifyContent: 'center',
    },
    itemText: {
      ...Typography.body,
      color: colors.ink,
      flex: 1,
    },
    actions: {
      gap: Spacing.md,
    },
    action: {
      gap: Spacing.xs,
    },
    caption: {
      ...Typography.caption,
      color: colors.ink2,
      textAlign: 'center',
    },
    progress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    progressText: {
      ...Typography.body,
      color: colors.ink2,
    },
    note: {
      ...Typography.caption,
      color: colors.ink2,
    },
  });
