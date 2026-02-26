import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AvionicsPage = "MAP" | "NAV" | "FPL" | "NRST" | "PROC" | "DIRECT" | "MENU";

export type AvionicsState = {
  activePage: AvionicsPage;
  cursorMode: boolean;
  selectedFieldIndex: number;
  inputBuffer: string;
  route: string[];
  activeLegIndex: number;
  directToTarget: string | null;
  directToIndex: number;
  navSource: "GPS" | "VLOC";
  mapRangeIndex: number;
  messages: string[];
  approachLoaded: boolean;
  approachActivated: boolean;
  simulatedAircraft: {
    lat: number;
    lon: number;
    headingDeg: number;
    groundTrackDeg: number;
    groundspeedKts: number;
  };
  cdiDeflection: number;
  lastAction: string | null;
};

export type AvionicsScenario = {
  id: string;
  title: string;
  description: string;
  route: string[];
  directToTarget?: string;
  activePage?: AvionicsPage;
};

export type AvionicsDerived = {
  routePoints: Array<{ ident: string; x: number; y: number }>;
  aircraftPoint: { x: number; y: number };
  targetPoint: { x: number; y: number } | null;
  mapRangeNm: number;
  nearestAirports: string[];
  directToOptions: string[];
  activeLegIdent: string | null;
};

export type AvionicsActions = {
  pressButton: (buttonId: string) => void;
  rotateKnob: (knobId: string, delta: number) => void;
  pushKnob: (knobId: string) => void;
  addWaypoint: (ident: string) => void;
  removeWaypoint: (index: number) => void;
  activateLeg: (index: number) => void;
  setPage: (page: AvionicsPage) => void;
  setDirectToTarget: (ident: string | null) => void;
  applyScenario: (scenario: AvionicsScenario) => void;
  setInputBuffer: (value: string) => void;
  clearMessages: () => void;
};

const MAP_RANGES = [5, 10, 20, 40, 80];

const KNOWN_WAYPOINTS: Record<string, { ident: string; lat: number; lon: number }> = {
  KAUS: { ident: "KAUS", lat: 30.197, lon: -97.666 },
  KGTU: { ident: "KGTU", lat: 30.678, lon: -97.679 },
  KHYI: { ident: "KHYI", lat: 29.893, lon: -97.868 },
  KDAL: { ident: "KDAL", lat: 32.847, lon: -96.852 },
  KDFW: { ident: "KDFW", lat: 32.897, lon: -97.038 },
  KHOU: { ident: "KHOU", lat: 29.645, lon: -95.278 },
  KCLL: { ident: "KCLL", lat: 30.588, lon: -96.364 },
  KADS: { ident: "KADS", lat: 32.968, lon: -96.836 },
  KJFK: { ident: "KJFK", lat: 40.642, lon: -73.779 },
  KLAX: { ident: "KLAX", lat: 33.942, lon: -118.408 },
  KLAS: { ident: "KLAS", lat: 36.08, lon: -115.152 },
  KDEN: { ident: "KDEN", lat: 39.856, lon: -104.673 },
};

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeHeading = (deg: number) => {
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};
const smallestAngleDiff = (target: number, current: number) => {
  let diff = (target - current + 540) % 360 - 180;
  if (diff === -180) diff = 180;
  return diff;
};
const approachValue = (current: number, target: number, ratePerSec: number, dt: number) => {
  const delta = target - current;
  const maxStep = ratePerSec * dt;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const resolveWaypoint = (ident: string) => {
  const upper = ident.toUpperCase();
  if (KNOWN_WAYPOINTS[upper]) return KNOWN_WAYPOINTS[upper];
  const seed = hashString(upper);
  const lat = 28 + (seed % 1200) / 100;
  const lon = -101 + ((seed >> 4) % 1200) / 100;
  return { ident: upper, lat, lon };
};

const computeDistance = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  return Math.sqrt(dx * dx + dy * dy);
};

const computeBearing = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const rad = Math.atan2(dx, dy);
  return normalizeHeading((rad * 180) / Math.PI);
};

const defaultRoute = ["KAUS", "KGTU", "KHYI"];

const DEFAULT_STATE: AvionicsState = {
  activePage: "MAP",
  cursorMode: false,
  selectedFieldIndex: 0,
  inputBuffer: "",
  route: defaultRoute,
  activeLegIndex: 0,
  directToTarget: null,
  directToIndex: 0,
  navSource: "GPS",
  mapRangeIndex: 2,
  messages: [],
  approachLoaded: false,
  approachActivated: false,
  simulatedAircraft: {
    lat: 30.05,
    lon: -97.7,
    headingDeg: 90,
    groundTrackDeg: 90,
    groundspeedKts: 110,
  },
  cdiDeflection: 0,
  lastAction: null,
};

