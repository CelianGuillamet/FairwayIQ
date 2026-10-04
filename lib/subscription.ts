export type SubscriptionRow = {
  is_premium: boolean | null;
  expires_at: string | null;
};

export function isSubscriptionActive(
  row: SubscriptionRow | null | undefined,
  now: number = Date.now()
): boolean {
  if (!row || row.is_premium !== true) {
    return false;
  }

  if (row.expires_at == null) {
    return true;
  }

  return new Date(row.expires_at).getTime() > now;
}

export const MANAGE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';

export type PlanKey = 'monthly' | 'annual';

type PackageLike = {
  identifier: string;
  packageType: string;
};

type OfferingLike<T extends PackageLike> = {
  monthly?: T | null;
  annual?: T | null;
  availablePackages: readonly T[];
};

const PLAN_PACKAGES: Record<PlanKey, { packageType: string; identifier: string }> = {
  monthly: { packageType: 'MONTHLY', identifier: '$rc_monthly' },
  annual: { packageType: 'ANNUAL', identifier: '$rc_annual' },
};

export function findPlanPackage<T extends PackageLike>(
  offering: OfferingLike<T> | null | undefined,
  plan: PlanKey
): T | null {
  if (!offering) {
    return null;
  }

  const { packageType, identifier } = PLAN_PACKAGES[plan];
  const candidates = [plan === 'monthly' ? offering.monthly : offering.annual, ...offering.availablePackages];

  return (
    candidates.find(
      (candidate): candidate is T =>
        candidate != null && (candidate.packageType === packageType || candidate.identifier === identifier)
    ) ?? null
  );
}

type IntroPriceLike = {
  price: number;
  cycles: number;
  periodUnit: string;
  periodNumberOfUnits: number;
};

export type FreeTrial = {
  duration: string;
  freeLabel: string;
};

function formatTrialDuration(periodUnit: string, units: number): string | null {
  if (!Number.isInteger(units) || units <= 0) {
    return null;
  }

  switch (periodUnit.toUpperCase()) {
    case 'DAY':
      return `${units} ${units > 1 ? 'jours' : 'jour'}`;
    case 'WEEK':
      return `${units * 7} jours`;
    case 'MONTH':
      return `${units} mois`;
    case 'YEAR':
      return `${units} ${units > 1 ? 'ans' : 'an'}`;
    default:
      return null;
  }
}

export function describeFreeTrial(
  introPrice: IntroPriceLike | null | undefined,
  eligible: boolean
): FreeTrial | null {
  if (!eligible || !introPrice || introPrice.price !== 0) {
    return null;
  }

  const duration = formatTrialDuration(introPrice.periodUnit, introPrice.periodNumberOfUnits * Math.max(introPrice.cycles, 1));

  if (!duration) {
    return null;
  }

  const plural = duration.startsWith('1 ') ? '' : 's';

  return { duration, freeLabel: `${duration} gratuit${plural}` };
}

export function buildSubscriptionDisclosure(
  plan: PlanKey,
  priceString: string | null,
  trial: FreeTrial | null
): { summary: string; terms: string } {
  const planLabel = plan === 'annual' ? 'annuel' : 'mensuel';
  const price = priceString ? `${priceString}/${plan === 'annual' ? 'an' : 'mois'}` : null;

  let summary: string;

  if (!price) {
    summary = `Abonnement Premium ${planLabel} : prix indisponible pour le moment.`;
  } else if (trial) {
    summary = `Abonnement Premium ${planLabel} : ${trial.freeLabel}, puis ${price}.`;
  } else {
    summary = `Abonnement Premium ${planLabel} : ${price}.`;
  }

  const payment = trial
    ? 'Aucun paiement pendant l’essai : le premier paiement est débité de ton compte Apple (Apple ID) à la fin de l’essai.'
    : 'Le paiement est débité de ton compte Apple (Apple ID) à la confirmation de l’achat.';

  const terms = `${payment} L’abonnement se renouvelle automatiquement, sauf si tu l’annules au moins 24 heures avant la fin de la période en cours${trial ? ' (essai inclus)' : ''}. Le renouvellement est débité dans les 24 heures précédant la fin de la période. Tu peux gérer ou annuler ton abonnement à tout moment dans les réglages de ton compte Apple.`;

  return { summary, terms };
}
