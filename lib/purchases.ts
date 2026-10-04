import Purchases, { INTRO_ELIGIBILITY_STATUS, LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let configured = false;
let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  queue = queue.then(task);
  return queue;
}

export const PURCHASE_IDENTITY_ERROR_MESSAGE =
  'Impossible de vérifier ton compte pour cet achat. Vérifie ta connexion, puis réessaie. Tu n’as pas été débité.';

export class PurchaseIdentityError extends Error {
  constructor() {
    super(PURCHASE_IDENTITY_ERROR_MESSAGE);
    this.name = 'PurchaseIdentityError';
  }
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function initPurchases(userId?: string) {
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  const key = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!key) {
    if (__DEV__) {
      console.warn('[purchases] Missing RevenueCat API key for', Platform.OS, '— skipping init. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.');
    }
    return;
  }
  if (configured) {
    return;
  }
  Purchases.configure({ apiKey: key, appUserID: userId });
  configured = true;
}

export function identifyPurchasesUser(userId: string): Promise<void> {
  if (!configured) {
    return Promise.resolve();
  }

  return enqueue(async () => {
    try {
      await Purchases.logIn(userId);
    } catch (error) {
      console.warn('[purchases] logIn failed', { message: describeError(error) });
    }
  });
}

export function resetPurchasesUser(): Promise<void> {
  if (!configured) {
    return Promise.resolve();
  }

  return enqueue(async () => {
    try {
      if (await Purchases.isAnonymous()) {
        return;
      }
      await Purchases.logOut();
    } catch (error) {
      console.warn('[purchases] logOut failed', { message: describeError(error) });
    }
  });
}

export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

async function readAppUserId() {
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

// RevenueCat attributes a purchase to the current app user id. If login did not
// complete it is an anonymous id that the webhook can never map to a Supabase user.
async function ensureIdentified(userId: string) {
  if (!configured || !userId) {
    throw new PurchaseIdentityError();
  }

  await queue;

  if ((await readAppUserId()) === userId) {
    return;
  }

  await identifyPurchasesUser(userId);

  if ((await readAppUserId()) !== userId) {
    throw new PurchaseIdentityError();
  }
}

export async function getIntroEligibility(productIds: string[]): Promise<Record<string, boolean>> {
  if (productIds.length === 0) {
    return {};
  }

  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);

    return Object.fromEntries(
      productIds.map((id) => [id, result[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE])
    );
  } catch {
    return {};
  }
}

export async function purchasePackage(pkg: Parameters<typeof Purchases.purchasePackage>[0], userId: string) {
  await ensureIdentified(userId);
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(userId: string): Promise<CustomerInfo> {
  await ensureIdentified(userId);
  return Purchases.restorePurchases();
}

export function isPremium(customerInfo: CustomerInfo): boolean {
  return typeof customerInfo.entitlements.active['premium'] !== 'undefined';
}
