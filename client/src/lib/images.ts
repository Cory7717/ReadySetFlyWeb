import { apiUrl } from "@/lib/api";

export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/")) return apiUrl(url);
  return apiUrl(`/${url}`);
}
