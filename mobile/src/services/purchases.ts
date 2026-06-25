import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { apiEndpoints } from './api';
import { errorDiagnostic, extractApiErrorMessage, logDiagnostic, warnDiagnostic } from '../utils/diagnostics';

export type PurchasesRuntimeStatus = {
  platform: 'ios' | 'android' | 'unsupported';
  apiKeyEnvVar: 'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY' | 'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY' | null;
  configured: boolean;
  enabled: boolean;
  canMakeRealPurchases: boolean;
  isExpoGo: boolean;
  issue:
    | 'missing-apple-key'
    | 'missing-google-key'
    | 'unsupported-platform'
    | 'expo-go'
    | null;
  message: string | null;
};

let configured = false;
let configurePromise: Promise<boolean> | null = null;
let lastLoggedIssue: string | null = null;

function getApiKeyConfig() {
  if (Platform.OS === 'ios') {
    return {
      platform: 'ios' as const,
      apiKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '',
      apiKeyEnvVar: 'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY' as const,
    };
  }
  if (Platform.OS === 'android') {
    return {
      platform: 'android' as const,
      apiKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '',
      apiKeyEnvVar: 'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY' as const,
    };
  }
  return {
    platform: 'unsupported' as const,
    apiKey: '',
    apiKeyEnvVar: null,
  };
}

export function getPurchasesRuntimeStatus(): PurchasesRuntimeStatus {
  const config = getApiKeyConfig();
  const trimmedKey = config.apiKey.trim();
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (config.platform === 'unsupported') {
    return {
      platform: config.platform,
      apiKeyEnvVar: config.apiKeyEnvVar,
      configured: false,
      enabled: false,
      canMakeRealPurchases: false,
      isExpoGo,
      issue: 'unsupported-platform',
      message: 'RevenueCat is only enabled for iOS and Android builds.',
    };
  }

  if (!trimmedKey) {
    return {
      platform: config.platform,
      apiKeyEnvVar: config.apiKeyEnvVar,
      configured: false,
      enabled: false,
      canMakeRealPurchases: false,
      isExpoGo,
      issue: config.platform === 'android' ? 'missing-google-key' : 'missing-apple-key',
      message:
        config.platform === 'android'
          ? 'RevenueCat is disabled because EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY is missing in this build environment.'
          : 'RevenueCat is disabled because EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY is missing in this build environment.',
    };
  }

  if (isExpoGo) {
    return {
      platform: config.platform,
      apiKeyEnvVar: config.apiKeyEnvVar,
      configured: true,
      enabled: true,
      canMakeRealPurchases: false,
      isExpoGo,
      issue: 'expo-go',
      message: 'RevenueCat is running in Expo Go preview mode. Real App Store and Google Play purchases require an Expo development or internal build.',
    };
  }

  return {
    platform: config.platform,
    apiKeyEnvVar: config.apiKeyEnvVar,
    configured: true,
    enabled: true,
    canMakeRealPurchases: true,
    isExpoGo,
    issue: null,
    message: null,
  };
}

function logStatusWarning(status: PurchasesRuntimeStatus) {
  if (!status.issue || lastLoggedIssue === status.issue) return;
  lastLoggedIssue = status.issue;
  warnDiagnostic('purchases', 'disabled_or_limited', {
    platform: status.platform,
    issue: status.issue,
    message: status.message,
    executionEnvironment: Constants.executionEnvironment,
  });
}

function normalizePurchasesError(error: unknown, fallback: string) {
  const raw = error as { userCancelled?: boolean; code?: string; message?: string } | undefined;
  if (raw?.userCancelled) {
    return new Error('Purchase cancelled.');
  }
  if (raw?.code === 'PURCHASES_ERROR_CODE:1') {
    return new Error('Purchase cancelled.');
  }
  return new Error(extractApiErrorMessage(error, fallback));
}

export async function initializePurchases() {
  if (configured) return true;
  if (configurePromise) return configurePromise;

  const status = getPurchasesRuntimeStatus();
  if (!status.enabled) {
    logStatusWarning(status);
    return false;
  }

  const { apiKey } = getApiKeyConfig();
  configurePromise = (async () => {
    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      await Purchases.configure({ apiKey: apiKey.trim() });
      configured = true;
      logDiagnostic('purchases', 'configured', {
        platform: status.platform,
        isExpoGo: status.isExpoGo,
      });
      if (status.issue === 'expo-go') {
        logStatusWarning(status);
      }
      return true;
    } catch (error) {
      configured = false;
      const normalized = normalizePurchasesError(error, 'Unable to initialize RevenueCat.');
      errorDiagnostic('purchases', 'configure_failed', {
        platform: status.platform,
        message: normalized.message,
      });
      return false;
    } finally {
      configurePromise = null;
    }
  })();

  return configurePromise;
}

export async function syncPurchasesUser(appUserId: string | null | undefined) {
  const ready = await initializePurchases();
  if (!ready || !appUserId) return null;
  try {
    await Purchases.logIn(appUserId);
    const customerInfo = await Purchases.getCustomerInfo();
    await syncMembershipCustomerInfo(customerInfo).catch(() => {});
    return customerInfo;
  } catch (error) {
    const normalized = normalizePurchasesError(error, 'Unable to sync RevenueCat user.');
    warnDiagnostic('purchases', 'user_sync_failed', {
      userId: appUserId,
      message: normalized.message,
    });
    return null;
  }
}

export async function logOutPurchasesUser() {
  const ready = await initializePurchases();
  if (!ready) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    const normalized = normalizePurchasesError(error, 'Unable to log out RevenueCat user.');
    warnDiagnostic('purchases', 'logout_failed', { message: normalized.message });
  }
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  const ready = await initializePurchases();
  if (!ready) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    const normalized = normalizePurchasesError(error, 'Unable to load customer purchase status.');
    warnDiagnostic('purchases', 'customer_info_failed', { message: normalized.message });
    return null;
  }
}

