const IOS_KEY_ENV = 'EXPO_PUBLIC_REVENUECAT_IOS_KEY';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    isAnonymous: jest.fn(),
    getAppUserID: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(),
  },
  LOG_LEVEL: { ERROR: 'ERROR' },
  INTRO_ELIGIBILITY_STATUS: {
    INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
    INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
    INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
    INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS: 3,
  },
}));

type PurchasesMock = {
  configure: jest.Mock;
  logIn: jest.Mock;
  logOut: jest.Mock;
  isAnonymous: jest.Mock;
  getAppUserID: jest.Mock;
  purchasePackage: jest.Mock;
  restorePurchases: jest.Mock;
  checkTrialOrIntroductoryPriceEligibility: jest.Mock;
};

function loadPurchases(apiKey: string) {
  jest.resetModules();
  process.env[IOS_KEY_ENV] = apiKey;

  const Purchases = require('react-native-purchases').default as PurchasesMock;
  Purchases.logIn.mockResolvedValue({ customerInfo: {}, created: false });
  Purchases.logOut.mockResolvedValue({});
  Purchases.isAnonymous.mockResolvedValue(false);
  Purchases.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
  Purchases.restorePurchases.mockResolvedValue({ entitlements: { active: {} } });

  return { Purchases, purchases: require('./purchases') as typeof import('./purchases') };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env[IOS_KEY_ENV];
  jest.restoreAllMocks();
});

describe('RevenueCat identity', () => {
  it('does nothing before the SDK is configured', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');

    await purchases.identifyPurchasesUser('user-1');
    await purchases.resetPurchasesUser();

    expect(Purchases.logIn).not.toHaveBeenCalled();
    expect(Purchases.logOut).not.toHaveBeenCalled();
  });

  it('does nothing when no API key is set', async () => {
    const { Purchases, purchases } = loadPurchases('');

    purchases.initPurchases();
    await purchases.identifyPurchasesUser('user-1');
    await purchases.resetPurchasesUser();

    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.logIn).not.toHaveBeenCalled();
    expect(Purchases.logOut).not.toHaveBeenCalled();
  });

  it('configures the SDK only once', () => {
    const { Purchases, purchases } = loadPurchases('test-key');

    purchases.initPurchases();
    purchases.initPurchases();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
  });

  it('logs in with the Supabase user id once configured', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    purchases.initPurchases();

    await purchases.identifyPurchasesUser('3f6c1d0e-0000-4000-8000-000000000001');

    expect(Purchases.logIn).toHaveBeenCalledWith('3f6c1d0e-0000-4000-8000-000000000001');
  });

  it('logs out an identified user', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    purchases.initPurchases();

    await purchases.resetPurchasesUser();

    expect(Purchases.logOut).toHaveBeenCalledTimes(1);
  });

  it('skips logOut when the SDK user is already anonymous', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.isAnonymous.mockResolvedValue(true);
    purchases.initPurchases();

    await purchases.resetPurchasesUser();

    expect(Purchases.logOut).not.toHaveBeenCalled();
  });

  it('swallows SDK errors', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    purchases.initPurchases();
    Purchases.logIn.mockRejectedValue(new Error('offline'));
    Purchases.logOut.mockRejectedValue(new Error('offline'));

    await expect(purchases.identifyPurchasesUser('user-1')).resolves.toBeUndefined();
    await expect(purchases.resetPurchasesUser()).resolves.toBeUndefined();
  });

  it('runs identify and reset in call order', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    purchases.initPurchases();

    let finishLogIn: () => void = () => {};
    Purchases.logIn.mockReturnValue(new Promise<void>((resolve) => { finishLogIn = resolve; }));

    const identified = purchases.identifyPurchasesUser('user-1');
    const reset = purchases.resetPurchasesUser();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Purchases.logIn).toHaveBeenCalledTimes(1);
    expect(Purchases.logOut).not.toHaveBeenCalled();

    finishLogIn();
    await Promise.all([identified, reset]);

    expect(Purchases.logOut).toHaveBeenCalledTimes(1);
  });
});

