const IOS_KEY_ENV = 'EXPO_PUBLIC_REVENUECAT_IOS_KEY';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    isAnonymous: jest.fn(),
  },
  LOG_LEVEL: { ERROR: 'ERROR' },
}));

type PurchasesMock = {
  configure: jest.Mock;
  logIn: jest.Mock;
  logOut: jest.Mock;
  isAnonymous: jest.Mock;
};

function loadPurchases(apiKey: string) {
  jest.resetModules();
  process.env[IOS_KEY_ENV] = apiKey;

  const Purchases = require('react-native-purchases').default as PurchasesMock;
  Purchases.logIn.mockResolvedValue({ customerInfo: {}, created: false });
  Purchases.logOut.mockResolvedValue({});
  Purchases.isAnonymous.mockResolvedValue(false);

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