export async function getCurrentOfferingSafe(): Promise<PurchasesOffering | null> {
  const ready = await initializePurchases();
  if (!ready) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    const normalized = normalizePurchasesError(error, 'Unable to load RevenueCat offerings.');
    warnDiagnostic('purchases', 'offerings_failed', { message: normalized.message });
    return null;
  }
}

export async function restorePurchasesSafe(): Promise<CustomerInfo | null> {
  const status = getPurchasesRuntimeStatus();
  if (!status.canMakeRealPurchases) {
    throw new Error(status.message || 'RevenueCat purchases are not available in this runtime.');
  }
  const ready = await initializePurchases();
  if (!ready) {
    throw new Error(getPurchasesRuntimeStatus().message || 'RevenueCat is not configured in this build.');
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    await syncMembershipCustomerInfo(customerInfo).catch(() => {});
    return customerInfo;
  } catch (error) {
    throw normalizePurchasesError(error, 'Unable to restore purchases right now.');
  }
}

function normalizeCustomerInfo(customerInfo: CustomerInfo) {
  const raw = customerInfo as any;
  const activeEntitlementIds = Object.keys(raw?.entitlements?.active || {});
  const activeEntitlements = Object.values(raw?.entitlements?.active || {}) as any[];
  const activeProductIds = Array.from(
    new Set(
      [
        ...(Array.isArray(raw?.activeSubscriptions) ? raw.activeSubscriptions : []),
        ...activeEntitlements
          .map((entry) => entry?.productIdentifier || entry?.productPlanIdentifier || null)
          .filter(Boolean),
      ]
    )
  );
  const expirationCandidates = [
    raw?.latestExpirationDate,
    ...activeEntitlements.map((entry) => entry?.expirationDate).filter(Boolean),
  ].filter(Boolean);
  const purchaseCandidates = [
    raw?.latestPurchaseDate,
    ...activeEntitlements.map((entry) => entry?.latestPurchaseDate).filter(Boolean),
  ].filter(Boolean);

  return {
    originalAppUserId: raw?.originalAppUserId || null,
    activeEntitlementIds,
    activeProductIds,
    latestExpirationDate: expirationCandidates[0] || null,
    latestPurchaseDate: purchaseCandidates[0] || null,
  };
}

export async function syncMembershipCustomerInfo(customerInfo: CustomerInfo | null | undefined) {
  if (!customerInfo) return null;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
  if (!platform) return null;
  const payload = normalizeCustomerInfo(customerInfo);
  return apiEndpoints.membership.syncStorePurchase({ platform, customerInfo: payload });
}

export function selectOfferingPackage(
  offering: PurchasesOffering | null,
  tier: 'premium' | 'pro' | 'pro_plus',
  interval: 'monthly' | 'annual' | 'biannual',
): PurchasesPackage | null {
  if (!offering) return null;
  const normalizedTier = tier.toLowerCase();
  const legacyTier = tier === 'premium' ? 'pro' : tier;
  const intervalHints =
    interval === 'monthly'
      ? ['monthly', 'month']
      : interval === 'annual'
        ? ['annual', 'year', 'yearly']
        : ['biannual', '6month', '6-month', 'sixmonth', 'semiannual'];

  const packages = offering.availablePackages || [];
  const exactIdentifiers: Record<'pro' | 'pro_plus', Record<'monthly' | 'annual' | 'biannual', string[]>> = {
    pro: {
      monthly: ['$rc_monthly', 'premium_monthly', 'pro_monthly'],
      annual: ['$rc_annual', 'premium_annual', 'pro_annual'],
      biannual: ['premium_biannual', 'premium_6month', 'premium_6-month', 'pro_biannual', 'pro_6month', 'pro_6-month'],
    },
    pro_plus: {
      monthly: ['pro_plus_monthly'],
      annual: ['pro_plus_annual'],
      biannual: ['pro_plus_biannual', 'pro_plus_6month', 'pro_plus_6-month'],
    },
  };

  const exactMatch = packages.find((pkg) => {
    const identifiers = [`${pkg.identifier}`, `${pkg.product.identifier}`].map((value) => value.toLowerCase());
    return exactIdentifiers[legacyTier][interval].some((expected) => identifiers.includes(expected.toLowerCase()));
  });
  if (exactMatch) return exactMatch;

  const match = packages.find((pkg) => {
    const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
    return id.includes(normalizedTier) && intervalHints.some((hint) => id.includes(hint));
  });

  if (match) return match;

  if ((tier === 'premium' || tier === 'pro') && interval === 'monthly') return offering.monthly ?? null;
  if ((tier === 'premium' || tier === 'pro') && interval === 'annual') return offering.annual ?? null;
  if (interval === 'biannual') return packages.find((pkg) => `${pkg.identifier}`.toLowerCase().includes('6')) ?? null;
  return null;
}

export async function purchasePackageSafe(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  const status = getPurchasesRuntimeStatus();
  if (!status.canMakeRealPurchases) {
    throw new Error(status.message || 'RevenueCat purchases are not available in this runtime.');
  }
  const ready = await initializePurchases();
  if (!ready) {
    throw new Error(getPurchasesRuntimeStatus().message || 'RevenueCat is not configured in this build.');
  }
  try {
    const result = await Purchases.purchasePackage(pkg);
    await syncMembershipCustomerInfo(result.customerInfo).catch(() => {});
    return result.customerInfo;
  } catch (error) {
    throw normalizePurchasesError(error, 'Unable to start the in-app purchase flow.');
  }
}
