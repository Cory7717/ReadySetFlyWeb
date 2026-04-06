#!/usr/bin/env python
"""Fix TS2448 errors in FlightPlannerScreen.tsx by moving declarations before their first use."""

FILE = "c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/screens/FlightPlannerScreen.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)
print(f"Original file: {original_len} chars, {content.count(chr(10))} lines")

def assert_count(s, name, expected=1):
    count = content.count(s)
    assert count == expected, f"Expected {expected} of '{name}', found {count}"
    return count

# ============================================================
# Define all source blocks
# ============================================================

src_activeRoutePoints = (
    "  const activeRoutePoints = useMemo(() => {\n"
    "    if (routeExecutionOverride?.mode !== 'direct-to-diversion') return routePoints;\n"
    "    return [routeExecutionOverride.origin, routeExecutionOverride.target];\n"
    "  }, [routeExecutionOverride, routePoints]);\n"
)

src_plannedRoute = (
    "  const plannedRouteStructureText = useMemo(() => {\n"
    "    const dep = departure.trim().toUpperCase();\n"
    "    const dest = destination.trim().toUpperCase();\n"
    "    const stopList = plannedStops\n"
    "      .split(/[\\s,]+/)\n"
    "      .map((code) => code.trim().toUpperCase())\n"
    "      .filter(Boolean);\n"
    "    const wpList = waypoints\n"
    "      .split(/[\\s,]+/)\n"
    "      .map((code) => code.trim().toUpperCase())\n"
    "      .filter(Boolean);\n"
    "    return [dep, ...stopList, ...wpList, dest].filter(Boolean).join(' ');\n"
    "  }, [departure, destination, plannedStops, waypoints]);\n"
    "  const plannedRouteAnalysis = useMemo(() => analyzeFiledRoute(plannedRouteStructureText), [plannedRouteStructureText]);\n"
    "  const providerRouteAnalysis = useMemo(\n"
    "    () => analyzeFiledRoute(providerRouteSearch?.route || ''),\n"
    "    [providerRouteSearch?.route]\n"
    "  );\n"
    "  const plannedRouteAnchorTokens = useMemo(\n"
    "    () =>\n"
    "      plannedRouteAnalysis.tokens\n"
    "        .filter((token) => isFiledRouteAnchorKind(token.kind))\n"
    "        .map((token) => token.token),\n"
    "    [plannedRouteAnalysis]\n"
    "  );\n"
    "  const providerRouteAnchorTokens = useMemo(\n"
    "    () =>\n"
    "      providerRouteAnalysis.tokens\n"
    "        .filter((token) => isFiledRouteAnchorKind(token.kind))\n"
    "        .map((token) => token.token),\n"
    "    [providerRouteAnalysis]\n"
    "  );\n"
)

src_activeRouteLegs = (
    "  const activeRouteLegs = useMemo(\n"
    "    () =>\n"
    "      buildMobileRouteLegs(activeRoutePoints, {\n"
    "        mode: routeExecutionOverride?.mode === 'direct-to-diversion' ? 'direct-to' : 'planned',\n"
    "      }),\n"
    "    [activeRoutePoints, routeExecutionOverride?.mode]\n"
    "  );\n"
)

src_activeLegDefinition = (
    "  const activeLegDefinition = useMemo(\n"
    "    () => activeRouteLegs[Math.min(activeLegIndex, Math.max(0, activeRouteLegs.length - 1))] || null,\n"
    "    [activeLegIndex, activeRouteLegs]\n"
    "  );\n"
)

