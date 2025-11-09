# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is an aviation marketplace and rental platform connecting verified pilots with aircraft owners for rentals and other aviation services. Its purpose is to streamline aircraft rentals and facilitate a multi-category marketplace (aircraft sales, jobs, CFI listings, flight schools, mechanics, charter). The platform aims to be the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in private and commercial aviation.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform is a **monorepo** with shared backend, web, and mobile applications.

- **Web Frontend**: React, Wouter, TanStack Query, shadcn/ui.
- **Mobile Frontend**: React Native Expo (iOS/Android), mirroring web functionality except admin dashboard.
- **Backend**: Express.js, serving both clients.
- **Shared Types**: Common TypeScript schemas.
- **Database**: PostgreSQL via Drizzle ORM.
- **Authentication**: Unified authentication supporting both OAuth (Google/GitHub via Replit Auth) and email/password for web and mobile. Web uses session cookies (7-day expiration with rolling sessions - resets on activity to keep users logged in), mobile uses JWT tokens (15-min access, 7-day refresh). OAuth for mobile uses browser-based flow → exchange token (5-min expiry) → deep link callback → JWT tokens. All users can log in with ANY email provider (not limited to Gmail). Passwords hashed with bcrypt (cost factor 12), refresh tokens and exchange tokens hashed with SHA-256 before storage. Email lookups are case-insensitive to prevent duplicate accounts.
  - **Email Verification**: OAuth users (Google/GitHub) automatically have emailVerified set to true since OAuth providers verify emails. Email/password users must verify via email link (24-hour expiry). Existing users switching from email/password to OAuth have emailVerified automatically updated to true on next OAuth login.
  - **Session Persistence**: Web sessions stored in PostgreSQL (persist across server restarts), 7-day expiration with rolling refresh (extends on each request), secure HTTP-only cookies. Mobile uses refresh tokens stored in secure storage (7-day expiration). Users remain logged in until explicit logout.
