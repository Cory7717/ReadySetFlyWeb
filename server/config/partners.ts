type PartnerConfig = {
  name: string;
  redirectUrl: string;
  active: boolean;
};

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "";
};

const av8mapsRedirect =
  normalizeUrl(process.env.PARTNER_AV8MAPS_REDIRECT_URL || "") || "https://av8maps.com/?ref=rsf";

const isAv8mapsActive = String(process.env.PARTNER_AV8MAPS_ACTIVE ?? "true").toLowerCase() === "true";

export const partners: Record<string, PartnerConfig> = {
  av8maps: {
    name: "Av8Maps",
    redirectUrl: av8mapsRedirect,
    active: isAv8mapsActive,
  },
};

export type PartnerKey = keyof typeof partners;