src_activeLegBehavior_group = (
    "  const activeLegBehavior = useMemo(\n"
    "    () =>\n"
    "      getMobileRouteLegBehavior(activeLegDefinition, {\n"
    "        legProgressPct: routeProgress?.legProgressPct,\n"
    "        remainingRouteNm: routeProgress?.remainingRouteNm,\n"
    "      }),\n"
    "    [activeLegDefinition, routeProgress?.legProgressPct, routeProgress?.remainingRouteNm]\n"
    "  );\n"
    "  const activeExecutionSegmentPreview = useMemo(\n"
    "    () => getMobileRouteExecutionSegment(activeLegBehavior.profile, { sequenceGateState: 'blocked' }),\n"
    "    [activeLegBehavior.profile]\n"
    "  );\n"
    "  const activeProcedureExecutionProfilePreview = useMemo(\n"
    "    () => getMobileRouteProcedureExecutionProfile(getMobileRouteProcedureContext(activeLegBehavior.profile).kind),\n"
    "    [activeLegBehavior.profile]\n"
    "  );\n"
    "  const activeProcedureCueStackPreview = useMemo(\n"
    "    () => getMobileRouteProcedureCueStack(getMobileRouteProcedureContext(activeLegBehavior.profile).kind),\n"
    "    [activeLegBehavior.profile]\n"
    "  );\n"
    "  const activeProcedureRoleExecutionPolicyPreview = useMemo(\n"
    "    () =>\n"
    "      getMobileRouteProcedureRoleExecutionPolicy(\n"
    "        getMobileRouteProcedureEntryRole(getMobileRouteProcedureContext(activeLegBehavior.profile).kind, {\n"
    "          entryIndexInChain: 0,\n"
    "          entryCount: 1,\n"
    "        }).kind,\n"
    "      ),\n"
    "    [activeLegBehavior.profile]\n"
    "  );\n"
)

src_destinationElevation = (
    "  const destinationElevationFtEstimate = useMemo(\n"
    "    () => terrainProfile?.samples?.[terrainProfile.samples.length - 1]?.elevationFt ?? 0,\n"
    "    [terrainProfile?.samples],\n"
    "  );\n"
)

src_departureRunway = (
    "  const departureRunway = useMemo(\n"
    "    () => resolveDestinationRunway(departureBriefing),\n"
    "    [departureBriefing]\n"
    "  );\n"
)

src_destinationRunway = (
    "  const destinationRunway = useMemo(\n"
    "    () => resolveDestinationRunway(destinationBriefing),\n"
    "    [destinationBriefing]\n"
    "  );\n"
)

src_destinationRunwayCue = (
    "  const destinationRunwayCue = useMemo<DestinationRunwayCue | null>(() => {\n"
    "    const destinationPoint = activeRoutePoints[activeRoutePoints.length - 1];\n"
    "    if (!activeOwnship || !destinationPoint || !destinationRunway) return null;\n"
    "    if (flightPhase !== 'arrival' && flightPhase !== 'surface-arrival') return null;\n"
    "    const destinationElevationFt = terrainProfile?.samples?.[terrainProfile.samples.length - 1]?.elevationFt ?? 0;\n"
    "    const currentAltitudeFt = activeOwnship.altitudeFt ?? simulationAltitudeFt;\n"
    "    return buildArrivalRunwayCue({\n"
    "      ownship: {\n"
    "        lat: activeOwnship.lat,\n"
    "        lon: activeOwnship.lon,\n"
    "        heading: activeOwnship.heading ?? destinationRunway.headingDeg,\n"
    "        altitudeFt: currentAltitudeFt,\n"
    "      },\n"
    "      airport: {\n"
    "        latitude: destinationPoint.latitude,\n"
    "        longitude: destinationPoint.longitude,\n"
    "      },\n"
    "      runway: destinationRunway,\n"
    "      destinationElevationFt,\n"
    "      activeRangeNm: 18,\n"
    "      maxDistanceNm: 30,\n"
    "    });\n"
    "  }, [activeOwnship, activeRoutePoints, destinationRunway, flightPhase, simulationAltitudeFt, terrainProfile?.samples]);\n"
)

