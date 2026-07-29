export const HOTEL_LOCATION = {
  latitude: Number(process.env.COURTYARD_HOTEL_LATITUDE || 30.4654),
  longitude: Number(process.env.COURTYARD_HOTEL_LONGITUDE || -97.7987),
};

export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function distanceBand(miles: number) {
  if (miles <= 10) return "0–10 miles";
  if (miles <= 25) return "10–25 miles";
  if (miles <= 50) return "25–50 miles";
  return "50–75 miles";
}

export function prospectScore(input: {
  distanceMiles: number;
  evidenceClass: string;
  signals?: string[];
  industry?: string | null;
  historicalRevenue?: number;
}) {
  const distance = input.distanceMiles <= 10 ? 30 : input.distanceMiles <= 25 ? 25 : input.distanceMiles <= 50 ? 18 : 10;
  const evidence: Record<string, number> = {
    proven_producer: 35,
    former_producer: 30,
    event_linked: 24,
    regional_strategic: 18,
    local_prospect: 14,
    manually_identified: 16,
  };
  const signalText = (input.signals || []).join(" ").toLowerCase();
  const signal = /training|headquarters|regional office|project|crew|conference|meeting|recruit/.test(signalText) ? 20 : input.signals?.length ? 12 : 4;
  const industry = /construction|manufactur|health|technology|government|education|engineering|distribution|logistics|financial/i.test(input.industry || "") ? 15 : 7;
  const historyBonus = input.historicalRevenue ? Math.min(10, Math.round(Math.log10(input.historicalRevenue + 1) * 2)) : 0;
  return Math.max(0, Math.min(100, distance + (evidence[input.evidenceClass] || 10) + signal + industry + historyBonus));
}

export function targetRoles(industry = "", signals: string[] = []) {
  const text = `${industry} ${signals.join(" ")}`.toLowerCase();
  const roles = new Set(["Office Manager", "Travel or Procurement Manager", "Human Resources"]);
  if (/training|education|manufactur|construction/.test(text)) roles.add("Learning & Development or Training Coordinator");
  if (/construction|project|engineering|crew/.test(text)) roles.add("Operations or Project Manager");
  if (/event|conference|sports|tournament/.test(text)) roles.add("Event or Program Coordinator");
  return Array.from(roles);
}

export async function discoverRegionalBusinesses() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Google Places is not configured. Add GOOGLE_PLACES_API_KEY to enable regional business discovery."), { statusCode: 503 });
  const queries = [
    "corporate headquarters and regional offices near Cedar Park Texas",
    "corporate training centers near Round Rock Texas",
    "manufacturing and distribution companies near Georgetown Texas",
    "construction engineering companies near Austin Texas",
    "corporate headquarters near San Marcos Texas",
    "major employers near Temple Texas",
  ];
  const all: any[] = [];
  for (const query of queries) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.businessStatus",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 20, rankPreference: "RELEVANCE", locationBias: { circle: { center: HOTEL_LOCATION, radius: 50000 } } }),
    });
    if (!response.ok) throw new Error(`Google Places discovery failed (${response.status}).`);
    const body: any = await response.json();
    all.push(...(body.places || []));
  }
  const unique = new Map<string, any>();
  for (const place of all) {
    if (!place.id || place.businessStatus === "CLOSED_PERMANENTLY" || !place.location) continue;
    const miles = distanceMiles(HOTEL_LOCATION.latitude, HOTEL_LOCATION.longitude, place.location.latitude, place.location.longitude);
    if (miles > 75) continue;
    const industry = place.primaryTypeDisplayName?.text || "Business";
    const signals = ["Regional employer or business location identified through Google Places; training demand is not yet verified"];
    unique.set(place.id, {
      sourceId: place.id,
      companyName: place.displayName?.text || "Unnamed business",
      address: place.formattedAddress || null,
      city: null,
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      distanceMiles: miles,
      distanceBand: distanceBand(miles),
      industry,
      website: place.websiteUri || null,
      phone: place.nationalPhoneNumber || null,
      sourceUrl: place.googleMapsUri || null,
      opportunitySignalsJson: signals,
      targetRolesJson: targetRoles(industry, signals),
      evidenceClass: miles <= 25 ? "local_prospect" : "regional_strategic",
      opportunityScore: prospectScore({ distanceMiles: miles, evidenceClass: miles <= 25 ? "local_prospect" : "regional_strategic", signals, industry }),
      rationale: "Location and business category are verified by Google Places. Travel, training, meeting, and room-night potential require DOS qualification.",
    });
  }
  return Array.from(unique.values()).sort((a, b) => b.opportunityScore - a.opportunityScore);
}
