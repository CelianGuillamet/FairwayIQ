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
import { useRoundsStore } from '../stores/rounds';
import { fetchDiagnosticByRound } from '../lib/diagnostics';
import { parseDiagnosisParam, parseDiagnosticResult } from '../lib/diagnostic-shape';
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

export default function DiagnosticScreen() {
  const { roundId: roundIdParam, diagnosis } = useLocalSearchParams<{
    roundId?: string | string[];
    diagnosis?: string | string[];
  }>();
  const roundId = typeof roundIdParam === 'string' ? roundIdParam : undefined;
  const { setRecommendedCategories } = useDrillsStore();
  const insets = useSafeAreaInsets();
  const paramDiagnosis = useMemo(() => parseDiagnosisParam(diagnosis), [diagnosis]);

  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      if (!roundId) {
        setLoading(false);
        setError('Diagnostic introuvable.');
        return;
      }

      setLoading(true);
      setError(null);

      // The saved diagnostic is authoritative. The URL param is only a fallback for when it
      // could not be loaded, and only for one of this user's rounds, so a crafted link
      // cannot inject content.
      const fallback = useRoundsStore.getState().rounds.some((round) => round.id === roundId)
        ? paramDiagnosis
        : null;

      try {
        const diagnostic = await fetchDiagnosticByRound(roundId);
        if (cancelled) return;

        const shown = (diagnostic ? parseDiagnosticResult(diagnostic) : null) ?? fallback;
        if (shown) {
          setResult(shown);
        } else {
          setError(diagnostic ? 'Diagnostic illisible.' : 'Aucun diagnostic enregistré pour ce round.');
        }
      } catch (currentError: any) {
        if (cancelled) return;

        if (fallback) {
          setResult(fallback);
        } else {
          setError(currentError?.message ?? 'Impossible de charger le diagnostic.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDiagnostic();

    return () => {
      cancelled = true;
    };
  }, [paramDiagnosis, roundId]);

  useEffect(() => {
    if (result?.recommended_categories?.length) {
      setRecommendedCategories(result.recommended_categories);
    }
  }, [result, setRecommendedCategories]);

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <DecorativeBackground />
        <ActivityIndicator size="large" color={Colors.text} />
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
    borderColor: Colors.accentBlue,
    backgroundColor: Colors.surfaceAccent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipText: {
    color: Colors.accentBlue,
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
    color: Colors.accentBlue,
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
