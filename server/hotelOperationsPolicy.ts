export const HOTEL_OPS_ROLES = [
  "platform_owner",
  "above_property_admin",
  "regional_admin",
  "property_admin",
  "property_manager",
  "property_employee",
] as const;

export type HotelOpsRole = (typeof HOTEL_OPS_ROLES)[number];

export const HOTEL_OPS_MODULES = [
  "operations_reporting",
  "revenue_intelligence",
  "sales_intelligence",
  "staff_scheduling",
  "incident_reporting",
  "restaurant_operations",
  "meeting_group_calendar",
  "budget_financial",
  "bank_deposits",
  "comptroller",
] as const;

export function safeHotelOpsReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/hoteloperations/dashboard";
  try {
    const parsed = new URL(value, "https://readysetfly.us");
    return parsed.pathname.startsWith("/hoteloperations") ? `${parsed.pathname}${parsed.search}` : "/hoteloperations/dashboard";
  } catch {
    return "/hoteloperations/dashboard";
  }
}

export function canInviteHotelOpsRole(actorRole: HotelOpsRole, targetRole: HotelOpsRole): boolean {
  if (actorRole === "platform_owner") return targetRole !== "platform_owner";
  if (actorRole === "above_property_admin") return ["regional_admin", "property_admin", "property_manager", "property_employee"].includes(targetRole);
  if (actorRole === "regional_admin") return ["property_admin", "property_manager", "property_employee"].includes(targetRole);
  if (actorRole === "property_admin") return ["property_manager", "property_employee"].includes(targetRole);
  if (actorRole === "property_manager") return targetRole === "property_employee";
  return false;
}

export function canAccessHotelOpsProperty(role: string, assignedHotelIds: readonly string[], hotelId: string): boolean {
  return role === "platform_owner" || role === "above_property_admin" || assignedHotelIds.includes(hotelId);
}
