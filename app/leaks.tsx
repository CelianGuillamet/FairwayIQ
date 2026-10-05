import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoundsStore } from '../stores/rounds';
import { Spacing, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { LEAKS_MIN_ROUNDS, describeLegacyExclusion, getMetricRows } from '../lib/leaks';
import type { DrillCategory } from '../lib/drill-library';
import { useTheme, useThemedStyles } from '../lib/theme';
import { LeakCard } from '../components/leaks/LeakCard';
import { MetricList } from '../components/leaks/MetricList';
import { useLeaks } from '../components/leaks/useLeaks';
import { goBackOrHome } from '../components/rounds-detail/navigation';
import { AppButton } from '../components/ui/AppButton';
import { AppCard } from '../components/ui/AppCard';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';

export default function LeaksScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const rounds = useRoundsStore((state) => state.rounds);
  const initialized = useRoundsStore((state) => state.initialized);
  const roundsError = useRoundsStore((state) => state.error);
  const fetchRounds = useRoundsStore((state) => state.fetchRounds);
  const leaks = useLeaks();

  useEffect(() => {
    if (!initialized) {
      void fetchRounds();
    }
  }, [fetchRounds, initialized]);

  const openDrills = (category: DrillCategory) => {
    router.navigate({ pathname: '/(tabs)/drills', params: { category, focus: String(Date.now()) } });
  };

  const renderBody = () => {
    if (roundsError && rounds.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>Impossible de charger tes rounds</Text>
          <Text style={styles.stateText}>{roundsError}</Text>
          <AppButton label="Réessayer" variant="secondary" onPress={() => void fetchRounds()} style={styles.stateButton} />
        </View>
      );
    }

    if (leaks.status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.ink} />
          <Text style={styles.stateText}>Analyse de tes trous…</Text>
        </View>
      );
    }

    if (leaks.status === 'error') {
      return (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>Analyse indisponible</Text>
          <Text style={styles.stateText}>{leaks.error}</Text>
          <AppButton label="Réessayer" variant="secondary" onPress={leaks.reload} style={styles.stateButton} />
        </View>
      );
    }

    const { analysis } = leaks;
    const legacyNote = describeLegacyExclusion(analysis.legacyRoundsExcluded);

    if (analysis.lowConfidence) {
      return (
        <View style={styles.sections}>
          <AppCard accent="soft">
            <Text style={styles.cardTitle} accessibilityRole="header">
              Pas encore assez de données
            </Text>
            <Text style={styles.cardText}>
              {`Il faut au moins ${LEAKS_MIN_ROUNDS} rounds saisis trou par trou pour repérer où tu perds des coups. ${
                analysis.roundsAnalyzed === 0
                  ? 'Tu n’en as pas encore.'
                  : `Tu en as ${analysis.roundsAnalyzed}.`
              }`}
            </Text>
            {legacyNote ? <Text style={styles.cardText}>{legacyNote}</Text> : null}
            <AppButton
              label="Saisir un round"
              variant="secondary"
              onPress={() => router.navigate('/(tabs)/round')}
              style={styles.cardButton}
            />
          </AppCard>
        </View>
      );
    }

    return (
      <View style={styles.sections}>
        {analysis.leaks.length > 0 ? (
          <View style={styles.cards}>
            {analysis.leaks.map((leak, index) => (
              <LeakCard key={leak.id} rank={index + 1} leak={leak} onOpenDrills={() => openDrills(leak.drill)} />
            ))}
            <Text style={styles.caption}>
              Ces pertes se recoupent : un 3 putts peut aussi être un double bogey. Ne les additionne pas.
            </Text>
          </View>
        ) : (
          <AppCard accent="soft">
            <Text style={styles.cardTitle} accessibilityRole="header">
              Aucune grosse fuite
            </Text>
            <Text style={styles.cardText}>
              Sur tes derniers rounds, aucun poste ne te coûte plus d’un demi-coup par 18 trous.
            </Text>
          </AppCard>
        )}

        <View>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Tous les chiffres
          </Text>
          <Text style={styles.sectionCaption}>Moyennes sur tes {analysis.roundsAnalyzed} derniers rounds trou par trou</Text>
          <MetricList rows={getMetricRows(analysis.metrics)} />
        </View>

        {legacyNote ? (
          <View style={styles.note}>
            <Icon name="info" size={18} color={colors.ink3} />
            <Text style={styles.noteText}>{legacyNote}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const subtitle = leaks.status === 'ready' && !leaks.analysis.lowConfidence
    ? `${leaks.analysis.roundsAnalyzed} rounds trou par trou, ramenés à 18 trous`
    : 'Les postes qui te coûtent le plus de coups.';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.display },
        ]}
      >
        <PageHeader onBack={goBackOrHome} title="Où tu perds des coups" subtitle={subtitle} />
        {renderBody()}
      </ScrollView>
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
    },
    sections: {
      gap: Spacing.xl,
    },
    cards: {
      gap: Spacing.sm,
    },
    centered: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      gap: Spacing.xs,
    },
    stateTitle: {
      ...Typography.titleMd,
      color: colors.ink,
      textAlign: 'center',
    },
    stateText: {
      ...Typography.body,
      color: colors.ink2,
      textAlign: 'center',
    },
    stateButton: {
      marginTop: Spacing.sm,
      minWidth: 160,
    },
    cardTitle: {
      ...Typography.titleMd,
      color: colors.ink,
    },
    cardText: {
      ...Typography.body,
      color: colors.ink2,
      marginTop: Spacing.xs,
    },
    cardButton: {
      marginTop: Spacing.md,
    },
    caption: {
      ...Typography.caption,
      color: colors.ink3,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      ...Typography.heading,
      color: colors.ink,
    },
    sectionCaption: {
      ...Typography.caption,
      color: colors.ink3,
      marginBottom: Spacing.sm,
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
    },
    noteText: {
      ...Typography.caption,
      color: colors.ink2,
      flex: 1,
    },
  });
