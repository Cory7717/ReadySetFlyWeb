export interface PromoCode {
  code: string;
  description: string;
  creationFeeDiscount: number; // Percentage (0-100) or fixed amount
  subscriptionDiscount: number; // Percentage (0-100)
  isPercentage: boolean;
  validFrom: Date;
  validUntil: Date | null; // null = no expiration
  isActive: boolean;
}

export const PROMO_CODES: Record<string, PromoCode> = {
  LAUNCH2025: {
    code: "LAUNCH2025",
    description: "Launch promotion - Free ad creation + 20% off subscription",
    creationFeeDiscount: 100, // 100% off creation fee (waives $40)
    subscriptionDiscount: 20, // 20% off subscription total
    isPercentage: true,
    validFrom: new Date("2025-01-01"),
    validUntil: null, // No expiration for MVP
    isActive: true,
  },
};

export function validatePromoCode(code: string): PromoCode | null {
  const normalizedCode = code.trim().toUpperCase();
  const promo = PROMO_CODES[normalizedCode];
  
  if (!promo || !promo.isActive) {
    return null;
  }
  
  const now = new Date();
  if (now < promo.validFrom) {
    return null;
  }
  
  if (promo.validUntil && now > promo.validUntil) {
    return null;
  }
  
  return promo;
}

export function calculatePromoDiscount(
  creationFee: number,
  subscriptionTotal: number,
  promoCode: string | null
): {
  creationFeeDiscount: number;
  subscriptionDiscount: number;
  totalDiscount: number;
  finalCreationFee: number;
  finalSubscriptionTotal: number;
  finalGrandTotal: number;
} {
  if (!promoCode) {
    return {
      creationFeeDiscount: 0,
      subscriptionDiscount: 0,
      totalDiscount: 0,
      finalCreationFee: creationFee,
      finalSubscriptionTotal: subscriptionTotal,
      finalGrandTotal: creationFee + subscriptionTotal,
    };
  }
  
  const promo = validatePromoCode(promoCode);
  if (!promo) {
    return {
      creationFeeDiscount: 0,
      subscriptionDiscount: 0,
      totalDiscount: 0,
      finalCreationFee: creationFee,
      finalSubscriptionTotal: subscriptionTotal,
      finalGrandTotal: creationFee + subscriptionTotal,
    };
  }
  
  // Calculate creation fee discount
  let creationFeeDiscount = 0;
  if (promo.isPercentage) {
    creationFeeDiscount = (creationFee * promo.creationFeeDiscount) / 100;
  } else {
    creationFeeDiscount = Math.min(promo.creationFeeDiscount, creationFee);
  }
  
  // Calculate subscription discount
  let subscriptionDiscount = 0;
  if (promo.isPercentage) {
    subscriptionDiscount = (subscriptionTotal * promo.subscriptionDiscount) / 100;
  } else {
    subscriptionDiscount = Math.min(promo.subscriptionDiscount, subscriptionTotal);
  }
  
  const totalDiscount = creationFeeDiscount + subscriptionDiscount;
  const finalCreationFee = creationFee - creationFeeDiscount;
  const finalSubscriptionTotal = subscriptionTotal - subscriptionDiscount;
  const finalGrandTotal = finalCreationFee + finalSubscriptionTotal;
  
  return {
    creationFeeDiscount,
    subscriptionDiscount,
    totalDiscount,
    finalCreationFee,
    finalSubscriptionTotal,
    finalGrandTotal,
  };
}
