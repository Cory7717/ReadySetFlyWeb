import { apiUrl } from "@/lib/api";

const DEFAULT_S3_BASE = "https://readysetfly-images.s3.us-east-2.amazonaws.com";
const rawS3Base =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_S3_PUBLIC_BASE_URL) ||
  (typeof window !== "undefined" && (window as any).__S3_PUBLIC_BASE__) ||
  DEFAULT_S3_BASE;
const S3_PUBLIC_BASE = (() => {
  try {
    const parsed = new URL(rawS3Base);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return rawS3Base;
  }
})();

const getBucketName = () => {
  try {
    const host = new URL(S3_PUBLIC_BASE).host;
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
};

export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/")) return apiUrl(url);
  const bucketName = getBucketName();
  if (url.startsWith("s3://")) {
    const stripped = url.replace(/^s3:\/\//i, "");
    const cleaned = bucketName && stripped.startsWith(`${bucketName}/`)
      ? stripped.slice(bucketName.length + 1)
      : stripped;
    return `${S3_PUBLIC_BASE}/${cleaned.replace(/^\/+/, "")}`;
  }
  if (bucketName && url.startsWith(`${bucketName}/`)) {
    return `${S3_PUBLIC_BASE}/${url.slice(bucketName.length + 1)}`;
  }
  if (bucketName && url.startsWith(`${bucketName}.s3.`)) {
    return `https://${url}`;
  }
  if (url.startsWith("uploads/")) return `${S3_PUBLIC_BASE}/${url}`;
  return apiUrl(`/${url}`);
}
