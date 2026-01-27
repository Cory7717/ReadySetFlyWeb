import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { useLocation } from "wouter";

interface NextStepCTAProps {
  label: string;
  type?: "flight-school" | "cfi" | "aircraft-sale" | "charter";
  location?: string;
  radius?: string;
  tags?: string[];
}

function buildMarketplaceUrl(params: NextStepCTAProps) {
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  if (params.location) search.set("location", params.location);
  if (params.radius) search.set("radius", params.radius);
  if (params.tags && params.tags.length) search.set("tags", params.tags.join(","));
  const query = search.toString();
  return `/marketplace${query ? `?${query}` : ""}`;
}

export function NextStepCTA({ label, ...params }: NextStepCTAProps) {
  const [, navigate] = useLocation();
  const target = buildMarketplaceUrl(params);

  return (
    <Button
      variant="default"
      onClick={() => {
        trackEvent("student_cta_click", { label, target, type: params.type });
        navigate(target);
      }}
    >
      {label}
    </Button>
  );
}
