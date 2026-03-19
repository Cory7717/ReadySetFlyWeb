type PreviewUser = {
  email?: string | null;
  isSuperAdmin?: boolean | null;
};

const INTERNAL_PREVIEW_EMAILS = new Set(["coryarmer@gmail.com"]);

export function canUseInternalPreview(user?: PreviewUser | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;

  const email = user.email?.trim().toLowerCase();
  return Boolean(email && INTERNAL_PREVIEW_EMAILS.has(email));
}
