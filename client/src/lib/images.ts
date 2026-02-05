import { apiUrl } from "@/lib/api";

const DEFAULT_S3_BASE = "https://readysetfly-images.s3.us-east-2.amazonaws.com";
const S3_PUBLIC_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_S3_PUBLIC_BASE_URL) ||
  (typeof window !== "undefined" && (window as any).__S3_PUBLIC_BASE__) ||
  DEFAULT_S3_BASE;

export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/")) return apiUrl(url);
  if (url.startsWith("uploads/")) return `${S3_PUBLIC_BASE}/${url}`;
  return apiUrl(`/${url}`);
}
