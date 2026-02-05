import type { User } from "@shared/schema";
import type { IStorage } from "./storage";
import { paypalRequest } from "./paypal-client";
import { mapPayPalStatusToMembership, resolveMembershipFromPlanId, type BillingInterval } from "./membership";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const subscriptionSyncCache = new Map<string, number>();

export async function maybeSyncLogbookProSubscription(storage: IStorage, user: User): Promise<User> {
  const subscriptionId = user.paypalSubscriptionId || user.logbookProSubscriptionId;
  if (!subscriptionId) return user;

  const now = Date.now();
  const lastSync = subscriptionSyncCache.get(user.id) || 0;
  if (now - lastSync < SYNC_INTERVAL_MS) {
    return user;
  }

  subscriptionSyncCache.set(user.id, now);

  try {
    const subscription = await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`, {
      method: "GET",
    });

    const nextStatus = (subscription?.status || "UNKNOWN").toLowerCase();
    const planInfo = resolveMembershipFromPlanId(subscription?.plan_id);
    const startedAt = subscription?.start_time ? new Date(subscription.start_time) : undefined;
    const nextBillingAt = subscription?.billing_info?.next_billing_time
      ? new Date(subscription.billing_info.next_billing_time)
      : undefined;
    const lastPaymentAt = subscription?.billing_info?.last_payment?.time
      ? new Date(subscription.billing_info.last_payment.time)
      : undefined;
    const interval =
      planInfo?.interval ||
      (user.membershipInterval as BillingInterval | null) ||
      (user.logbookProPlan as BillingInterval | null) ||
      null;
    const isTrial = interval === "monthly" && nextBillingAt && !lastPaymentAt;
    const membershipStatus = isTrial ? "trialing" : mapPayPalStatusToMembership(nextStatus);

    const updates: Partial<User> = {
      membershipStatus,
      membershipProvider: "paypal",
      membershipEndsAt: nextBillingAt,
      membershipInterval: interval || undefined,
      membershipTrialEndsAt: isTrial ? nextBillingAt : undefined,
      membershipNextBillingAt: nextBillingAt,
      paypalSubscriptionId: subscription?.id || subscriptionId,
      paypalPlanId: subscription?.plan_id || user.paypalPlanId,
    };

    if (planInfo) {
      updates.membershipTier = planInfo.tier;
      updates.logbookProPlan = planInfo.interval;
    }

    if (startedAt) updates.logbookProStartedAt = startedAt;
    if (nextBillingAt) updates.logbookProEndsAt = nextBillingAt;

    if (planInfo?.tier || user.logbookProSubscriptionId) {
      updates.logbookProStatus =
        membershipStatus === "active" || membershipStatus === "trialing" ? "active" : nextStatus;
      updates.logbookProSubscriptionId = subscription?.id || user.logbookProSubscriptionId;
    }

    if (nextStatus === "cancelled" || nextStatus === "expired") {
      updates.logbookProCanceledAt = subscription?.status_update_time
        ? new Date(subscription.status_update_time)
        : new Date();
      updates.logbookProCancelAtPeriodEnd = false;
    }

    const updated = await storage.updateUser(user.id, updates);
    return updated || user;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/does not exist/i.test(message)) {
      const updates: Partial<User> = {
        membershipTier: "free",
        membershipStatus: "inactive",
        membershipProvider: null,
        membershipEndsAt: null,
        paypalSubscriptionId: null,
        paypalPlanId: null,
        logbookProStatus: "inactive",
        logbookProSubscriptionId: null,
        logbookProEndsAt: null,
        logbookProCanceledAt: new Date(),
        logbookProCancelAtPeriodEnd: false,
      };
      const updated = await storage.updateUser(user.id, updates);
      return updated || { ...user, ...updates };
    }
    console.error("PayPal subscription sync error:", error);
    return user;
  }
}