src_destinationRunwayOverlay = (
    "  const destinationRunwayOverlay = useMemo<DestinationRunwayOverlay | null>(() => {\n"
    "    const destinationPoint = activeRoutePoints[activeRoutePoints.length - 1];\n"
    "    if (!destinationPoint || !destinationRunway || !destinationRunwayCue) return null;\n"
    "    return buildArrivalRunwayOverlay({\n"
    "      airport: {\n"
    "        latitude: destinationPoint.latitude,\n"
    "        longitude: destinationPoint.longitude,\n"
    "      },\n"
    "      runway: destinationRunway,\n"
    "      approachLengthNm: flightPhase === 'arrival' ? 8 : 5,\n"
    "    });\n"
    "  }, [activeRoutePoints, destinationRunway, destinationRunwayCue, flightPhase]);\n"
)

src_departureRunwayOverlay = (
    "  const departureRunwayOverlay = useMemo<DestinationRunwayOverlay | null>(() => {\n"
    "    const departurePoint = activeRoutePoints[0];\n"
    "    if (!departurePoint || !departureRunway || flightPhase !== 'departure') return null;\n"
    "    return buildDepartureRunwayOverlay({\n"
    "      airport: {\n"
    "        latitude: departurePoint.latitude,\n"
    "        longitude: departurePoint.longitude,\n"
    "      },\n"
    "      runway: departureRunway,\n"
    "    });\n"
    "  }, [activeRoutePoints, departureRunway, flightPhase]);\n"
)

src_activeRunwayOverlay = (
    "  const activeRunwayOverlay = flightPhase === 'arrival' ? destinationRunwayOverlay : departureRunwayOverlay;\n"
)

src_activeRunwayOverlayLabel = (
    "  const activeRunwayOverlayLabel = flightPhase === 'arrival'\n"
    "    ? destinationRunway ? `Final ${destinationRunway.runwayId}` : null\n"
    "    : departureRunway ? `Dep ${departureRunway.runwayId}` : null;\n"
)

# Verify all source blocks exist exactly once
all_blocks = [
    (src_activeRoutePoints, "activeRoutePoints"),
    (src_plannedRoute, "plannedRoute block"),
    (src_activeRouteLegs, "activeRouteLegs"),
    (src_activeLegDefinition, "activeLegDefinition"),
    (src_activeLegBehavior_group, "activeLegBehavior group"),
    (src_destinationElevation, "destinationElevationFtEstimate"),
    (src_departureRunway, "departureRunway"),
    (src_destinationRunway, "destinationRunway"),
    (src_destinationRunwayCue, "destinationRunwayCue"),
    (src_destinationRunwayOverlay, "destinationRunwayOverlay"),
    (src_departureRunwayOverlay, "departureRunwayOverlay"),
    (src_activeRunwayOverlay, "activeRunwayOverlay"),
    (src_activeRunwayOverlayLabel, "activeRunwayOverlayLabel"),
]

print("\nVerifying source blocks...")
for s, name in all_blocks:
    count = content.count(s)
    assert count == 1, f"Expected 1 of '{name}', found {count}"
    print(f"  OK: {name}")

# ============================================================
# MOVE 1: activeRoutePoints + plannedRoute* + activeRouteLegs + activeLegDefinition
# -> insert BEFORE routeProgress
# ============================================================
print("\n--- Move 1: activeRoutePoints group -> before routeProgress ---")

content = content.replace(src_activeRoutePoints, "", 1)
content = content.replace(src_plannedRoute, "", 1)
content = content.replace(src_activeRouteLegs, "", 1)
content = content.replace(src_activeLegDefinition, "", 1)

insert_before_routeProgress = (
    "  const routeProgress = useMemo(\n"
    "    () => computeMobileRouteProgress(activeRoutePoints, activeOwnship, { activeLegIndex }),"
)
assert content.count(insert_before_routeProgress) == 1
content = content.replace(
    insert_before_routeProgress,
    src_activeRoutePoints
    + src_plannedRoute
    + src_activeRouteLegs
    + src_activeLegDefinition
    + insert_before_routeProgress,
    1
)
print("  Done")

# ============================================================
# MOVE 2: activeLegBehavior group -> after routeProgress, before plannedRouteRejoinProgress
# ============================================================
print("\n--- Move 2: activeLegBehavior group -> after routeProgress ---")

content = content.replace(src_activeLegBehavior_group, "", 1)

