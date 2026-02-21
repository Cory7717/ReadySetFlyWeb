type PartnerConfig = {
  name: string;
  baseUrl: string;
  redirectUrl: string;
  active: boolean;
  utm: {
    source: string;
    medium: string;
    campaign: string;
  };
};

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "";
};

const defaultAv8mapsBase =
  normalizeUrl(
    process.env.AV8MAPS_BASE_URL ||
      process.env.PARTNER_AV8MAPS_BASE_URL ||
      process.env.PARTNER_AV8MAPS_REDIRECT_URL ||
      "https://av8maps.com"
  ) || "https://av8maps.com";

const av8mapsRedirect =
  normalizeUrl(process.env.PARTNER_AV8MAPS_REDIRECT_URL || "") ||
  `${defaultAv8mapsBase}${defaultAv8mapsBase.includes("?") ? "&" : "?"}ref=rsf`;

const av8mapsUtm = {
  source: (process.env.AV8MAPS_UTM_SOURCE || "readysetfly").trim(),
  medium: (process.env.AV8MAPS_UTM_MEDIUM || "featured_partner").trim(),
  campaign: (process.env.AV8MAPS_UTM_CAMPAIGN || "av8maps_partner").trim(),
};

const isAv8mapsActive = String(process.env.PARTNER_AV8MAPS_ACTIVE ?? "true").toLowerCase() === "true";

export const partners: Record<string, PartnerConfig> = {
  av8maps: {
    name: "Av8Maps",
    baseUrl: defaultAv8mapsBase,
    redirectUrl: av8mapsRedirect,
    active: isAv8mapsActive,
    utm: av8mapsUtm,
  },
};

export type PartnerKey = keyof typeof partners;
