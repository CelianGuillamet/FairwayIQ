import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useThemedStyles } from '../lib/theme';
import { openLegalUrl } from '../lib/legal';
import {
  COURSE_DATA_ATTRIBUTION,
  DISTANCE_ESTIMATE_NOTE,
  ODBL_URL,
  OPEN_SOURCE_CREDITS,
  OSM_COPYRIGHT_URL,
} from '../lib/credits';
import { AppCard } from '../components/ui/AppCard';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';

export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

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
          title="Crédits et licences"
          subtitle="Les données et les logiciels libres sur lesquels repose FairwayIQ."
          onBack={goBack}
        />

        <Section title="Données de parcours">
          <AppCard style={styles.card}>
            <Text style={styles.body}>{COURSE_DATA_ATTRIBUTION}</Text>
            <View style={styles.links}>
              <TextAction
                label="Droit d’auteur d’OpenStreetMap"
                role="link"
                underline
                onPress={() => void openLegalUrl(OSM_COPYRIGHT_URL)}
                accessibilityHint="Ouvre openstreetmap.org dans le navigateur"
              />
              <TextAction
                label="Licence ODbL"
                role="link"
                underline
                onPress={() => void openLegalUrl(ODBL_URL)}
                accessibilityHint="Ouvre opendatacommons.org dans le navigateur"
              />
            </View>
          </AppCard>
          <Text style={styles.note}>{DISTANCE_ESTIMATE_NOTE}</Text>
        </Section>

        <Section title="Logiciels libres">
          <AppCard style={styles.list}>
            {OPEN_SOURCE_CREDITS.map((credit, index) => (
              <View
                key={credit.packageName}
                style={[styles.row, index > 0 && styles.rowDivider]}
                accessible
                accessibilityLabel={`${credit.name}, licence ${credit.licence}`}
              >
                <Text style={styles.rowName}>{credit.name}</Text>
                <Text style={styles.rowLicence}>{credit.licence}</Text>
              </View>
            ))}
          </AppCard>
        </Section>
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
      ...Typography.titleMd,
      fontSize: 20,
      lineHeight: 24,
      color: colors.ink,
    },
    card: {
      gap: Spacing.xxs,
    },
    body: {
      ...Typography.body,
      color: colors.ink,
    },
    links: {
      marginTop: Spacing.xxs,
    },
    note: {
      ...Typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink2,
    },
    list: {
      paddingVertical: 0,
    },
    row: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    rowName: {
      ...Typography.bodyStrong,
      color: colors.ink,
      flex: 1,
    },
    rowLicence: {
      ...Typography.body,
      color: colors.ink2,
      flexShrink: 1,
      textAlign: 'right',
    },
  });
