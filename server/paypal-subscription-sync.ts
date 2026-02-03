import type { User } from "@shared/schema";
import type { IStorage } from "./storage";
import { paypalRequest } from "./paypal-client";
import { mapPayPalStatusToMembership, resolveMembershipFromPlanId } from "./membership";

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
    const endsAt = subscription?.billing_info?.next_billing_time
      ? new Date(subscription.billing_info.next_billing_time)
      : undefined;

    const updates: Partial<User> = {
      membershipStatus: mapPayPalStatusToMembership(nextStatus),
      membershipProvider: "paypal",
      membershipEndsAt: endsAt,
      paypalSubscriptionId: subscription?.id || subscriptionId,
      paypalPlanId: subscription?.plan_id || user.paypalPlanId,
    };

    if (planInfo) {
      updates.membershipTier = planInfo.tier;
      updates.logbookProPlan = planInfo.interval;
    }

    if (startedAt) updates.logbookProStartedAt = startedAt;
    if (endsAt) updates.logbookProEndsAt = endsAt;

    if (planInfo?.tier || user.logbookProSubscriptionId) {
      updates.logbookProStatus = nextStatus === "active" ? "active" : nextStatus;
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
