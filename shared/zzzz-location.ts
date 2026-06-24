export const LEIDOS_NAS_LOCATION_PATTERN = /^[0-9]{4}[NS]?\/?[0-9]{4,5}[EW]?$/i;
export const FAA_LOCATION_IDENTIFIER_PATTERN = /^[A-Z0-9]{3,5}$/;

const pad = (value: number, length: number) => String(value).padStart(length, "0");

export const formatDecimalCoordinatesForLeidos = (latitude: number, longitude: number): string | null => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const latHemisphere = latitude >= 0 ? "N" : "S";
  const lonHemisphere = longitude >= 0 ? "E" : "W";
  const absLat = Math.abs(latitude);
  const absLon = Math.abs(longitude);
  const latDegrees = Math.floor(absLat);
  const lonDegrees = Math.floor(absLon);
  const latMinutes = Math.round((absLat - latDegrees) * 60);
  const lonMinutes = Math.round((absLon - lonDegrees) * 60);

  const normalizedLatDegrees = latMinutes === 60 ? latDegrees + 1 : latDegrees;
  const normalizedLonDegrees = lonMinutes === 60 ? lonDegrees + 1 : lonDegrees;
  const normalizedLatMinutes = latMinutes === 60 ? 0 : latMinutes;
  const normalizedLonMinutes = lonMinutes === 60 ? 0 : lonMinutes;

  if (normalizedLatDegrees > 90 || normalizedLonDegrees > 180) return null;
  return `${pad(normalizedLatDegrees, 2)}${pad(normalizedLatMinutes, 2)}${latHemisphere}${pad(normalizedLonDegrees, 3)}${pad(normalizedLonMinutes, 2)}${lonHemisphere}`;
};

export const normalizeZzzzActualLocation = (value?: string | null): string | null => {
  const normalized = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized || normalized === "ZZZZ") return null;
  if (FAA_LOCATION_IDENTIFIER_PATTERN.test(normalized)) return normalized;
  if (LEIDOS_NAS_LOCATION_PATTERN.test(normalized)) return normalized;
  return null;
};

export const isValidZzzzActualLocation = (value?: string | null) =>
  Boolean(normalizeZzzzActualLocation(value));
