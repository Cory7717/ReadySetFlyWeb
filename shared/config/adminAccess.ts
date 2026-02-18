export const ADMIN_PERMISSIONS = [
  "analytics",
  "crm",
  "users",
  "verifications",
  "aircraft",
  "marketplace",
  "stale",
  "promo",
  "promo-codes",
  "withdrawals",
  "notifications",
  "banners",
  "hk-metrics",
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];
export type AdminRole = "operations" | "finance" | "sales" | "support" | "content" | "housekeeping";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  operations: "Operations",
  finance: "Finance",
  sales: "Sales",
  support: "Support",
  content: "Content",
  housekeeping: "Housekeeping",
};

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  operations: ["analytics", "users", "verifications", "aircraft", "marketplace", "stale", "notifications"],
  finance: ["analytics", "withdrawals"],
  sales: ["crm", "promo", "promo-codes", "banners"],
  support: ["users", "verifications", "notifications"],
  content: ["aircraft", "marketplace", "stale", "banners"],
  housekeeping: ["hk-metrics"],
};

export function normalizeAdminPermissions(role?: AdminRole | null, permissions?: string[] | null) {
  if (role && ADMIN_ROLE_PERMISSIONS[role]) {
    return ADMIN_ROLE_PERMISSIONS[role];
  }
  if (permissions && permissions.length) {
    return permissions.filter((permission) => ADMIN_PERMISSIONS.includes(permission as AdminPermission)) as AdminPermission[];
  }
  return [] as AdminPermission[];
}
