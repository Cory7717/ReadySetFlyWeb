import { resolveDepartureAirportTimezone } from "./airport-timezones";

type PlannerStateLike = {
  planningReferenceDepartureAirport?: unknown;
};

type FlightPlanTimeLike = {
  id?: string | null;
  departure?: string | null;
  destination?: string | null;
  plannedDepartureAt?: Date | string | null;
  plannerState?: unknown;
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asString = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const formatPartsInTimezone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || "";
  const displayDate = [part("month"), part("day"), part("year")].filter(Boolean).join("/");
  const displayTime = `${part("hour")}:${part("minute")} ${part("dayPeriod")}`.trim();
  const displayTimezoneAbbreviation = part("timeZoneName");
  return {
    displayDate,
    displayTime,
    displayTimezoneAbbreviation,
    displayDepartureAirportTime: [displayDate, displayTime, displayTimezoneAbbreviation].filter(Boolean).join(", ").replace(", ", " "),
  };
};

export const formatZulu = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}Z`;
};

export const resolvePlanDepartureTimezone = (plan: FlightPlanTimeLike) => {
  const plannerState = asRecord(plan.plannerState) as PlannerStateLike;
  const planningReferenceDepartureAirport = asString(plannerState.planningReferenceDepartureAirport)?.toUpperCase() || null;
  return resolveDepartureAirportTimezone({
    departureAirport: {
      icao: plan.departure || null,
    },
    planningReferenceDepartureAirport: planningReferenceDepartureAirport
      ? { icao: planningReferenceDepartureAirport }
      : null,
  });
};

export const formatFlightPlanDepartureTime = (
  plan: FlightPlanTimeLike,
  options: { instantUtc?: Date | string | null } = {},
) => {
  const departureTimezone = resolvePlanDepartureTimezone(plan).timezone;
  const departureInstantUtc = options.instantUtc ?? plan.plannedDepartureAt ?? null;
  const date = departureInstantUtc ? new Date(departureInstantUtc) : null;
  const displayZulu = formatZulu(date);
  if (!date || Number.isNaN(date.getTime()) || !departureTimezone) {
    return {
      departureTimezone: departureTimezone || null,
      departureInstantUtc: null,
      displayDate: "-",
      displayTime: "-",
      displayTimezoneAbbreviation: "",
      displayDepartureAirportTime: "-",
      displayZulu,
    };
  }

  const parts = formatPartsInTimezone(date, departureTimezone);
  return {
    departureTimezone,
    departureInstantUtc: date.toISOString(),
    displayZulu,
    ...parts,
  };
};
