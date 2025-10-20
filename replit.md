# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform connecting verified pilots with aircraft owners. The platform features aircraft rentals, a multi-category marketplace (sales, jobs, CFI listings, flight schools, mechanics, charter services), and integrated messaging for active rentals.

## Recent Changes (October 2025)

### Authentication Integration
- **Replit Auth**: Integrated OpenID Connect authentication supporting Google, GitHub, email/password
- **Database**: Migrated from MemStorage to PostgreSQL with Drizzle ORM
- **User Model**: Merged auth fields (id, email, firstName, lastName, profileImageUrl) with aviation-specific fields (certifications, flight hours, verification status)
- **Protected Routes**: All listing creation endpoints require authentication + verification
- **Session Management**: PostgreSQL-backed sessions with 7-day TTL
- **Landing Page**: Professional landing page for logged-out users with feature highlights and CTAs

### Verification Requirements
- **Middleware**: `isVerified` middleware checks user.isVerified before allowing listing creation
- **Protected Endpoints**:
  - POST /api/aircraft (requires auth + verification)
  - POST /api/marketplace (requires auth + verification)
- **Frontend Safeguards**: 
  - List-aircraft form blocks submissions for unverified users
  - Alert shown with link to profile for verification
  - Submit button disabled when user not verified
  - 403 errors redirect to profile page with guidance

### Project Architecture
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Frontend**: React with Wouter routing, TanStack Query, shadcn/ui components
- **Auth**: Replit Auth (OpenID Connect) with passport.js
- **Database**: PostgreSQL via Neon with Drizzle ORM
- **Real-time**: WebSocket server for rental messaging (active rentals only)
- **Payments**: Stripe integration scaffolded (requires API keys)

## Revenue Model
- **Rentals**: 15% commission split (7.5% renter + 7.5% owner)
- **Marketplace Listings**: Monthly fees from $25-$250 based on category and tier

## Key Features
1. **Aircraft Rentals**: Browse, filter by certification, book aircraft with transparent pricing
2. **Marketplace**: 6 categories (aircraft sales, jobs, CFI, flight schools, mechanics, charter)
3. **Verification**: License verification and background checks for all users
4. **Messaging**: Real-time WebSocket messaging during active rentals only
5. **Financial Tracking**: Owner dashboards with earnings, deposits, transaction history
6. **Multi-aircraft Management**: Owners can list/unlist multiple aircraft

## User Data Model
### Core Fields (from Replit Auth)
- id, email, firstName, lastName, profileImageUrl
- createdAt, updatedAt

### Aviation-Specific Fields
- certifications (array): PPL, IR, CPL, Multi-Engine, ATP, CFI, CFII, MEI
- totalFlightHours, aircraftTypesFlown
- isVerified, licenseVerified, backgroundCheckCompleted
- bankAccountConnected, stripeAccountId

## Development Status
- ✅ Full backend API with PostgreSQL
- ✅ Authentication & authorization
- ✅ Verification requirements enforced
- ✅ Frontend pages (home, marketplace, dashboard, profile, list-aircraft, aircraft-detail)
- ✅ WebSocket messaging infrastructure
- ✅ Stripe payment scaffolding
- ⏳ Modal listing views (in progress)
- ⏳ End-to-end testing (pending)

## Integration Points
- See `INTEGRATION_TODO.md` for Stripe payment flows and WebSocket client examples
- Database: `npm run db:push` to sync schema changes
- Auth: Login via `/api/login`, logout via `/api/logout`
- User API: `GET /api/auth/user` (requires authentication)

## Next Steps
1. Create modal listing views (half/full screen expandable)
2. Complete end-to-end testing
3. Add production Stripe keys
4. Deploy to production
