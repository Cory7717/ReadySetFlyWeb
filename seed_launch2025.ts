import { db } from "./server/db";
import { promoCodes } from "./shared/schema";
import { eq } from "drizzle-orm";

async function seedLaunch2025() {
  try {
    // Check if it already exists
    const existing = await db.select().from(promoCodes).where(eq(promoCodes.code, "LAUNCH2025"));
    if (existing.length > 0) {
      console.log("✅ LAUNCH2025 promo code already exists");
      return;
    }

    // Insert LAUNCH2025 promo code
    await db.insert(promoCodes).values({
      code: "LAUNCH2025",
      description: "Launch promotion: 20% off subscription + free creation fee",
      discountType: "percentage",
      discountValue: "20.00",
      isActive: true,
      applicableToMarketplace: false,
      applicableToBannerAds: true,
      applicableCategories: [],
      maxUses: null,
      usedCount: 0,
    });

    console.log("✅ Successfully seeded LAUNCH2025 promo code");
  } catch (error) {
    console.error("❌ Error seeding promo code:", error);
    process.exit(1);
  }
  process.exit(0);
}

seedLaunch2025();
