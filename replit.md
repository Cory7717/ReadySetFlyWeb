# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation-related services. The platform aims to streamline aircraft rentals, facilitate a multi-category marketplace (aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, charter services), and provide integrated messaging for active rentals. The business vision is to become the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in the private and commercial aviation sectors.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform features a **React frontend** with Wouter for routing, TanStack Query for data fetching, and shadcn/ui for components, ensuring a modern and responsive user interface across all devices. The **backend** is an Express.js application, persisting data in **PostgreSQL** via Drizzle ORM. **Replit Auth** (OpenID Connect) with passport.js handles secure authentication and session management. A **WebSocket server** facilitates real-time messaging for active rentals.

Core architectural decisions include a robust **verification system** for renters and aircraft owners, incorporating multi-step forms, document uploads (e.g., pilot licenses, insurance), and an admin review interface. A **badge system** visually indicates verification statuses. The **document expiration tracking system** monitors pilot licenses, medical certificates, insurance policies, and government IDs with automated notifications and account suspension capabilities. Admins can view all user verification submissions with expiration status indicators (expired, expiring soon, valid) in the user modal's "Uploaded Documents" section. All financial transactions utilize a **platform-captured payments with transfers** model via **Stripe**, handling rental payments, owner payouts, and marketplace listing fees with detailed fee calculations and webhook processing. An **admin dashboard** provides role-based access for comprehensive management and analytics, including **expense tracking** for monitoring server, database, and operational costs with profit margin calculations across all time periods (today, week, month, year), **marketplace listing metrics** showing total active/expired listings and per-category breakdowns (Aviation Jobs, Aircraft For Sale, CFIs, Flight Schools, Mechanics, Charter Services), and **detailed rental metrics** tracking new and active rentals for today and rolling 7-day periods. The system also includes an **expiration system for marketplace listings** with a grace period and reactivation functionality, and a **rating and review system** for completed rentals, calculating average user ratings. The **marketplace features category-specific filters** tailored to each listing type: Aviation Jobs offers keyword search, city, and radius filtering (up to 500 miles); Aircraft Sale provides city, price range, and engine type filters; other categories (CFI, Flight Schools, Mechanics, Charter) support city and price range filtering. Database schema updates and performance indexes are implemented for enhanced functionality and efficient querying of location, engine type, and category filters. Production-ready image uploads use multer with local disk storage.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect authentication provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: AI-powered description generation for all listing types (aircraft rentals, sales, jobs, CFI, flight schools, mechanics, charter services) using GPT-4o, billed via Replit credits.
- **Stripe**: Payment processing for rentals, owner payouts, and marketplace listing subscriptions, including server-side pricing validation.
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

