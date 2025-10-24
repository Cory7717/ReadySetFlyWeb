# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation-related services. The platform aims to streamline aircraft rentals, facilitate a multi-category marketplace (aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, charter services), and provide integrated messaging for active rentals. The business vision is to become the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in the private and commercial aviation sectors.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform is built with a **React frontend** utilizing Wouter for routing, TanStack Query for data fetching, and shadcn/ui for components, ensuring a modern and responsive user interface. The **backend** is an Express.js application, persisting data in **PostgreSQL** via Drizzle ORM. **Replit Auth** (OpenID Connect) with passport.js handles authentication, providing secure access and session management. A **WebSocket server** facilitates real-time messaging for active rentals.

Key architectural decisions include a robust **verification system** for both renters and aircraft owners, involving multi-step forms, document uploads, and an admin review interface. This system integrates a **badge system** to visually indicate verification statuses. The platform employs a **platform-captured payments with transfers** model via **Stripe** for all financial transactions, including rental payments, owner payouts, and marketplace listing fees. This involves detailed fee calculations (sales tax, platform commission, processing fees) and comprehensive webhook handling for asynchronous event processing. An **admin dashboard** provides role-based access for user and listing management, and analytics tracking.

## Recent Changes (October 24, 2025)

### Enhanced Profile Editing System
- **Database Schema**: Added `pilotLicenseUrl` and `insuranceUrl` fields to users table for document storage
- **Profile Edit Dialog**: Completely redesigned with react-hook-form for proper form handling
- **New Fields**:
  - First Name and Last Name (editable)
  - Phone Number
  - Total Flight Hours
  - Certifications (multi-select checkboxes for all certification types: PPL, IR, CPL, Multi-Engine, ATP, CFI, CFII, MEI)
  - Pilot License Upload (image or PDF)
  - Insurance Certificate Upload (image or PDF)
- **Document Management**: 
  - Shows current documents if already uploaded (with links to view)
  - Integrates with existing `/api/upload-images` endpoint
  - Supports multiple file types (images and PDFs)
- **UI/UX Features**:
  - Loading states for uploads and form submissions
  - Form validation with Zod
  - Displays uploaded documents as badges in profile header
  - Responsive multi-column layout for certifications
  - Shows certification count and document status in profile overview

### Marketplace Listing Expiration System
- **Expiration Logic**: All marketplace listings now have automatic expiration dates
  - Paid listings: 30 days from creation
  - Promo code listings (LAUNCH2025): 7 days from creation
  - Super Admin test listings: No expiration
- **Grace Period**: 3-day grace period after expiration before auto-deactivation
  - Listings remain active for 3 days after `expiresAt` date
  - After grace period ends, listings are automatically marked as `isActive = false`
- **API Routes**:
  - POST `/api/marketplace/check-expirations` - Admin endpoint to trigger expiration check and auto-deactivate expired listings
  - POST `/api/marketplace/:id/reactivate` - User endpoint to reactivate expired listing with payment verification
- **Storage Method**: `deactivateExpiredListings()` finds all active listings where `expiresAt + 3 days < now` and deactivates them
- **Reactivation**: Users can reactivate expired listings with one click, extending for another 30 days with payment

### Rating and Review System Implementation
- **Database Schema**: Added `reviews` table with rating fields (overall, communication, cleanliness, accuracy), reviewer/reviewee relationship, and rental linkage
- **User Rating Fields**: Added `averageRating` and `totalReviews` to users table for quick rating lookup
- **Storage Methods**: Implemented review CRUD operations with automatic average rating calculation on review creation
- **API Routes**: 
  - GET `/api/reviews/user/:userId` - Fetch all reviews for a user
  - GET `/api/reviews/rental/:rentalId` - Get reviews for a specific rental
  - GET `/api/rentals/:rentalId/can-review` - Check if current user can review
  - POST `/api/reviews` - Submit new review (requires completed rental, prevents duplicate reviews)
- **UI Components**:
  - `ReviewDialog`: Full-featured review submission with 5-star rating system, optional detailed ratings, and comment field
  - `StarRating`: Reusable star display component with half-star support and review counts