insert_after_routeProgress = "  );\n  const plannedRouteRejoinProgress = useMemo("
assert content.count(insert_after_routeProgress) == 1
content = content.replace(
    insert_after_routeProgress,
    "  );\n" + src_activeLegBehavior_group + "  const plannedRouteRejoinProgress = useMemo(",
    1
)
print("  Done")

# ============================================================
# MOVE 3: destinationElevation + departureRunway + destinationRunway
# -> insert BEFORE tacticalMapRegion
# ============================================================
print("\n--- Move 3: destinationElevation + runways -> before tacticalMapRegion ---")

content = content.replace(src_destinationElevation, "", 1)
content = content.replace(src_departureRunway, "", 1)
content = content.replace(src_destinationRunway, "", 1)

insert_before_tactical = "  const tacticalMapRegion = useMemo(\n    () =>\n      buildTacticalMapRegion({"
assert content.count(insert_before_tactical) == 1
content = content.replace(
    insert_before_tactical,
    src_destinationElevation
    + src_departureRunway
    + src_destinationRunway
    + insert_before_tactical,
    1
)
print("  Done")

# ============================================================
# MOVE 4: runway cue/overlay/activeRunwayOverlay -> before tacticalMapRegion
# ============================================================
print("\n--- Move 4: runway cue/overlay -> before tacticalMapRegion ---")

content = content.replace(src_destinationRunwayCue, "", 1)
content = content.replace(src_destinationRunwayOverlay, "", 1)
content = content.replace(src_departureRunwayOverlay, "", 1)
content = content.replace(src_activeRunwayOverlay, "", 1)
content = content.replace(src_activeRunwayOverlayLabel, "", 1)

assert content.count(insert_before_tactical) == 1
content = content.replace(
    insert_before_tactical,
    src_destinationRunwayCue
    + src_destinationRunwayOverlay
    + src_departureRunwayOverlay
    + src_activeRunwayOverlay
    + src_activeRunwayOverlayLabel
    + insert_before_tactical,
    1
)
print("  Done")

# ============================================================
# MOVE 5: flightDeckVerticalPathSummary -> before mapVerticalGuidancePresentation
# ============================================================
print("\n--- Move 5: flightDeckVerticalPathSummary -> before mapVerticalGuidancePresentation ---")

fdvps_start = "  const flightDeckVerticalPathSummary = useMemo(() => {"
fdvps_end = "    simulationCruiseKts,\n  ]);\n"

idx_start = content.find(fdvps_start)
assert idx_start != -1
# Find end - the specific dep array ends with simulationCruiseKts
idx_end_search = content.find(fdvps_end, idx_start)
assert idx_end_search != -1
idx_end = idx_end_search + len(fdvps_end)
src_fdvps = content[idx_start:idx_end]
print(f"  Block length: {len(src_fdvps)}")
assert content.count(src_fdvps) == 1

content = content.replace(src_fdvps, "", 1)

insert_before_mapVGP = "  const mapVerticalGuidancePresentation = useMemo(() => {"
assert content.count(insert_before_mapVGP) == 1
content = content.replace(
    insert_before_mapVGP,
    src_fdvps + insert_before_mapVGP,
    1
)
print("  Done")

# ============================================================
# MOVE 6: plannerNavDataSnapshot block -> before mapVerticalGuidancePresentation
# ============================================================
print("\n--- Move 6: plannerNavDataSnapshot block -> before mapVerticalGuidancePresentation ---")

pnds_start = "  const plannerNavDataSnapshot = useMemo(() => {"
pnds_end = "  }, [departure, departureRunway, destination, destinationRunway, plannedRouteAnalysis, plannedRouteAnchorTokens, plannedAltitudeValue, providerRouteAnchorTokens, providerRouteSearch?.available, providerRouteSearch?.environment, providerRouteSearch?.provider, providerRouteSearch?.route, providerRouteSearch?.warnings, routeSummary?.legs]);\n"

