import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants';
import type { DiagnosticResult } from '../lib/claude';
import { useDrillsStore } from '../stores/drills';
import { fetchDiagnosticByRound } from '../lib/diagnostics';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { PageHeader } from '../components/ui/PageHeader';

const CATEGORY_LABELS: Record<string, string> = {
  putting: 'Putting',
  short_game: 'Petit jeu',
  approach: 'Approches',
  driving: 'Mise en jeu',
  mental: 'Mental',
};

function parseDiagnosis(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as DiagnosticResult;
  } catch {
    return null;
  }
}

export default function DiagnosticScreen() {
  const { roundId, diagnosis } = useLocalSearchParams<{ roundId: string; diagnosis?: string }>();
  const { setRecommendedCategories } = useDrillsStore();
  const insets = useSafeAreaInsets();
  const paramDiagnosis = useMemo(() => parseDiagnosis(diagnosis), [diagnosis]);

  const [result, setResult] = useState<DiagnosticResult | null>(paramDiagnosis);
  const [loading, setLoading] = useState(!paramDiagnosis);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paramDiagnosis) {
      setResult(paramDiagnosis);
      setLoading(false);
      setError(null);
      return;
    }

    if (!roundId) {
      setLoading(false);
      setError('Diagnostic introuvable.');
      return;
    }

    void loadDiagnostic();
  }, [paramDiagnosis, roundId]);

  useEffect(() => {
    if (result?.recommended_categories?.length) {
      setRecommendedCategories(result.recommended_categories);
    }
  }, [result, setRecommendedCategories]);

  async function loadDiagnostic() {
    if (!roundId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const diagnostic = await fetchDiagnosticByRound(roundId);

      if (!diagnostic) {
        setError('Aucun diagnostic enregistré pour ce round.');
        return;
      }

      setResult({
        strengths: diagnostic.strengths,
        weaknesses: diagnostic.weaknesses,
        weekly_plan: diagnostic.weekly_plan,
        raw_analysis: diagnostic.raw_analysis,
        recommended_categories: diagnostic.recommended_categories ?? [],
      });
    } catch (currentError: any) {
      setError(currentError?.message ?? 'Impossible de charger le diagnostic.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement du diagnostic...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <Text style={styles.errorText}>{error ?? 'Diagnostic introuvable.'}</Text>
        <AppButton label="Retour au dashboard" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <PageHeader
          eyebrow="Diagnostic"
          title="Lecture du round"
          subtitle="Une synthèse claire des signaux importants, avec un axe de progression immédiatement exploitable."
        />

        <AppCard accent="highlight" style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Lecture globale</Text>
          <Text style={styles.heroText}>{result.raw_analysis}</Text>
        </AppCard>

        {result.recommended_categories?.length > 0 ? (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Priorités d’entraînement</Text>
            <View style={styles.categoryRow}>
              {result.recommended_categories.map((category) => (
                <View key={category} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{CATEGORY_LABELS[category] ?? category}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        ) : null}

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Points forts</Text>
          {result.strengths?.map((strength, index) => (
            <BulletRow key={`${strength}-${index}`} text={strength} tone="positive" />
          ))}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Axes d’amélioration</Text>
          {result.weaknesses?.map((weakness, index) => (
            <BulletRow key={`${weakness}-${index}`} text={weakness} tone="warning" />
          ))}
        </AppCard>

        <AppCard accent="highlight" style={styles.card}>
          <Text style={styles.cardTitle}>Plan de la semaine</Text>
          <Text style={styles.planText}>{result.weekly_plan}</Text>
        </AppCard>

        <AppButton
          label="Voir les drills recommandés"
          onPress={() => router.push('/(tabs)/drills')}
          style={styles.primaryAction}
        />

        <AppButton
          label="Débrief avec le coach IA"
          variant="secondary"
          onPress={() => router.push({ pathname: '/debrief', params: { roundId } })}
          style={styles.secondaryAction}
        />

        <AppButton
          label="Voir le round en détail"
          variant="secondary"
          onPress={() => router.push({ pathname: '/round-detail', params: { roundId } })}
          style={styles.secondaryAction}
        />

        <AppButton
          label="Retour au dashboard"
          variant="ghost"
          onPress={() => router.replace('/(tabs)')}
          style={styles.ghostAction}
        />
      </ScrollView>
    </View>
  );
}

function BulletRow({ text, tone }: { text: string; tone: 'positive' | 'warning' }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, tone === 'positive' ? styles.positive : styles.warning]}>●</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingState: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  heroCard: {
    marginBottom: 16,
  },
  heroEyebrow: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAccent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  bulletDot: {
    marginRight: 10,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    flex: 1,
  },
  positive: {
    color: Colors.primary,
  },
  warning: {
    color: Colors.warning,
  },
  planText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  primaryAction: {
    marginBottom: 10,
  },
  secondaryAction: {
    marginBottom: 10,
  },
  ghostAction: {
    marginTop: 2,
  },
});