- **Review Rules**: Users can only review completed rentals once, reviewing the opposite party (renter reviews owner, owner reviews renter)

## Recent Changes (October 23, 2025)

### Production Readiness Enhancements
- **Database Schema Updates**: Enhanced both aircraftListings and marketplaceListings tables with structured location fields
  - Added city, state, zipCode fields for precise location filtering
  - Added latitude, longitude fields for future distance-based search (currently unused)
  - Added engineType enum field ("Single-Engine", "Multi-Engine", "Turboprop", "Jet") to aircraftListings
  - Added engineCount, seatingCapacity fields to aircraftListings for detailed filtering
  - Pushed all schema changes to production database successfully

- **Database Performance Indexes**: Created high-performance indexes for common filter queries
  - idx_aircraft_city, idx_aircraft_engine_type for aircraftListings
  - idx_marketplace_city, idx_marketplace_category, idx_marketplace_active for marketplaceListings
  - Composite indexes: idx_aircraft_city_engine_type, idx_marketplace_category_city
  - Enables fast filtering on city, engine type, category combinations

- **File Upload System**: Implemented production-ready image uploads for marketplace listings
  - Using multer with local disk storage (uploads/marketplace/ directory)
  - Created dedicated /api/upload-images endpoint supporting up to 15 images
  - Static file serving via /uploads route for image access
  - Files organized by type: marketplace/ for listing images, documents/ for verification docs
  - Can be migrated to Replit App Storage or cloud storage (S3, Cloudinary) before final deployment

- **Marketplace Filter UI**: Built comprehensive filtering interface
  - City search filter with real-time filtering
  - Price range filters (min/max)
  - Engine type filter for aircraft categories (Single-Engine, Multi-Engine, Turboprop, Jet)
  - Collapsible filter panel with "Filters" toggle button
  - Clear all filters functionality
  - Responsive grid layout (1/2/4 columns based on screen size)
  - Client-side filtering currently active (backend filtering to be added)

- **Form Enhancements**: Updated marketplace listing creation form
  - Replaced single location field with structured city/state/zipCode fields (3-column responsive grid)
  - Added engineType dropdown to aircraft sale form section
  - All new fields properly validated with Zod schemas
  - Maintains existing aircraft detail fields: seats, useful load, avionics, annual due, interior/exterior condition, damage history

### Earlier October 23 Updates
- **Marketplace Listing Detail Modal**: Implemented full-screen modal that opens when users click on marketplace listings
  - Shows all listing details including category-specific information
  - Image carousel for listings with multiple photos
  - Contact buttons (email and phone) for direct seller communication
  - Responsive design that works on all devices
  - Supports all listing categories: aircraft sales, jobs, CFI services, flight schools, mechanics, charter services
- **Payment Security Enhancements**:
  - Implemented server-side pricing calculation for all marketplace listings to prevent client-side price manipulation
  - Added PaymentIntent verification before listing creation to ensure payment completed successfully
  - Fixed user authentication upsert logic to check both ID and email, preventing 404 errors
  - Fixed `monthlyFee` validation schema to be optional (calculated server-side)
  - Fixed `price` field type handling to remain as string throughout the submission process
- **Responsive Design**: All marketplace listing forms now use responsive grid layouts (`grid-cols-1 md:grid-cols-2/3`) for optimal mobile, tablet, and desktop display

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect authentication provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: AI-powered description generation for all listing types using GPT-4o. Integrated via Replit AI blueprint, billed to Replit credits instead of requiring user's OpenAI API key. Supports aircraft rentals, aircraft sales, aviation jobs, CFI listings, flight schools, mechanic services, and charter services.
- **Stripe**: Payment processing for rentals, owner payouts, and marketplace listing subscriptions. Server-side pricing validation prevents client manipulation. Requires `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLIC_KEY`, and `STRIPE_WEBHOOK_SECRET`.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads, currently using placeholder URLs.
- **FAA Registry API**: Planned integration for automatic N-number lookups and cross-verification.