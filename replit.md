# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation-related services. The platform aims to streamline aircraft rentals, facilitate a multi-category marketplace (aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, charter services), and provide integrated messaging for active rentals. The business vision is to become the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in the private and commercial aviation sectors.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform features a **React frontend** with Wouter for routing, TanStack Query for data fetching, and shadcn/ui for components, ensuring a modern and responsive user interface across all devices. The **backend** is an Express.js application, persisting data in **PostgreSQL** via Drizzle ORM. **Replit Auth** (OpenID Connect) with passport.js handles secure authentication and session management. A **WebSocket server** facilitates real-time messaging for active rentals.

Core architectural decisions include a robust **verification system** for renters and aircraft owners, incorporating multi-step forms, document uploads (e.g., pilot licenses, insurance), and an admin review interface. A **badge system** visually indicates verification statuses. The **document expiration tracking system** monitors pilot licenses, medical certificates, insurance policies, and government IDs with automated notifications and account suspension capabilities. Admins can view all user verification submissions with expiration status indicators (expired, expiring soon, valid) in the user modal's "Uploaded Documents" section. All financial transactions utilize a **platform-captured payments with transfers** model via **PayPal Braintree**, handling rental payments, owner payouts, and marketplace listing fees with detailed fee calculations and webhook processing. An **admin dashboard** provides role-based access for comprehensive management and analytics, including **expense tracking** for monitoring server, database, and operational costs with profit margin calculations across all time periods (today, week, month, year), **marketplace listing metrics** showing total active/expired listings and per-category breakdowns (Aviation Jobs, Aircraft For Sale, CFIs, Flight Schools, Mechanics, Charter Services), and **detailed rental metrics** tracking new and active rentals for today and rolling 7-day periods. The system also includes an **expiration system for marketplace listings** with a grace period and reactivation functionality, and a **rating and review system** for completed rentals, calculating average user ratings. The **marketplace features category-specific filters** tailored to each listing type: Aviation Jobs offers keyword search, city, and radius filtering (up to 500 miles); Aircraft Sale provides city, price range, and engine type filters; other categories (CFI, Flight Schools, Mechanics, Charter) support city and price range filtering. Database schema updates and performance indexes are implemented for enhanced functionality and efficient querying of location, engine type, and category filters. Production-ready image uploads use multer with local disk storage.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect authentication provider (Google, GitHub, email/password).
  - **Known Limitation (Auto-login)**: After logout, clicking "Sign In" will automatically log users back in with their previous Replit account if their browser session is still active. Replit's OIDC provider does not support the `prompt=select_account` parameter to force account selection. Users must manually log out of Replit.com in their browser to switch accounts.
  - **Email Authentication Behavior**: Replit Auth uses magic links for email-based authentication (not traditional passwords). When logging in with email, users are redirected to an "email sent, check your inbox" page and must click the verification link sent to their email. For instant login, users should use Google or GitHub authentication methods instead.
- **Replit AI Integrations (OpenAI)**: AI-powered description generation for all listing types (aircraft rentals, sales, jobs, CFI, flight schools, mechanics, charter services) using GPT-4o, billed via Replit credits.
- **PayPal Braintree**: Payment processing for incoming payments (rentals and marketplace listing fees) using Braintree Drop-in UI and server-side transaction verification.
  - **Configuration**: Set to Production environment (`braintree.Environment.Production`) to match Live/Production credentials.
  - **Current Status (Nov 2025)**: Braintree account access temporarily restricted - awaiting support resolution. Payment logic verified and ready to operate once account access is restored.
- **PayPal Payouts API**: Handles outgoing payments (instant owner withdrawals) via automated payout processing.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads.
- **FAA Registry API**: Planned integration for automatic N-number lookups and cross-verification.

## Stale Listing Management System
Added December 2024: A comprehensive system to track and maintain listing quality through automated monitoring and email reminders.

**Key Features:**
- `lastRefreshedAt` timestamp field on both aircraft rental and marketplace listings tracks when owners last reviewed their listings
- **Stale listings detection**: Automatically identifies listings not refreshed in 60+ days
- **Orphaned listings detection**: Identifies listings where owner account is deleted or suspended
- **Admin dashboard tab**: Dedicated "Stale" tab with three management sections:
  - Monthly email reminder controls with "Send Reminders Now" button
  - Stale listings (aircraft and marketplace) with individual refresh capabilities
  - Orphaned listings (aircraft and marketplace) with delete actions
- **User refresh buttons**: Icon buttons on My Listings page allow users to refresh their own listings
- **Monthly automated emails**: Resend-powered email reminders notify users to review listings
- **Scheduled automation**: Script (`send-monthly-listing-reminders.ts`) designed for Replit Scheduled Deployments

**Implementation:**
- Storage methods: `getStaleAircraftListings()`, `getStaleMarketplaceListings()`, `getOrphanedAircraftListings()`, `getOrphanedMarketplaceListings()`, `refreshAircraftListing()`, `refreshMarketplaceListing()`, `getUsersWithActiveListings()`
- API endpoints: GET `/api/admin/stale-listings`, GET `/api/admin/orphaned-listings`, POST `/api/admin/send-listing-reminders`, PATCH `/api/aircraft/:id/refresh`, PATCH `/api/marketplace/:id/refresh`
- Email templates: HTML and plain text versions showing aircraft count and marketplace count

