import { useEffect } from "react";
import { apiUrl } from "@/lib/api";

export default function BannerAdPaymentRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = apiUrl(`/banner-ad-payment${window.location.search || ""}`);
    window.location.replace(target);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Redirecting to secure payment...
    </div>
  );
}