idx_start = content.find(pnds_start)
assert idx_start != -1
idx_end = content.find(pnds_end, idx_start) + len(pnds_end)
src_pnds = content[idx_start:idx_end]
print(f"  plannerNavDataSnapshot length: {len(src_pnds)}")
assert content.count(src_pnds) == 1

src_activeNavDataLegsByIndex = (
    "  const activeNavDataLegsByIndex = useMemo(\n"
    "    () =>\n"
    "      routeExecutionOverride?.mode === 'direct-to-diversion'\n"
    "        ? {}\n"
    "        : plannerNavDataSnapshot.navDataLegsByIndex,\n"
    "    [plannerNavDataSnapshot.navDataLegsByIndex, routeExecutionOverride?.mode]\n"
    "  );\n"
)
src_activeExecutionPlan = (
    "  const activeExecutionPlan = useMemo(\n"
    "    () => buildMobileRouteExecutionPlan(activeRouteLegs, { navDataLegsByIndex: activeNavDataLegsByIndex }),\n"
    "    [activeNavDataLegsByIndex, activeRouteLegs]\n"
    "  );\n"
)
src_activeProcedureChains = (
    "  const activeProcedureChains = useMemo(\n"
    "    () => buildMobileRouteProcedureChains(activeExecutionPlan),\n"
    "    [activeExecutionPlan]\n"
    "  );\n"
)
src_plannerExecutionPlan = (
    "  const plannerExecutionPlan = useMemo(\n"
    "    () => buildMobileRouteExecutionPlan(routeSummary?.legs || [], { navDataLegsByIndex: plannerNavDataSnapshot.navDataLegsByIndex }),\n"
    "    [plannerNavDataSnapshot.navDataLegsByIndex, routeSummary?.legs]\n"
    "  );\n"
)
src_plannerProcedureChains = (
    "  const plannerProcedureChains = useMemo(\n"
    "    () => buildMobileRouteProcedureChains(plannerExecutionPlan),\n"
    "    [plannerExecutionPlan]\n"
    "  );\n"
)

for s, name in [
    (src_activeNavDataLegsByIndex, "activeNavDataLegsByIndex"),
    (src_activeExecutionPlan, "activeExecutionPlan"),
    (src_activeProcedureChains, "activeProcedureChains"),
    (src_plannerExecutionPlan, "plannerExecutionPlan"),
    (src_plannerProcedureChains, "plannerProcedureChains"),
]:
    count = content.count(s)
    assert count == 1, f"Expected 1 of '{name}', found {count}"
    print(f"  OK: {name}")

content = content.replace(src_pnds, "", 1)
content = content.replace(src_activeNavDataLegsByIndex, "", 1)
content = content.replace(src_activeExecutionPlan, "", 1)
content = content.replace(src_activeProcedureChains, "", 1)
content = content.replace(src_plannerExecutionPlan, "", 1)
content = content.replace(src_plannerProcedureChains, "", 1)

assert content.count(insert_before_mapVGP) == 1
content = content.replace(
    insert_before_mapVGP,
    src_pnds
    + src_activeNavDataLegsByIndex
    + src_activeExecutionPlan
    + src_activeProcedureChains
    + src_plannerExecutionPlan
    + src_plannerProcedureChains
    + insert_before_mapVGP,
    1
)
print("  Done")

# ============================================================
# MOVE 7: routeExecutionSummary -> before mapVerticalGuidancePresentation
# ============================================================
print("\n--- Move 7: routeExecutionSummary -> before mapVerticalGuidancePresentation ---")

res_start = "  const routeExecutionSummary = useMemo(() => {"
res_end = "  }, [activeExecutionPlan, activeLegBehavior.annunciation, activeLegBehavior.guidanceMode, activeLegBehavior.profile, activeProcedureChains, activeRouteLegs, activeRoutePoints, plannerNavDataSnapshot.airwaySegments.length, plannerNavDataSnapshot.briefingLegCount, plannerNavDataSnapshot.coveragePct, plannerNavDataSnapshot.coveredLegCount, plannerNavDataSnapshot.navDataLegCount, plannerNavDataSnapshot.providerRouteAvailable, plannerNavDataSnapshot.providerWarnings, plannerNavDataSnapshot.source, plannerNavDataSnapshot.structuredLegCount, plannerNavDataSnapshot.totalLegCount, plannerNavDataSnapshot.warnings, routeExecutionOverride?.mode, routeProgress, sequencingSuspended, visionRouteGuidance?.headingDelta, visionRouteGuidance?.lateralCaptured]);\n"

