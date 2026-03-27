import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { apiEndpoints } from './api';

let configured = false;

function getApiKey() {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '';
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';
  }
  return '';
}

export async function initializePurchases() {
  if (configured) return true;
  const apiKey = getApiKey().trim();
  if (!apiKey) return false;
  await Purchases.configure({ apiKey });
  configured = true;
  return true;
}

export async function syncPurchasesUser(appUserId: string | null | undefined) {
  const ready = await initializePurchases();
  if (!ready || !appUserId) return null;
  await Purchases.logIn(appUserId);
  const customerInfo = await Purchases.getCustomerInfo();
  await syncMembershipCustomerInfo(customerInfo).catch(() => {});
  return customerInfo;
}

export async function logOutPurchasesUser() {
  const ready = await initializePurchases();
  if (!ready) return;
  await Purchases.logOut();
}

export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  const ready = await initializePurchases();
  if (!ready) return null;
  return Purchases.getCustomerInfo();
}

export async function getCurrentOfferingSafe(): Promise<PurchasesOffering | null> {
  const ready = await initializePurchases();
  if (!ready) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function restorePurchasesSafe(): Promise<CustomerInfo | null> {
  const ready = await initializePurchases();
  if (!ready) return null;
  const customerInfo = await Purchases.restorePurchases();
  await syncMembershipCustomerInfo(customerInfo).catch(() => {});
  return customerInfo;
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
  tier: 'pro' | 'pro_plus',
  interval: 'monthly' | 'annual' | 'biannual',
): PurchasesPackage | null {
  if (!offering) return null;
  const normalizedTier = tier.toLowerCase();
  const intervalHints =
    interval === 'monthly'
      ? ['monthly', 'month']
      : interval === 'annual'
        ? ['annual', 'year', 'yearly']
        : ['biannual', '6month', '6-month', 'sixmonth', 'semiannual'];

  const packages = offering.availablePackages || [];
  const match = packages.find((pkg) => {
    const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
    return id.includes(normalizedTier) && intervalHints.some((hint) => id.includes(hint));
  });

  if (match) return match;

  if (interval === 'monthly') return offering.monthly ?? null;
  if (interval === 'annual') return offering.annual ?? null;
  if (interval === 'biannual') return packages.find((pkg) => `${pkg.identifier}`.toLowerCase().includes('6')) ?? null;
  return null;
}

export async function purchasePackageSafe(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  const ready = await initializePurchases();
  if (!ready) return null;
  const result = await Purchases.purchasePackage(pkg);
  await syncMembershipCustomerInfo(result.customerInfo).catch(() => {});
  return result.customerInfo;
}