## PayPal Payouts Integration - Automated Owner Withdrawal System
Added October 2025: A fully automated dual-payment system where aircraft owners earn rental income and can instantly withdraw funds via PayPal (modeled after Airbnb's approach).

**Architecture:**
- **Incoming Payments**: Braintree handles all incoming payments (rentals, marketplace listing fees)
- **Outgoing Payments**: PayPal Payouts API handles instant automated owner withdrawals
- **Balance Tracking**: Thread-safe atomic balance operations prevent race conditions

**Revenue Flow:**
1. Renter completes rental payment via Braintree
2. Owner balance automatically credited with `ownerPayout` amount (baseCost - 7.5% platform fee)
3. Owner requests withdrawal to their PayPal account
4. **System instantly processes payout via PayPal Payouts API** (no manual approval required)
5. Funds arrive in owner's PayPal account (typically within minutes)
6. PayPal charges ~2% fee per payout (absorbed by platform)

**Key Features:**
- **Instant Automated Payouts**: Withdrawals are processed immediately when owners request funds (like Airbnb/Uber model)
- **Atomic Balance Operations**: All balance increments/decrements use single SQL UPDATE statements to prevent race conditions
- **Owner Withdrawal Page**: Interface for owners to set PayPal email, view balance, request instant withdrawals, and track withdrawal history
- **Admin Monitoring Dashboard**: Dashboard interface for tracking all withdrawals with search/filter capabilities (by owner name, date range, status, amount) for financial oversight and customer support
- **Automatic Balance Crediting**: When rental payment completes, owner balance is immediately credited atomically
- **Security**: Owners can only withdraw their own balance; atomic SQL operations prevent overdrafts
- **Status Tracking**: Withdrawals tracked as processing/completed/failed with timestamps, transaction IDs, and error details

**Implementation:**
- PayPal Payouts service: `server/paypal-payouts.ts` - Authentication and payout sending via PayPal Payouts API
- Database schemas: `users.balance` field, `withdrawalRequests` table in `shared/schema.ts`
- Storage methods: `addToUserBalance()`, `deductFromUserBalance()` (atomic SQL operations), `createWithdrawalRequest()`, `getWithdrawalRequestsByUser()`, `getAllWithdrawalRequests()`, `updateWithdrawalRequest()`
- API endpoints: GET `/api/user/balance`, POST `/api/withdrawals` (instant processing), GET `/api/withdrawals`, GET `/api/admin/withdrawals` (all withdrawals for monitoring)
- Frontend pages: `/owner-withdrawals` page with balance display, PayPal setup, instant withdrawal form, and history
- Admin interface: "Withdrawals" tab in admin dashboard with search/filter monitoring capabilities (no approval actions needed)
- Rental completion: `/api/rentals/:id/complete-payment` automatically credits owner balance after payment verification

**Security & Data Integrity:**
- Balance operations use atomic SQL: `balance = COALESCE(balance, 0) + amount` (no read-then-write)
- Deductions include balance check in WHERE clause: `WHERE balance >= amount` (prevents overdrafts)
- Concurrent operations safe: Multiple simultaneous credits/withdrawals won't corrupt balances
- Failed PayPal payouts: Marked as cancelled, balance automatically refunded to owner

## Sample Marketplace Listings
Added October 2025: A system to provide high-quality example listings for all marketplace categories to help users understand proper listing format and quality standards.

**Key Features:**
- **Example Listings**: 6 professionally-written sample listings (one per category) showcasing best practices
- **Visual Distinction**: Prominent "EXAMPLE LISTING - For Reference Only" banner on both grid cards and detail modals
- **Backend Protections**: Sample listings are read-only and excluded from user management
- **Categories Covered**: Aviation Jobs, Aircraft For Sale, CFIs, Flight Schools, Mechanics, Charter Services

**Implementation:**
- Database schema: `isExample` boolean field in `marketplaceListings` table
- Storage: Sample listings excluded from `getMarketplaceListingsByUser()` query
- API protections: PATCH and DELETE routes check `isExample` flag and return 403 error
- UI components: `MarketplaceCard` and `MarketplaceListingModal` display amber banner for example listings
- Sample data: Realistic listings with professional descriptions, contact info, and pricing guidance

## Mobile Responsiveness
Added October 2025: Comprehensive mobile UI/UX improvements ensuring the platform displays correctly on all device sizes without horizontal scrolling.

**Key Improvements:**
- **Header Component** (`client/src/components/header.tsx`):
  - Logo scales down on mobile (h-8 vs h-[2.6rem])
  - Brand text "Ready Set Fly" hidden on screens < 400px, smaller font on mobile
  - Navigation tabs compact on mobile (size="sm", text-xs, reduced padding)
  - "List Your Aircraft" button hidden on mobile (visible only on sm: breakpoint and up)
  - Notifications bell icon hidden on mobile
  - Reduced header height on mobile (h-14 vs h-16)
  - Reduced spacing throughout (gap-1 sm:gap-2, px-3 sm:px-4)

- **Home Page Hero Section** (`client/src/pages/home.tsx`):
  - Hero height reduced on mobile (500px vs 600px on desktop)
  - Hero title responsive (text-3xl on mobile, text-5xl md:text-6xl on desktop)
  - Search card padding reduced on mobile (p-4 vs p-6)
  - Grid layout responsive: 1 column on mobile, 2 columns on sm, 4 columns on md+
  - Form labels and inputs smaller on mobile (text-xs/text-sm)
  - Quick filter badges smaller (text-xs on mobile)

- **RequireAuth Page**: Already mobile-friendly with responsive Card component and full-width buttons

**Responsive Breakpoints:**
- `sm:` = 640px and up
- `md:` = 768px and up
- `lg:` = 1024px and up
- `min-[400px]:` = Custom breakpoint for brand text

**Testing:**
- Verified on iPhone 12 viewport (390x844)
- No horizontal scrolling required
- All interactive elements accessible and properly sized
- Content scales appropriately across all breakpoints

