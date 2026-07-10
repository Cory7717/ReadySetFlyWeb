import crypto from "crypto";
import { addMonths } from "date-fns";
import { pool } from "../db";
import { getEffectiveMembership } from "../membership";
import type { User } from "@shared/schema";

export const normalizeMembershipPromoCode = (code?: string | null) =>
  String(code || "").trim().toUpperCase().replace(/\s+/g, "");

export type MembershipPromotionRedeemResult = {
  ok: boolean;
  reason?: string;
  message: string;
  promotion?: {
    id: string;
    code: string;
    name: string;
    campaign: string | null;
    partnerName: string | null;
    membershipTier: string;
    membershipStartsAt: string;
    membershipEndsAt: string;
    remainingUses: number | null;
    successMessage: string | null;
  };
};

export const hashPromotionIp = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const userAgentSummary = (value?: string | null) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 180) : null;
};

const mapPromotionRow = (row: any) => ({
  id: String(row.id),
  code: String(row.code),
  name: String(row.name),
  description: row.description ?? null,
  campaign: row.campaign ?? null,
  partnerName: row.partner_name ?? null,
  source: row.source ?? null,
  benefitType: row.benefit_type,
  membershipTier: row.membership_tier,
  membershipDurationMonths: Number(row.membership_duration_months),
  maxTotalRedemptions: row.max_total_redemptions == null ? null : Number(row.max_total_redemptions),
  maxRedemptionsPerUser: Number(row.max_redemptions_per_user),
  redemptionCount: Number(row.redemption_count || 0),
  validFrom: row.valid_from ? new Date(row.valid_from) : null,
  expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  isActive: Boolean(row.is_active),
  successMessage: row.success_message ?? null,
});