- **Real-time Messaging**: Custom WebSocket server.
- **UI/UX**: Production-ready components, responsive design across all devices (web and mobile), with specific optimizations for mobile headers, hero sections, and navigation.
- **Verification System**: Multi-step forms, document uploads (pilot licenses, insurance), admin review interface, and a badge system for visual verification status. **CRITICAL: Verification is REQUIRED for aircraft rental listings (owners must be verified to list) AND for booking rentals (renters must be verified to rent). Marketplace listings (aircraft sale, jobs, CFI, etc.) do NOT require verification.**
- **Document Expiration Tracking**: Monitors critical document expiry with automated notifications and account suspension capabilities; admin interface shows status.
- **Financial Transactions**: Platform-captured payments via **PayPal Expanded Checkout** (card fields component, Pay Later disabled, credit cards only) for rentals and marketplace fees. **PayPal Payouts API** for instant owner withdrawals. Migration from Braintree to PayPal completed November 2024.
- **Admin Dashboard**: Role-based access, expense tracking, marketplace listing metrics, rental metrics, and monitoring of all financial transactions and withdrawals.
  - **Admin Notification System**: Automated alerts for marketplace listing thresholds. System monitors active listing counts per category and creates notifications when reaching 25 or 30 listings. Admin "Alerts" tab displays all notifications with unread count badge, mark-read functionality, delete controls, and visual distinction between read/unread. Notifications are non-blocking (failures don't prevent listing creation) and include category, threshold, and listing count metadata.
- **Marketplace Features**: Category-specific filters (e.g., keyword search, city, price range, engine type).
- **Aircraft Rental Filters (Updated November 2024)**: 
  - **Web**: Location-based filtering with keyword search (aircraft model/make), city/state inputs, and radius selector (25-500 miles). Removed price range and hour requirements filters. State managed in parent component (home.tsx) with real-time filtering of aircraft listings.
  - **Mobile**: Modal-based filter UI with search bar, city/state inputs, and radius selector matching web functionality. Filters apply to aircraft list in real-time based on keyword, city, and state criteria.
  - **Limitation**: Radius filtering is UI-only (distance calculation requires geocoding/backend support for future implementation).
- **Listing Management**: Automated system for detecting and managing stale and orphaned listings, with user refresh buttons and monthly email reminders.
- **Sample Listings**: Professionally written example listings for all marketplace categories, visually distinct and read-only.
- **App Store Compliance**: Complete implementation for Apple App Store and Google Play Store submission requirements:
  - **Privacy Policy**: Comprehensive policy at `/privacy-policy` covering all data collection, usage, sharing, retention, and user rights (GDPR/CCPA compliant). Accessible via web and mobile app (external link in ProfileScreen).
  - **Terms of Service**: Full legal agreement at `/terms-of-service` with platform fees, dispute resolution (Texas governing law), liability disclaimers. Accessible via web and mobile app (external link in ProfileScreen).
  - **Account Deletion**: Multi-channel deletion system with cross-platform compatibility:
    - Web: Settings page (`/settings`) with delete account button, standalone deletion page (`/delete-account`) for users who uninstalled app
    - Mobile: ProfileScreen Settings section with "Delete Account" option, cross-platform ConfirmDeletionModal requiring "DELETE" text confirmation
    - Backend: API endpoint (`DELETE /api/auth/user`) permanently removes all user data across 11+ database tables (listings, rentals, messages, reviews, transactions, documents, etc.)
    - Implementation: Uses React Native Modal and TextInput (not iOS-only Alert.prompt) for cross-platform compatibility on iOS and Android
- **Mobile Payment Integration**: 
  - **PayPal Withdrawals (FULLY IMPLEMENTED)**: Mobile app has complete withdrawal functionality with WithdrawalModal component, balance tracking, withdrawal history, and integration with PayPal Payouts API. Users can withdraw earnings instantly to their PayPal account.
  - **PayPal Payments (FULLY IMPLEMENTED)**: WebView-based integration for both rental and marketplace listing payments. Server-side HTML pages (`/mobile-paypal-rental-payment`, `/mobile-paypal-marketplace-payment`) use PayPal Advanced Checkout card fields with Pay Later disabled. Payments processed securely through PayPal SDK, captured on frontend, verified on backend.
  - **Mobile Auth**: JWT-based authentication with 15-minute access tokens, 7-day refresh tokens, automatic token refresh, and secure token storage using Expo SecureStore. OAuth support via WebBrowser → exchange token → deep link (readysetfly://) → JWT tokens.
- **Mobile Marketplace Features (FULLY IMPLEMENTED)**:
  - **Listing Creation**: Mobile users can create marketplace listings in all 6 categories (Aircraft for Sale, Aviation Jobs, CFI Services, Flight School, Mechanic Services, Charter Services) with multi-step form (category → base fields → details → tier selection → promo code → payment).
  - **Cross-Platform Sync**: Listings created on mobile instantly appear on web, and vice versa (shared database).
  - **Tier Selection**: 3 tiers with varying features and pricing (Basic $25/mo, Standard $100/mo, Premium $250/mo).
  - **Promo Code Integration**: PromoCodeInput component validates promo codes (e.g., "LAUNCH2025" for free 7-day listings) in real-time.
  - **Promo Banner**: PromoBanner component displays active promotional campaigns with auto-refresh (30-second polling) to show admin-created promos immediately.
  - **Payment Flow**: MarketplacePaymentScreen uses WebView PayPal integration for paid listings (same implementation as rental payments).
  - **Navigation**: "Create Listing" button on MarketplaceScreen, full navigation stack for listing creation and payment.
  - **Image Upload**: Not yet implemented for mobile (web has full cloud storage via ObjectUploader). Backend API ready (`/api/objects/upload`, `/api/listing-images`). Mobile needs Expo ImagePicker integration.
  - **Contact Inquiries**: Custom email subject lines with category and listing title (e.g., "Inquiry From Ready Set Fly about your Aircraft for Sale Listing: [Title]").

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: GPT-4o for AI-powered description generation, billed via Replit credits.
- **PayPal Expanded Checkout**: Payment gateway for incoming payments (rentals, marketplace fees) using Advanced Checkout card fields component. Pay Later disabled, credit cards only. Configured for Production environment via PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET secrets.
- **PayPal Payouts API**: For automated, instant owner withdrawals.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Replit Object Storage**: Google Cloud Storage-backed file storage for marketplace listing images and aircraft photos. Implemented with ObjectUploader component (Uppy-based), presigned URL uploads, and ACL-based access control. Images stored with public visibility for listing photos.
- **Resend Email Service**: Transactional email provider for job application notifications and system emails. Integration is installed via Replit Connectors system. **REQUIRES SETUP**: 
  1. Connect Resend in Replit UI (Tools → Integrations → Resend)
  2. Add DNS records to domain registrar for readysetfly.us:
     - TXT: `resend._domainkey` with provided p= value for domain verification
     - MX: `send` → `feedback-smtp.us-east-1.amazonses.com` (priority 10) for sending
     - TXT: `send` → `v=spf1 include:amazonses.com ~all` for SPF
     - TXT: `_dmarc` → `v=DMARC1; p=none;` (optional) for DMARC
     - MX: `@` → `inbound-smtp.us-east-1.amazonaws.com` (priority 0) for receiving
- **FAA Registry API**: Planned integration for N-number lookups.

## Domain & SSL Configuration
- **Custom Domain**: readysetfly.us and www.readysetfly.us
- **HTTPS/SSL**: Managed by Replit's built-in SSL certificate system. DNS records must be configured at domain registrar to point to Replit servers for automatic SSL provisioning.
- **DNS Requirements** (configure at domain registrar, e.g., GoDaddy, Namecheap):
  - A record pointing to Replit's IP address
  - CNAME for www subdomain
  - SSL certificates auto-provision once DNS is correctly configured
- **Note**: HTTPS setup is external to codebase - requires domain registrar configuration, not code changes.