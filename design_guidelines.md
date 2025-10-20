# Ready Set Fly - Design Guidelines

## Design Approach: Reference-Based (Aviation Marketplace + Rental Platform)

Drawing inspiration from **Controller** (aviation marketplace), **Turo** (rental model), and **Airbnb** (search/filter UX), while establishing professional credibility essential for aviation transactions. Prioritizes trust through precision, certification clarity, and comprehensive aircraft showcasing.

**Core Principles:**
- Professional-first aesthetic appealing to pilots and aircraft owners
- Dual navigation architecture (Rentals | Marketplace) with clear context switching
- Certification-aware search and matching
- Transaction transparency and security signals throughout
- Image-rich aircraft presentations with technical specification accessibility

## Color Palette

**Light Mode:**
- Primary: 215 85% 35% (Aviation blue - authority and sky)
- Secondary: 215 20% 25% (Professional charcoal)
- Background: 0 0% 97%
- Surface: 0 0% 100%
- Text Primary: 215 15% 18%
- Text Secondary: 215 10% 42%
- Success: 145 60% 40% (Certification badges, available)
- Warning: 35 90% 55% (Aviation orange for CTAs, urgent items)
- Border: 215 15% 88%

**Dark Mode:**
- Primary: 215 75% 50%
- Background: 215 18% 12%
- Surface: 215 15% 16%
- Text Primary: 215 8% 94%
- Text Secondary: 215 8% 68%
- Success: 145 55% 45%
- Warning: 35 85% 60%
- Border: 215 12% 24%

## Typography

**Fonts:** Inter (UI/body), Outfit (headers/aircraft names)

**Scale:**
- Hero Display: text-6xl font-bold (Outfit)
- Section Headers: text-4xl font-bold (Outfit)
- Aircraft Names: text-3xl font-semibold (Outfit)
- Listings Titles: text-xl font-semibold (Outfit)
- Body: text-base (Inter)
- Technical Specs: text-sm font-medium (Inter)
- Badges/Labels: text-xs font-semibold uppercase tracking-wide (Inter)

## Layout System

**Spacing Units:** 2, 4, 6, 8, 12, 16, 20, 24, 32
- Icons/badges: 2, 4
- Card padding: 6, 8
- Component gaps: 8, 12
- Section spacing: 16, 20, 24
- Major vertical rhythm: 32

**Containers:**
- Main content: max-w-7xl
- Search/filters: max-w-5xl
- Detail views: max-w-6xl
- Grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

## Component Library

### Navigation Architecture
**Header:** Dual-tab system (Rentals | Marketplace) with active state indicators, user profile with certification badges visible, "List Your Aircraft" CTA (warning color), notifications bell

**Marketplace Sub-Nav:** Pills for Aircraft Sales | Jobs | CFIs | Flight Schools | Mechanics | Charter Services - horizontal scroll on mobile

### Search & Discovery

**Hero Section (Rentals):**
- Full-width image (h-[600px]): Professional pilot pre-flighting modern aircraft on tarmac at golden hour
- Gradient overlay (from-black/60 via-black/30 to-transparent)
- Centered search card (shadow-2xl, rounded-2xl, backdrop-blur) with:
  - Aircraft Type dropdown | Certification Required | Location | Dates
  - Primary CTA: "Find Aircraft" (warning accent, rounded-full)
  - Quick filters below: IFR Equipped, Multi-Engine, Glass Cockpit (pill badges)

**Filter Sidebar (Rentals):**
- Sticky w-80 on desktop, drawer on mobile
- Certification matching (auto-filters based on user's certs with explanatory text)
- Price range slider
- Aircraft category checkboxes with count badges
- Avionics suite multi-select
- Insurance included toggle
- Hour requirements slider
- "Advanced Filters" collapsible: Year range, total time available, wet/dry rate

**Marketplace Filters:**
- Category-specific (e.g., Jobs: Full-time/Contract/CFI, location radius)
- Price ranges, experience requirements, certifications needed

### Listing Cards

**Aircraft Rental Cards:**
- 3:2 aspect ratio primary image, rounded-xl
- Certification badge overlay (top-left): PPL, CPL, ATP with color coding
- Favorite heart (top-right, backdrop-blur background)
- Owner verification checkmark badge
- Card content (p-6):
  - Aircraft make/model (text-xl font-semibold)
  - Hourly rate prominent (text-2xl font-bold) + insurance included indicator
  - Key specs row: Year | Total Time | Avionics (icons from Heroicons)
  - Location with distance from user
  - Availability calendar preview (mini 7-day strip)
  - Quick stats: Response time, acceptance rate

**Marketplace Cards (Sales/Services):**
- Similar layout adapted: Sales show asking price, Jobs show salary range, CFIs show hourly rate
- Category badge (top-left colored by type)
- Listing age indicator
- Contact options preview

### Detail Views

**Aircraft Detail (Rentals):**
- Image gallery: Primary large + 8 thumbnails in grid, lightbox expansion
- Two-column: Left (specifications, description, owner info) | Right (booking card sticky)
- Specifications table: Make/Model, Year, Registration, Total Time, Engine, Avionics suite, Insurance details
- Required certifications prominent with user match indicator
- Reviews section with pilot verification badges
- Similar aircraft recommendations

**Booking Card:**
- Price breakdown: Base rate × hours, insurance, tax, platform fee (15%)
- Date picker with hourly blocks
- Estimated flight hours input
- Total calculation
- "Request to Book" CTA
- Messaging owner button (outline variant with blur background)
- Cancellation policy summary

**Marketplace Detail Views:**
- Adapted layout per category
- Contact forms, application forms as needed
- Seller/poster profiles with transaction history

### Profiles & Trust Signals

**Pilot Profiles:**
- Certification badges grid (PPL, IR, CPL, Multi-Engine, ATP) with dates
- Total flight hours, aircraft types flown
- Verification indicators: ID, pilot license, background check
- Review score and rental history
- Aircraft owner indicator if applicable

**Owner Profiles:**
- Fleet overview (if multiple aircraft)
- Response metrics
- Insurance coverage details
- Maintenance records indicator
- Years on platform badge

### Transactional Features

**Dashboard:**
- Tab navigation: Active Rentals | Upcoming | Past | Listings | Financials
- Active rentals: Timeline view with pre-flight checklist integration, messaging thread preview
- Financial tracking: Revenue graph, pending deposits, transaction history table
- Listing management: Status toggles, calendar management, pricing updates

**Messaging:**
- In-app chat during active rentals
- Quick actions: Share flight plan, report issues, extend rental
- Timestamp and read receipts
- File attachments for documents

## Images

**Hero:** Full-width professional aviation photography - modern aircraft on tarmac with pilot conducting preflight, warm lighting, aspirational yet authentic

**Listings:** High-quality aircraft photos from multiple angles (exterior, cockpit, panel, interior), consistent lighting and backgrounds when possible

**Category Images:** Supporting images for marketplace sections - flight schools show classroom/simulators, mechanics show hangars, charter shows luxury cabin interiors

**Trust Elements:** Verification badges, certification logos (FAA, insurance providers), payment security icons in footer

**Image Treatment:** Lazy loading, rounded-xl corners, subtle hover scale (1.02) on cards, blur-up loading placeholders