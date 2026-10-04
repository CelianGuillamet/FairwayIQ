import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Numerals, PRIVACY_POLICY_URL, Radius, Spacing, TERMS_OF_USE_URL, Typography } from '../constants';
import type { ThemeColors } from '../constants';
import { useThemedStyles } from '../lib/theme';
import { openLegalUrl } from '../lib/legal';
import {
  getIntroEligibility,
  getOfferings,
  isPremium,
  PurchaseIdentityError,
  purchasePackage,
  restorePurchases,
} from '../lib/purchases';
import {
  buildSubscriptionDisclosure,
  describeFreeTrial,
  findPlanPackage,
  MANAGE_SUBSCRIPTION_URL,
  type PlanKey,
} from '../lib/subscription';
import { useAuthStore } from '../stores/auth';
import { useSubscriptionStore } from '../stores/subscription';
import { AppButton } from '../components/ui/AppButton';
import { Icon, type IconName } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { TextAction } from '../components/ui/TextAction';

const FEATURES: readonly { icon: IconName; title: string; desc: string }[] = [
  { icon: 'target', title: 'Débrief conversationnel', desc: 'Pose tes questions après le round et clarifie les coups qui t’ont coûté des points.' },
  { icon: 'sparkles', title: 'Coach IA étendu', desc: 'Jusqu’à 30 analyses et échanges avec le coach IA par jour, contre 3 en version gratuite.' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState<Awaited<ReturnType<typeof getOfferings>>>(null);
  const [introEligibility, setIntroEligibility] = useState<Record<string, boolean>>({});
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const value = await getOfferings();
      const productIds = (['monthly', 'annual'] as const)
        .map((plan) => findPlanPackage(value, plan)?.product.identifier)
        .filter((id): id is string => typeof id === 'string');
      const eligibility = await getIntroEligibility(productIds);

      if (!active) {
        return;
      }

      setOfferings(value);
      setIntroEligibility(eligibility);
      setLoadingOfferings(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const monthlyPackage = findPlanPackage(offerings, 'monthly');
  const annualPackage = findPlanPackage(offerings, 'annual');
  const monthlyPriceString = monthlyPackage?.product.priceString ?? null;
  const annualPriceString = annualPackage?.product.priceString ?? null;
  const annualPricePerMonthString = annualPackage?.product.pricePerMonthString ?? null;
  const selectedPackage = selectedPlan === 'annual' ? annualPackage : monthlyPackage;
  const freeTrial = selectedPackage
    ? describeFreeTrial(selectedPackage.product.introPrice, introEligibility[selectedPackage.product.identifier] === true)
    : null;
  const disclosure = buildSubscriptionDisclosure(selectedPlan, selectedPackage?.product.priceString ?? null, freeTrial);

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

    if (!selectedPackage) {
      Alert.alert('Offre indisponible', 'Cette formule n’est pas disponible pour le moment. Choisis l’autre formule ou réessaie plus tard.');
      return;
    }

    const userId = useAuthStore.getState().user?.id;

    if (!userId) {
      Alert.alert('Erreur', 'Connecte-toi pour t’abonner.');
      return;
    }

    setLoading(true);

    try {
      const info = await purchasePackage(selectedPackage, userId);
      if (isPremium(info)) {
        useSubscriptionStore.getState().markPremium();
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (error instanceof PurchaseIdentityError) {
        Alert.alert('Erreur', error.message);
      } else if (!error?.userCancelled) {
        Alert.alert('Erreur', error?.message ?? 'Achat impossible.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    const userId = useAuthStore.getState().user?.id;

    if (!userId) {
      Alert.alert('Erreur', 'Connecte-toi pour restaurer tes achats.');
      return;
    }

    setLoading(true);

    try {
      const info = await restorePurchases(userId);
      if (isPremium(info)) {
        useSubscriptionStore.getState().markPremium();
        Alert.alert('Abonnement restauré', 'Ton accès Premium est de nouveau actif.', [
          { text: 'Continuer', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        Alert.alert('Aucun achat trouvé', 'Aucun abonnement actif n’est associé à ce compte.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de restaurer les achats. Vérifie ta connexion, puis réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.skipRow}>
          <TextAction label="Passer" tone="muted" onPress={() => router.replace('/(tabs)')} style={styles.alignEnd} />
        </View>

        <PageHeader
          title="Le mode coach complet"
          subtitle="Débloque une version nettement plus utile de l’app, pensée pour progresser sérieusement."
        />

        <View style={styles.featureList}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={22} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.plansRow} accessibilityRole="radiogroup" accessibilityLabel="Choisir une formule">
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
          label={freeTrial ? `Commencer l’essai gratuit de ${freeTrial.duration}` : 'S’abonner'}
          onPress={() => void handlePurchase()}
          loading={loading}
          disabled={loadingOfferings}
          style={styles.primaryAction}
        />

        {loadingOfferings ? null : (
          <View style={styles.disclosure}>
            <Text style={styles.disclosureSummary}>{disclosure.summary}</Text>
            <Text style={styles.disclosureTerms}>{disclosure.terms}</Text>
          </View>
        )}

        <View style={styles.quietActions}>
          {loadingOfferings ? null : (
            <TextAction
              label="Gérer mon abonnement"
              role="link"
              tone="muted"
              underline
              onPress={() => void openLegalUrl(MANAGE_SUBSCRIPTION_URL)}
              accessibilityHint="Ouvre les réglages d’abonnement Apple"
              style={styles.alignCenter}
            />
          )}
          <TextAction
            label="Restaurer mes achats"
            tone="muted"
            underline
            onPress={() => void handleRestore()}
            disabled={loading}
            style={styles.alignCenter}
          />
        </View>

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
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.planCard, selected && styles.planCardSelected, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${price}${period}${badge ? `, ${badge}` : ''}`}
    >
      {badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={styles.planPrice}>{price}</Text>
      <Text style={styles.planPeriod}>{period}</Text>
    </Pressable>
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
    skipRow: {
      alignItems: 'flex-end',
    },
    alignEnd: {
      alignSelf: 'flex-end',
    },
    alignCenter: {
      alignSelf: 'center',
    },
    featureList: {
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    featureIcon: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: colors.sunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      flex: 1,
    },
    featureTitle: {
      ...Typography.bodyStrong,
      color: colors.ink,
    },
    featureDesc: {
      ...Typography.body,
      color: colors.ink2,
    },
    plansRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xxs,
      marginBottom: Spacing.sm,
    },
    planCard: {
      flex: 1,
      minHeight: 112,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: 17,
      borderWidth: 1,
      borderColor: colors.lineStrong,
    },
    planCardSelected: {
      borderWidth: 2,
      borderColor: colors.ink,
      padding: 16,
    },
    pressed: {
      opacity: 0.8,
    },
    planBadge: {
      position: 'absolute',
      top: -12,
      backgroundColor: colors.ink,
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    planBadgeText: {
      ...Typography.caption,
      fontFamily: Fonts.sansBold,
      color: colors.onInk,
    },
    planLabel: {
      ...Typography.label,
      color: colors.ink2,
      marginBottom: 4,
    },
    planPrice: {
      ...Typography.titleMd,
      ...Numerals,
      color: colors.ink,
    },
    planPeriod: {
      ...Typography.label,
      color: colors.ink2,
    },
    savingsText: {
      ...Typography.label,
      color: colors.ink2,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    primaryAction: {
      marginTop: Spacing.xs,
    },
    disclosure: {
      marginTop: Spacing.md,
      gap: 6,
    },
    disclosureSummary: {
      ...Typography.bodyStrong,
      color: colors.ink,
      textAlign: 'center',
    },
    disclosureTerms: {
      ...Typography.label,
      fontFamily: Typography.body.fontFamily,
      lineHeight: 19,
      color: colors.ink2,
      textAlign: 'center',
    },
    quietActions: {
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    legal: {
      ...Typography.caption,
      lineHeight: 18,
      color: colors.ink2,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    legalLink: {
      color: colors.ink,
      textDecorationLine: 'underline',
    },
  });
