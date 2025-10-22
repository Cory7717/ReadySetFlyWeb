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
- **Admin System**: Role-based access for @readysetfly.us emails and coryarmer@gmail.com
  - Admin dashboard with user search and listing management
  - Admin link in header for admin users

### Phase 1: Comprehensive Verification System ✅
**Database Schema** (all fields added and deployed):

*Renter Verification Fields (users table)*:
- Identity: legalFirstName, legalLastName, dateOfBirth, phoneVerified, emailVerified
- Documents: governmentIdFrontUrl, governmentIdBackUrl, selfieUrl
- Verification: identityVerified, identityVerifiedAt
- Payment: paymentMethodOnFile, paymentVerified, paymentVerifiedAt
- FAA Pilot (optional): faaCertificateNumber, pilotCertificateName, pilotCertificatePhotoUrl, faaVerified, faaVerifiedMonth, faaVerifiedAt

*Owner/Aircraft Verification Fields (aircraftListings table)*:
- Ownership: serialNumber, registrationDocUrl, llcAuthorizationUrl, ownershipVerified, ownerNameMatch, registryCheckedAt
- Annual Inspection: annualInspectionDocUrl, annualInspectionDate, annualDueDate, annualSignerName, annualSignerCertNumber, annualSignerIaNumber, annualApVerified
- 100-Hour: requires100Hour, hour100InspectionDocUrl, hour100InspectionTach, currentTach, hour100Remaining
- Maintenance Tracking: maintenanceTrackingProvider, maintenanceTrackingDocUrl, hasMaintenanceTracking
- Verification Status: maintenanceVerified, maintenanceVerifiedAt

*Verification Submissions Table*:
- Admin review queue for all verification types
- Stores submission data as JSONB for flexibility
- FAA registry cross-check fields and audit trail
- Document URLs and file hashes for security

**Badge System**:
- Created `VerificationBadges` component with tooltips
- Renter badges: Identity Verified, Payment Verified, FAA Verified (MM/YYYY)
- Owner badges: Ownership Verified, Annual Current/Overdue, 100-Hour tracking, Maintenance Tracking
- Integrated into profile page display
- Color-coded: green (verified), yellow (pending), red (overdue/issues)

### Verification Requirements (Legacy - kept for backward compatibility)
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
- ✅ Authentication & authorization with Replit Auth
- ✅ Admin system with role-based access
- ✅ **Phase 1: Verification schema + badge system**
- ✅ Frontend pages (home, marketplace, dashboard, profile, list-aircraft, aircraft-detail)
- ✅ WebSocket messaging infrastructure
- ✅ Stripe payment scaffolding
- ⏳ **Phase 2: Renter verification workflow** (pending)
- ⏳ **Phase 3: Owner/aircraft verification workflow** (pending)
- ⏳ Modal listing views (pending)
- ⏳ End-to-end testing (pending)

## Integration Points
- See `INTEGRATION_TODO.md` for Stripe payment flows and WebSocket client examples
- Database: `npm run db:push` to sync schema changes
- Auth: Login via `/api/login`, logout via `/api/logout`
- User API: `GET /api/auth/user` (requires authentication)
- Admin: Visit `/admin` when logged in as admin user

## Next Steps (Phase 2 & 3)

### Phase 2: Renter Verification Workflow
1. **Verification Start Page** (`/verify-identity`)
   - Step 1: Legal name + date of birth + phone verification
   - Step 2: Government ID upload (front/back) + selfie
   - Step 3: Payment method (Stripe integration)
   - Step 4 (Optional): FAA pilot certificate upload
   - Submit to admin review queue

2. **File Upload System**
   - Cloud storage integration for document uploads
   - SHA-256 hashing for audit trail
   - Image validation and compression

3. **Admin Review Interface**
   - Queue of pending verifications in admin dashboard
   - Document viewer with approve/reject actions
   - Rejection with notes and re-submission

### Phase 3: Owner/Aircraft Verification Workflow
1. **Aircraft Verification Form** (extends `/list-aircraft`)
   - Serial number + registration doc upload
   - LLC authorization (if applicable)
   - Annual inspection doc + signer details
   - 100-hour inspection tracking
   - Maintenance tracking provider (optional)

2. **FAA Registry Integration**
   - Automatic N-number lookup from FAA database
   - Owner name matching validation
   - Airworthiness certificate verification

3. **Maintenance Tracking**
   - Annual inspection due date calculation
   - 100-hour countdown from current tach
   - Automatic badge updates (current/overdue)
   - Admin override for corrections