export async function redeemMembershipPromotion(args: {
  code?: string | null;
  user: User;
  registrationSessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<MembershipPromotionRedeemResult> {
  const normalizedCode = normalizeMembershipPromoCode(args.code);
  if (!normalizedCode) {
    return { ok: false, reason: "blank", message: "Enter a promo or invitation code." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const promotionResult = await client.query(
      "SELECT * FROM membership_promotions WHERE normalized_code = $1 FOR UPDATE",
      [normalizedCode],
    );
    const rawPromotion = promotionResult.rows[0];
    const now = new Date();

    if (!rawPromotion) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid", message: "That promo code is not available. Check the code and try again." };
    }

    const promotion = mapPromotionRow(rawPromotion);
    const logBase = {
      event: "membership_promotion_redeem_attempt",
      promotionId: promotion.id,
      campaign: promotion.campaign,
      userId: args.user.id,
    };

    const reject = async (reason: string, message: string): Promise<MembershipPromotionRedeemResult> => {
      console.info(JSON.stringify({ ...logBase, event: "membership_promotion_redeem_rejected", reason }));
      await client.query("ROLLBACK");
      return { ok: false, reason, message };
    };

    if (!promotion.isActive) return await reject("inactive", "This promo code is not active.");
    if (promotion.validFrom && promotion.validFrom > now) return await reject("not_yet_active", "This promo code is not active yet.");
    if (promotion.expiresAt && promotion.expiresAt < now) return await reject("expired", "This promo code has expired.");
    if (promotion.benefitType !== "complimentary_membership") return await reject("unsupported_benefit", "This promo code is not valid for membership access.");
    if (promotion.membershipTier !== "premium") return await reject("unsupported_tier", "This promo code cannot be applied to this account.");
    if (!Number.isFinite(promotion.membershipDurationMonths) || promotion.membershipDurationMonths < 1) {
      return await reject("invalid_duration", "This promo code cannot be applied right now.");
    }
    if (promotion.maxTotalRedemptions !== null && promotion.redemptionCount >= promotion.maxTotalRedemptions) {
      return await reject("exhausted", "This promo code has already been fully redeemed.");
    }

    const perUserResult = await client.query(
      "SELECT count(*)::int AS count FROM membership_promotion_redemptions WHERE promotion_id = $1 AND user_id = $2",
      [promotion.id, args.user.id],
    );
    if (Number(perUserResult.rows[0]?.count || 0) >= promotion.maxRedemptionsPerUser) {
      return await reject("already_redeemed", "You have already redeemed this promo code.");
    }

    const currentMembership = getEffectiveMembership(args.user);
    const paidProvider = currentMembership.provider && !["admin_grant", "promotion"].includes(currentMembership.provider);
    const paidActive = paidProvider && currentMembership.status === "active" && (!currentMembership.endsAt || currentMembership.endsAt > now);
    if (paidActive) {
      return await reject("paid_subscription_active", "This account already has active paid Premium access. Contact support if this code should be queued for later.");
    }

    const tierRank = (tier?: string | null) => (String(tier || "free").toLowerCase() === "premium" ? 1 : 0);
    if (tierRank(currentMembership.tier) > tierRank(promotion.membershipTier)) {
      return await reject("higher_tier_active", "This account already has a higher membership tier.");
    }

    const startsAt = now;
    const baseStart = currentMembership.endsAt && currentMembership.endsAt > now && currentMembership.provider === "admin_grant"
      ? currentMembership.endsAt
      : now;
    const endsAt = addMonths(baseStart, promotion.membershipDurationMonths);
    const reason = `Membership promotion: ${promotion.campaign || promotion.name}`;

    const redemptionResult = await client.query(
      `INSERT INTO membership_promotion_redemptions (
        promotion_id,
        user_id,
        normalized_code,
        membership_tier_granted,
        membership_starts_at,
        membership_ends_at,
        previous_membership_tier,
        previous_membership_expires_at,
        registration_session_id,
        ip_hash,
        user_agent_summary
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (promotion_id, user_id) DO NOTHING
      RETURNING id`,
      [
        promotion.id,
        args.user.id,
        normalizedCode,
        promotion.membershipTier,
        startsAt,
        endsAt,
        currentMembership.tier,
        currentMembership.endsAt,
        args.registrationSessionId || null,
        hashPromotionIp(args.ipAddress),
        userAgentSummary(args.userAgent),
      ],
    );
    if (redemptionResult.rowCount !== 1) {
      return await reject("already_redeemed", "You have already redeemed this promo code.");
    }

    await client.query(
      `UPDATE membership_promotions
       SET redemption_count = redemption_count + 1, updated_at = now()
       WHERE id = $1`,
      [promotion.id],
    );

    await client.query(
      `UPDATE users
       SET membership_grant_tier = $1,
           membership_grant_ends_at = $2,
           membership_grant_granted_by = NULL,
           membership_grant_granted_at = $3,
           membership_grant_reason = $4
       WHERE id = $5`,
      [promotion.membershipTier, endsAt, now, reason, args.user.id],
    );

    await client.query("COMMIT");

    const remainingUses = promotion.maxTotalRedemptions === null
      ? null
      : Math.max(0, promotion.maxTotalRedemptions - promotion.redemptionCount - 1);

    console.info(JSON.stringify({
      event: "membership_promotion_redeemed",
      promotionId: promotion.id,
      campaign: promotion.campaign,
      userId: args.user.id,
      remainingUses,
    }));
    console.info(JSON.stringify({
      event: "membership_entitlement_granted",
      promotionId: promotion.id,
      campaign: promotion.campaign,
      userId: args.user.id,
      membershipTier: promotion.membershipTier,
      membershipEndsAt: endsAt.toISOString(),
    }));

    return {
      ok: true,
      message: promotion.successMessage || "Your promo code was redeemed successfully.",
      promotion: {
        id: promotion.id,
        code: promotion.code,
        name: promotion.name,
        campaign: promotion.campaign,
        partnerName: promotion.partnerName,
        membershipTier: promotion.membershipTier,
        membershipStartsAt: startsAt.toISOString(),
        membershipEndsAt: endsAt.toISOString(),
        remainingUses,
        successMessage: promotion.successMessage,
      },
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