describe('purchase identity guard', () => {
  const USER_ID = '3f6c1d0e-0000-4000-8000-000000000001';
  const PKG = { identifier: '$rc_monthly' } as never;

  it('buys when the SDK is already identified as the Supabase user', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.getAppUserID.mockResolvedValue(USER_ID);
    purchases.initPurchases();

    await purchases.purchasePackage(PKG, USER_ID);

    expect(Purchases.purchasePackage).toHaveBeenCalledWith(PKG);
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it('waits for a pending login before checking the identity', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    purchases.initPurchases();

    let loggedIn = false;
    let finishLogIn: () => void = () => {};
    Purchases.getAppUserID.mockImplementation(async () => (loggedIn ? USER_ID : '$RCAnonymousID:abc'));
    Purchases.logIn.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishLogIn = () => {
          loggedIn = true;
          resolve();
        };
      })
    );

    void purchases.identifyPurchasesUser(USER_ID);
    const purchase = purchases.purchasePackage(PKG, USER_ID);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Purchases.getAppUserID).not.toHaveBeenCalled();
    expect(Purchases.purchasePackage).not.toHaveBeenCalled();

    finishLogIn();
    await purchase;

    expect(Purchases.logIn).toHaveBeenCalledTimes(1);
    expect(Purchases.purchasePackage).toHaveBeenCalledTimes(1);
  });

  it('retries the login once when the SDK is still anonymous', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.getAppUserID
      .mockResolvedValueOnce('$RCAnonymousID:abc')
      .mockResolvedValueOnce(USER_ID);
    purchases.initPurchases();

    await purchases.purchasePackage(PKG, USER_ID);

    expect(Purchases.logIn).toHaveBeenCalledWith(USER_ID);
    expect(Purchases.purchasePackage).toHaveBeenCalledTimes(1);
  });

  it('refuses to buy with a French error when identification failed', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.getAppUserID.mockResolvedValue('$RCAnonymousID:abc');
    Purchases.logIn.mockRejectedValue(new Error('offline'));
    purchases.initPurchases();

    const error = await purchases.purchasePackage(PKG, USER_ID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(purchases.PurchaseIdentityError);
    expect((error as Error).message).toBe(purchases.PURCHASE_IDENTITY_ERROR_MESSAGE);
    expect(Purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('refuses to buy when the SDK identifies another user', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.getAppUserID.mockResolvedValue('3f6c1d0e-0000-4000-8000-000000000002');
    purchases.initPurchases();

    await expect(purchases.purchasePackage(PKG, USER_ID)).rejects.toBeInstanceOf(purchases.PurchaseIdentityError);
    expect(Purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('refuses to buy before the SDK is configured or without a user id', async () => {
    const { Purchases, purchases } = loadPurchases('');

    await expect(purchases.purchasePackage(PKG, USER_ID)).rejects.toBeInstanceOf(purchases.PurchaseIdentityError);

    purchases.initPurchases();
    await expect(purchases.purchasePackage(PKG, '')).rejects.toBeInstanceOf(purchases.PurchaseIdentityError);
    expect(Purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('applies the same guard to restore', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.getAppUserID.mockResolvedValue('$RCAnonymousID:abc');
    Purchases.logIn.mockRejectedValue(new Error('offline'));
    purchases.initPurchases();

    await expect(purchases.restorePurchases(USER_ID)).rejects.toBeInstanceOf(purchases.PurchaseIdentityError);
    expect(Purchases.restorePurchases).not.toHaveBeenCalled();

    Purchases.getAppUserID.mockResolvedValue(USER_ID);
    await purchases.restorePurchases(USER_ID);

    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
  });
});

describe('getIntroEligibility', () => {
  it('is true only for products reported as eligible', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
      eligible: { status: 2 },
      used: { status: 1 },
      unknown: { status: 0 },
      none: { status: 3 },
    });

    await expect(purchases.getIntroEligibility(['eligible', 'used', 'unknown', 'none', 'missing'])).resolves.toEqual({
      eligible: true,
      used: false,
      unknown: false,
      none: false,
      missing: false,
    });
  });

  it('treats a failed check as not eligible', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');
    Purchases.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('offline'));

    await expect(purchases.getIntroEligibility(['a'])).resolves.toEqual({});
  });

  it('skips the SDK call when there is no product', async () => {
    const { Purchases, purchases } = loadPurchases('test-key');

    await expect(purchases.getIntroEligibility([])).resolves.toEqual({});
    expect(Purchases.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
  });
});