const AVIONICS_SCENARIOS: AvionicsScenario[] = [
  {
    id: "direct-to-practice",
    title: "Direct-To practice",
    description: "Open Direct-To, select a waypoint, and activate.",
    route: ["KAUS", "KGTU"],
    directToTarget: "KGTU",
    activePage: "DIRECT",
  },
  {
    id: "three-leg-flight-plan",
    title: "Build a 3-leg flight plan",
    description: "Create a route with a stop and activate the first leg.",
    route: ["KAUS", "KGTU", "KHYI"],
    activePage: "FPL",
  },
  {
    id: "load-approach-demo",
    title: "Load an approach (demo)",
    description: "Simulate loading an approach on the PROC page.",
    route: ["KDAL", "KDFW"],
    activePage: "PROC",
  },
];

export const useAvionicsSimulator = (initialRoute?: string[]) => {
  const [state, setState] = useState<AvionicsState>({
    ...DEFAULT_STATE,
    route: initialRoute && initialRoute.length ? initialRoute : DEFAULT_STATE.route,
  });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      setState((prev) => {
        const route = prev.route;
        const activeIdent = prev.directToTarget ?? route[prev.activeLegIndex];
        if (!activeIdent) return prev;
        const target = resolveWaypoint(activeIdent);
        const aircraft = prev.simulatedAircraft;
        const desiredTrack = computeBearing(aircraft, target);
        const headingDeg = approachValue(aircraft.headingDeg, desiredTrack, 25, dt);
        const rad = (desiredTrack * Math.PI) / 180;
        const distanceStep = (aircraft.groundspeedKts / 3600) * dt * 12;
        const nextAircraft = {
          ...aircraft,
          headingDeg,
          groundTrackDeg: desiredTrack,
          lat: aircraft.lat + Math.cos(rad) * distanceStep,
          lon: aircraft.lon + Math.sin(rad) * distanceStep,
        };
        const distance = computeDistance(nextAircraft, target);
        let activeLegIndex = prev.activeLegIndex;
        let directToTarget = prev.directToTarget;
        if (distance < 0.25) {
          if (directToTarget) {
            directToTarget = null;
          } else if (activeLegIndex < route.length - 1) {
            activeLegIndex += 1;
          }
        }
        const courseError = smallestAngleDiff(desiredTrack, headingDeg);
        const cdiDeflection = clampValue(courseError / 10, -1, 1);
        return {
          ...prev,
          simulatedAircraft: nextAircraft,
          activeLegIndex,
          directToTarget,
          cdiDeflection,
        };
      });
    }, 1000 / 30);
    return () => window.clearInterval(interval);
  }, []);

  const pushMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      messages: [message, ...prev.messages].slice(0, 4),
      lastAction: message,
    }));
  }, []);

  const setPage = useCallback((page: AvionicsPage) => {
    setState((prev) => ({ ...prev, activePage: page, cursorMode: false }));
    pushMessage(`Page set to ${page}.`);
  }, [pushMessage]);

  const pressButton = useCallback(
    (buttonId: string) => {
      const id = buttonId.toLowerCase();
      setState((prev) => {
        let nextPage = prev.activePage;
        let navSource = prev.navSource;
        let cursorMode = prev.cursorMode;
        let approachLoaded = prev.approachLoaded;
        let approachActivated = prev.approachActivated;
        let mapRangeIndex = prev.mapRangeIndex;

        if (["direct-to", "directto", "direct"].includes(id)) {
          nextPage = "DIRECT";
          cursorMode = true;
        } else if (["fpl", "flight-plan", "fpl-key", "tab-flight-plan"].includes(id)) {
          nextPage = "FPL";
        } else if (["proc", "procedures", "proc-key", "tab-procedures"].includes(id)) {
          nextPage = "PROC";
        } else if (["menu"].includes(id)) {
          nextPage = prev.activePage === "MENU" ? "MAP" : "MENU";
        } else if (["nrst"].includes(id)) {
          nextPage = "NRST";
        } else if (["home", "touch-map", "display", "pfd", "mfd"].includes(id)) {
          nextPage = "MAP";
        } else if (["softkeys"].includes(id)) {
          nextPage = "NAV";
        } else if (["cdi"].includes(id)) {
          navSource = prev.navSource === "GPS" ? "VLOC" : "GPS";
        } else if (["obs"].includes(id)) {
          cursorMode = !prev.cursorMode;
        } else if (["msg"].includes(id)) {
          nextPage = "MENU";
        } else if (["range"].includes(id)) {
          mapRangeIndex = clampValue(prev.mapRangeIndex + 1, 0, MAP_RANGES.length - 1);
        } else if (["approach-load"].includes(id)) {
          approachLoaded = true;
          approachActivated = false;
        } else if (["approach-activate"].includes(id)) {
          approachActivated = true;
          approachLoaded = true;
        }

        return {
          ...prev,
          activePage: nextPage,
          navSource,
          cursorMode,
          approachLoaded,
          approachActivated,
          mapRangeIndex,
        };
      });
      pushMessage(`Pressed ${buttonId}.`);
    },
    [pushMessage]
  );

  const rotateKnob = useCallback(
    (knobId: string, delta: number) => {
      let blockedReason: string | null = null;
      let didChange = false;
      setState((prev) => {
        let selectedFieldIndex = prev.selectedFieldIndex;
        let mapRangeIndex = prev.mapRangeIndex;
        let directToIndex = prev.directToIndex;
        const id = knobId.toLowerCase();

        if (id.includes("range")) {
          mapRangeIndex = clampValue(mapRangeIndex + delta, 0, MAP_RANGES.length - 1);
          didChange = mapRangeIndex !== prev.mapRangeIndex;
        } else if (prev.activePage === "FPL") {
          if (!prev.cursorMode) {
            blockedReason = "Enable cursor mode to edit the flight plan.";
            return prev;
          }
          const maxIndex = Math.max(prev.route.length - 1, 0);
          selectedFieldIndex = clampValue(selectedFieldIndex + delta, 0, maxIndex);
          didChange = selectedFieldIndex !== prev.selectedFieldIndex;
        } else if (prev.activePage === "DIRECT") {
          if (!prev.cursorMode) {
            blockedReason = "Enable cursor mode to select Direct-To.";
            return prev;
          }
          const options = prev.route.length ? prev.route : Object.keys(KNOWN_WAYPOINTS);
          const maxIndex = Math.max(options.length - 1, 0);
          directToIndex = clampValue(directToIndex + delta, 0, maxIndex);
          didChange = directToIndex !== prev.directToIndex;
        } else {
          blockedReason = "Rotate the knob on the MAP or FPL pages.";
          return prev;
        }

        if (!didChange) return prev;
        return {
          ...prev,
          selectedFieldIndex,
          mapRangeIndex,
          directToIndex,
        };
      });
      if (blockedReason) {
        pushMessage(blockedReason);
        return;
      }
      pushMessage(`Rotated ${knobId} ${delta > 0 ? "clockwise" : "counterclockwise"}.`);
    },
    [pushMessage]
  );

  const pushKnob = useCallback(
    (knobId: string) => {
      setState((prev) => ({ ...prev, cursorMode: !prev.cursorMode }));
      pushMessage(`Pushed ${knobId}.`);
    },
    [pushMessage]
  );

  const addWaypoint = useCallback(
    (ident: string) => {
      const trimmed = ident.trim().toUpperCase();
      if (!trimmed) return;
      let blockedReason: string | null = null;
      setState((prev) => {
        if (prev.activePage !== "FPL" || !prev.cursorMode) {
          blockedReason = "Open FPL and enable cursor mode to add waypoints.";
          return prev;
        }
        return {
          ...prev,
          route: [...prev.route, trimmed],
          inputBuffer: "",
        };
      });
      if (blockedReason) {
        pushMessage(blockedReason);
        return;
      }
      pushMessage(`Added waypoint ${trimmed}.`);
    },
    [pushMessage]
  );

  const removeWaypoint = useCallback(
    (index: number) => {
      let blockedReason: string | null = null;
      setState((prev) => {
        if (prev.activePage !== "FPL" || !prev.cursorMode) {
          blockedReason = "Enable cursor mode to edit the flight plan.";
          return prev;
        }
        if (index < 0 || index >= prev.route.length) return prev;
        const nextRoute = prev.route.filter((_, idx) => idx !== index);
        const nextActive = clampValue(prev.activeLegIndex, 0, Math.max(nextRoute.length - 1, 0));
        return { ...prev, route: nextRoute, activeLegIndex: nextActive };
      });
      if (blockedReason) {
        pushMessage(blockedReason);
        return;
      }
      pushMessage("Removed waypoint.");
    },
    [pushMessage]
  );

  const activateLeg = useCallback(
    (index: number) => {
      let blockedReason: string | null = null;
      setState((prev) => {
        if (prev.activePage !== "FPL") {
          blockedReason = "Activate legs from the flight plan page.";
          return prev;
        }
        return {
          ...prev,
          activeLegIndex: clampValue(index, 0, Math.max(prev.route.length - 1, 0)),
          directToTarget: null,
        };
      });
      if (blockedReason) {
        pushMessage(blockedReason);
        return;
      }
      pushMessage("Activated leg.");
    },
    [pushMessage]
  );

  const setDirectToTarget = useCallback(
    (ident: string | null) => {
      let blockedReason: string | null = null;
      let navWarning = false;
      setState((prev) => {
        if (ident && !["DIRECT", "NRST"].includes(prev.activePage)) {
          blockedReason = "Press Direct-To before selecting a waypoint.";
          return prev;
        }
        if (ident && prev.navSource === "VLOC") {
          navWarning = true;
        }
        return {
          ...prev,
          directToTarget: ident,
          activePage: ident ? "NAV" : prev.activePage,
        };
      });
      if (blockedReason) {
        pushMessage(blockedReason);
        return;
      }
      if (navWarning) {
        pushMessage("CDI set to VLOC. Switch to GPS for Direct-To guidance.");
      }
      if (ident) {
        pushMessage(`Direct-To ${ident} activated.`);
      }
    },
    [pushMessage]
  );

  const applyScenario = useCallback(
    (scenario: AvionicsScenario) => {
      setState((prev) => ({
        ...prev,
        route: scenario.route,
        activeLegIndex: 0,
        directToTarget: scenario.directToTarget ?? null,
        activePage: scenario.activePage ?? prev.activePage,
        approachLoaded: scenario.id === "load-approach-demo",
        approachActivated: false,
      }));
      pushMessage(`Scenario: ${scenario.title}`);
    },
    [pushMessage]
  );

  const setInputBuffer = useCallback((value: string) => {
    setState((prev) => ({ ...prev, inputBuffer: value }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [] }));
  }, []);

  const derived = useMemo<AvionicsDerived>(() => {
    const routePointsRaw = state.route.map((ident) => resolveWaypoint(ident));
    const aircraft = state.simulatedAircraft;
    const allPoints = [...routePointsRaw, { ident: "ACFT", lat: aircraft.lat, lon: aircraft.lon }];
    const lats = allPoints.map((item) => item.lat);
    const lons = allPoints.map((item) => item.lon);
    const minLat = Math.min(...lats) - 0.2;
    const maxLat = Math.max(...lats) + 0.2;
    const minLon = Math.min(...lons) - 0.2;
    const maxLon = Math.max(...lons) + 0.2;
    const mapTo = (value: number, min: number, max: number) =>
      max === min ? 50 : ((value - min) / (max - min)) * 100;
    const routePoints = routePointsRaw.map((item) => ({
      ident: item.ident,
      x: mapTo(item.lon, minLon, maxLon),
      y: 100 - mapTo(item.lat, minLat, maxLat),
    }));
    const aircraftPoint = {
      x: mapTo(aircraft.lon, minLon, maxLon),
      y: 100 - mapTo(aircraft.lat, minLat, maxLat),
    };
    const targetIdent = state.directToTarget ?? state.route[state.activeLegIndex] ?? null;
    const targetPointRaw = targetIdent ? resolveWaypoint(targetIdent) : null;
    const targetPoint = targetPointRaw
      ? {
          x: mapTo(targetPointRaw.lon, minLon, maxLon),
          y: 100 - mapTo(targetPointRaw.lat, minLat, maxLat),
        }
      : null;
    const nearest = Object.keys(KNOWN_WAYPOINTS)
      .map((ident) => ({
        ident,
        distance: computeDistance(aircraft, KNOWN_WAYPOINTS[ident]),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6)
      .map((item) => item.ident);
    const directToOptions = state.route.length ? state.route : nearest;
    return {
      routePoints,
      aircraftPoint,
      targetPoint,
      mapRangeNm: MAP_RANGES[state.mapRangeIndex],
      nearestAirports: nearest,
      directToOptions,
      activeLegIdent: targetIdent,
    };
  }, [state]);

  return {
    state,
    derived,
    actions: {
      pressButton,
      rotateKnob,
      pushKnob,
      addWaypoint,
      removeWaypoint,
      activateLeg,
      setPage,
      setDirectToTarget,
      applyScenario,
      setInputBuffer,
      clearMessages,
    },
    scenarios: AVIONICS_SCENARIOS,
  };
};
