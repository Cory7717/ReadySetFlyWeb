## RSF Mobile UI Overhaul Plan

This document defines the current mobile-app UI state, what is structurally weak today, and the phased plan to move RSF into a more differentiated, next-gen design system.

### Current state audit

#### Navigation

- The app currently uses a simple 5-tab shell in [AppNavigator.tsx](c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/navigation/AppNavigator.tsx):
  - `Home`
  - `Rentals`
  - `Marketplace`
  - `Messages`
  - `Profile`
- Many of the app's most important tools are buried under the `Profile` stack instead of having a stronger product hierarchy.
- Cockpit/live-flight capability exists, but it is not visually framed as a flagship workflow.

#### Theme/design system

- The current theme in [theme.ts](c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/styles/theme.ts) is functional but generic:
  - narrow color system
  - limited typography hierarchy
  - minimal elevation/motion/state language
- The visual language reads like an MVP utility app, not a premium aviation product.

#### Screen surface inventory

Current mobile screens fall into these buckets:

- Core product
  - `HomeScreen`
  - `FlightPlannerScreen`
  - `LogbookScreen`
  - `LogbookProScreen`
  - `MyAircraftScreen`
  - `NotificationsScreen`

- Rentals / marketplace
  - `RentalsScreen`
  - `AircraftDetailScreen`
  - `BookingScreen`
  - `MarketplaceScreen`
  - `MarketplaceDetailScreen`
  - `CreateMarketplaceListingScreen`
  - `MyListingsScreen`
  - `MyRentalsScreen`

- Pilot tools
  - `PilotToolsScreen`
  - `DensityAltitudeScreen`
  - `CrosswindCalculatorScreen`
  - `WeightBalanceScreen`
  - `OwnershipCostCalculatorScreen`
  - `IfrToolsScreen`
  - `AviationWeatherHubScreen`
  - `AirportBriefingScreen`
  - `ApproachPlatesScreen`
  - `TfrsScreen`

- Training / student
  - `RadioCommsTrainerScreen`
  - `StudentHubScreen`
  - `StudentWizardScreen`
  - `StudentRoadmapScreen`
  - `StudentProgressScreen`
  - `StudentWrittenScreen`
  - `StudentSyllabiScreen`
  - `StudentVorTrainerScreen`
  - `StudentChecklistsScreen`
  - `StudentWeatherScreen`

- Receiver / cockpit support
  - `ReceiverHelpScreen`
  - `FlightPlannerScreen` live map / ADS-B pieces

### What needs to change

#### Product hierarchy

The app should feel like three distinct experiences, not one long tools list:

- `Fly`
  - live flight map
  - route progress
  - traffic / weather / terrain / diversion
- `Plan`
  - flight planner
  - airport briefing
  - weather
  - approach plates
- `Operate`
  - rentals
  - marketplace
  - messages
  - aircraft
  - profile / billing / settings

#### Design direction

RSF should not look like a generic blue utility app.

Target visual language:

- crisp aviation-instrument styling without looking old
- brighter daylight palette optimized for cockpit/tablet readability
- stronger typography contrast
- modular cards with clear data priority
- motion used for hierarchy and state changes, not decoration
- map-heavy screens treated as primary surfaces, not just embedded widgets

### Proposed next-gen mobile design system

#### Foundation

- Expand semantic colors:
  - background layers
  - instrument surfaces
  - status colors
  - route/traffic/hazard colors
- Expand typography:
  - display
  - section title
  - metric/value
  - label/meta
- Add component primitives:
  - app shell
  - hero cards
  - segmented controls
  - metric tiles
  - status chips
  - action rails
  - cockpit alert banners

#### Layout principles

- Reduce nested forms and long unbroken scrolls
- Use denser dashboard blocks where pilots need quick scanning
- Keep tap targets large for tablet use
- Favor horizontal segmented controls over stacked text links
- Make "current status" obvious at top of screen

### Phase plan

#### Phase 1: Shell + design tokens

- upgrade [theme.ts](c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/styles/theme.ts) into a fuller design token system
- refresh tab bar styling and app chrome
- introduce reusable section headers, metric cards, status chips, and alert banners
- create a stronger empty/error/loading state language

#### Phase 2: Home + planner flagship refresh

- redesign `HomeScreen` into a real mission-control dashboard
- redesign `FlightPlannerScreen` into:
  - top summary rail
  - map-first layout
  - route/weather/live data segmented workflow
  - cockpit-grade diversion and traffic cards

#### Phase 3: Cockpit mode

- create a dedicated mobile `Live Flight` surface
- prioritize:
  - ownship
  - traffic
  - weather
  - terrain
  - diversion
- support one-handed / tablet quick-action patterns

#### Phase 4: Tools and logbook refinement

- refresh `PilotToolsScreen` into curated tool collections instead of a long list
- redesign logbook and membership surfaces for higher perceived value
- simplify data entry for common calculator flows

#### Phase 5: Rentals / marketplace / operations polish

- modernize listing cards and detail pages
- tighten booking/payment flow
- improve messages and owner/operator surfaces

### Immediate implementation order

1. Expand the theme/token system
2. Refresh app shell and tab bar
3. Redesign `HomeScreen`
4. Redesign `FlightPlannerScreen`
5. Break out a dedicated `Live Flight` screen

### User-facing positioning

The message to users should be:

- Plan on the web.
- Fly in the app.

And the app should visually reinforce that split:

- web = planning/admin depth
- mobile = operational clarity and cockpit confidence
