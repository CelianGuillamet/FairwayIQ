import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let configured = false;
let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  queue = queue.then(task);
  return queue;
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

export async function purchasePackage(pkg: Parameters<typeof Purchases.purchasePackage>[0]) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export function isPremium(customerInfo: CustomerInfo): boolean {
  return typeof customerInfo.entitlements.active['premium'] !== 'undefined';
}