idx_start = content.find(res_start)
assert idx_start != -1
idx_end = content.find(res_end, idx_start) + len(res_end)
src_res = content[idx_start:idx_end]
print(f"  routeExecutionSummary length: {len(src_res)}")
assert content.count(src_res) == 1

content = content.replace(src_res, "", 1)

assert content.count(insert_before_mapVGP) == 1
content = content.replace(
    insert_before_mapVGP,
    src_res + insert_before_mapVGP,
    1
)
print("  Done")

# ============================================================
# MOVE 8: flightDeckVerticalConstraintSummary -> before mapVerticalGuidancePresentation
# ============================================================
print("\n--- Move 8: flightDeckVerticalConstraintSummary -> before mapVerticalGuidancePresentation ---")

fdvcs_start = "  const flightDeckVerticalConstraintSummary = useMemo(() => {"
# Unique ending - the dep array for flightDeckVerticalConstraintSummary
fdvcs_end = "    routeProgress?.remainingLegNm,\n    routeProgress?.remainingRouteNm,\n    simulationAltitudeFt,\n    simulationCruiseKts,\n  ]);\n"

idx_start = content.find(fdvcs_start)
assert idx_start != -1
idx_end = content.find(fdvcs_end, idx_start) + len(fdvcs_end)
src_fdvcs = content[idx_start:idx_end]
print(f"  flightDeckVerticalConstraintSummary length: {len(src_fdvcs)}")
assert content.count(src_fdvcs) == 1

content = content.replace(src_fdvcs, "", 1)

assert content.count(insert_before_mapVGP) == 1
content = content.replace(
    insert_before_mapVGP,
    src_fdvcs + insert_before_mapVGP,
    1
)
print("  Done")

# ============================================================
# MOVE 9: flightDeckVerticalAlertSummary -> before activeFlightAlert useMemo
# (which is the first useMemo that uses flightDeckVerticalAlertSummary)
# ============================================================
print("\n--- Move 9: flightDeckVerticalAlertSummary -> before activeFlightAlert ---")

fdvas_start = "  const flightDeckVerticalAlertSummary = useMemo(() => {"
fdvas_end = "    simulationAltitudeFt,\n  ]);\n"

idx_start = content.find(fdvas_start)
assert idx_start != -1
# Find the correct end - the dep array for flightDeckVerticalAlertSummary ends with simulationAltitudeFt
# But we need to be careful - there might be other blocks ending this way
# Let's find all occurrences after idx_start
idx_end_candidate = content.find(fdvas_end, idx_start)
assert idx_end_candidate != -1
idx_end = idx_end_candidate + len(fdvas_end)
src_fdvas = content[idx_start:idx_end]
print(f"  flightDeckVerticalAlertSummary length: {len(src_fdvas)}")
print(f"  ends with: {repr(src_fdvas[-100:])}")
# Verify it starts and ends correctly
assert src_fdvas.startswith(fdvas_start)
assert src_fdvas.endswith(fdvas_end)
count = content.count(src_fdvas)
assert count == 1, f"Expected 1, found {count}"

content = content.replace(src_fdvas, "", 1)

# Insert before activeFlightAlert
insert_before_activeAlert = "  const activeFlightAlert = useMemo(() => {"
assert content.count(insert_before_activeAlert) == 1
content = content.replace(
    insert_before_activeAlert,
    src_fdvas + insert_before_activeAlert,
    1
)
print("  Done")

# ============================================================
# Verify and write
# ============================================================
new_lines = content.count('\n')
print(f"\nFinal file: {len(content)} chars, {new_lines} lines")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("File written successfully!")
