import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../constants';
import { openLegalUrl } from '../lib/legal';
import { getOfferings, isPremium, purchasePackage, restorePurchases } from '../lib/purchases';
import { useSubscriptionStore } from '../stores/subscription';
import { DecorativeBackground } from '../components/ui/DecorativeBackground';
import { AppCard } from '../components/ui/AppCard';
import { AppButton } from '../components/ui/AppButton';
import { PageHeader } from '../components/ui/PageHeader';

const FEATURES = [
  { icon: '🤖', title: 'Diagnostic IA illimité', desc: 'Analyse chaque round avec un feedback plus fin et plus exploitable.' },
  { icon: '💬', title: 'Débrief conversationnel', desc: 'Pose tes questions après le round et clarifie les coups qui t’ont coûté des points.' },
  { icon: '📈', title: 'Progression visuelle', desc: 'Lis l’évolution du score, du putting, du GIR et des pénalités.' },
  { icon: '📅', title: 'Plan hebdomadaire', desc: 'Reçois des priorités réalistes selon ton profil et ton dernier diagnostic.' },
  { icon: '🔔', title: 'Rappels utiles', desc: 'Maintiens une routine avec des rappels intelligents, sans friction.' },
] as const;

type PlanKey = 'monthly' | 'annual';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<Awaited<ReturnType<typeof getOfferings>>>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  useEffect(() => {
    getOfferings()
      .then((value) => {
        setOfferings(value);
      })
      .finally(() => {
        setLoadingOfferings(false);
      });
  }, []);

  const monthlyPackage = offerings?.monthly ?? null;
  const annualPackage = offerings?.annual ?? null;
  const monthlyPriceString = monthlyPackage?.product.priceString ?? null;
  const annualPriceString = annualPackage?.product.priceString ?? null;
  const annualPricePerMonthString = annualPackage?.product.pricePerMonthString ?? null;
  const selectedPriceLabel = loadingOfferings
    ? '...'
    : selectedPlan === 'annual'
      ? annualPriceString
        ? `${annualPriceString}/an`
        : null
      : monthlyPriceString
        ? `${monthlyPriceString}/mois`
        : null;

  const handlePurchase = async () => {
    if (!offerings) {
      if (__DEV__) {
        Alert.alert(
          'Mode développement',
          'RevenueCat n’est pas encore configuré. Configure EXPO_PUBLIC_REVENUECAT_IOS_KEY dans .env.local.',
          [{ text: 'Continuer sans premium', onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        Alert.alert('Erreur', 'Achat impossible pour le moment. Réessaie plus tard.');
      }
      return;
    }

    const pkg =
      selectedPlan === 'annual'
        ? offerings.annual ?? offerings.availablePackages[0]
        : offerings.monthly ?? offerings.availablePackages[0];

    if (!pkg) {
      return;
    }

    setLoading(true);

    try {
      const info = await purchasePackage(pkg);
      if (isPremium(info)) {
        useSubscriptionStore.getState().markPremium();
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert('Erreur', error?.message ?? 'Achat impossible.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);

    try {
      const info = await restorePurchases();
      if (isPremium(info)) {
        useSubscriptionStore.getState().markPremium();
        Alert.alert('Abonnement restauré', 'Ton accès Premium est de nouveau actif.', [
          { text: 'Continuer', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert('Aucun achat trouvé', 'Aucun abonnement actif n’est associé à ce compte.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de restaurer les achats.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <DecorativeBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>

        <PageHeader
          eyebrow="Premium"
          title="Le mode coach complet"
          subtitle="Débloque une version nettement plus utile de l’app, pensée pour progresser sérieusement."
        />

        <AppCard accent="highlight" style={styles.heroCard}>
          <Text style={styles.badge}>Abonnement Premium</Text>
          <Text style={styles.heroTitle}>Un cockpit golf plus intelligent, plus utile, plus complet.</Text>
          <Text style={styles.heroSubtitle}>
            Le but n’est pas d’ajouter du bruit. Le but est de transformer chaque round en apprentissage concret.
          </Text>
        </AppCard>

        <View style={styles.featureList}>
          {FEATURES.map((feature) => (
            <AppCard key={feature.title} style={styles.featureCard}>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
              </View>
            </AppCard>
          ))}
        </View>

        <View style={styles.plansRow}>
          <PlanCard
            label="Mensuel"
            price={loadingOfferings ? '...' : monthlyPriceString ?? '—'}
            period="/mois"
            selected={selectedPlan === 'monthly'}
            onPress={() => setSelectedPlan('monthly')}
          />
          <PlanCard
            label="Annuel"
            price={loadingOfferings ? '...' : annualPriceString ?? '—'}
            period="/an"
            badge="Meilleur choix"
            selected={selectedPlan === 'annual'}
            onPress={() => setSelectedPlan('annual')}
          />
        </View>

        {selectedPlan === 'annual' && !loadingOfferings && annualPricePerMonthString ? (
          <Text style={styles.savingsText}>
            Soit {annualPricePerMonthString}/mois · nettement plus intéressant que le mensuel
          </Text>
        ) : null}

        <AppButton
          label="Commencer l’essai gratuit 7 jours"
          variant="accent"
          onPress={() => void handlePurchase()}
          loading={loading}
          style={styles.primaryAction}
        />

        <AppButton
          label="Restaurer mes achats"
          variant="secondary"
          onPress={() => void handleRestore()}
          disabled={loading}
          style={styles.secondaryAction}
        />

        <Text style={styles.trialNote}>
          7 jours gratuits, puis {selectedPriceLabel ?? 'prix indisponible'}. Annulable à tout moment.
        </Text>

        <Text style={styles.legal}>
          En continuant, tu acceptes les{' '}
          <Text
            style={styles.legalLink}
            accessibilityRole="link"
            onPress={() => void openLegalUrl(TERMS_OF_USE_URL)}
          >
            conditions d’utilisation
          </Text>{' '}
          et la{' '}
          <Text
            style={styles.legalLink}
            accessibilityRole="link"
            onPress={() => void openLegalUrl(PRIVACY_POLICY_URL)}
          >
            politique de confidentialité
          </Text>
          .
        </Text>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  label,
  price,
  period,
  badge,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.planCardSelected]}
      onPress={onPress}
    >
      {badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{label}</Text>
      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{price}</Text>
      <Text style={[styles.planPeriod, selected && styles.planPeriodSelected]}>{period}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 18,
  },
  skipText: {
    color: Colors.textDim,
    fontSize: 15,
  },
  heroCard: {
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244, 196, 83, 0.16)',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 10,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  featureList: {
    gap: 12,
    marginBottom: 20,
  },
  featureCard: {
    paddingVertical: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 19,
  },
  plansRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.text,
    backgroundColor: Colors.surfaceAccent,
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: Colors.text,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planBadgeText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: '800',
  },
  planLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 6,
  },
  planLabelSelected: {
    color: Colors.text,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
  },
  planPriceSelected: {
    color: Colors.text,
  },
  planPeriod: {
    fontSize: 13,
    color: Colors.textDim,
    marginTop: 2,
  },
  planPeriodSelected: {
    color: Colors.textMuted,
  },
  savingsText: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.accentBlue,
    marginBottom: 18,
    fontWeight: '700',
  },
  primaryAction: {
    marginTop: 4,
  },
  secondaryAction: {
    marginTop: 10,
  },
  trialNote: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 14,
    marginBottom: 18,
    lineHeight: 18,
  },
  legal: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textDim,
    lineHeight: 16,
  },
  legalLink: {
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
