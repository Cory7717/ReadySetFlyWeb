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
- **Authentication**: Unified authentication supporting both OAuth (Google/GitHub via Replit Auth) and email/password for web and mobile. Web uses session cookies, mobile uses JWT tokens (15-min access, 7-day refresh). OAuth for mobile uses browser-based flow → exchange token (5-min expiry) → deep link callback → JWT tokens. All users can log in with ANY email provider (not limited to Gmail). Passwords hashed with bcrypt (cost factor 12), refresh tokens and exchange tokens hashed with SHA-256 before storage.
- **Real-time Messaging**: Custom WebSocket server.
- **UI/UX**: Production-ready components, responsive design across all devices (web and mobile), with specific optimizations for mobile headers, hero sections, and navigation.
- **Verification System**: Multi-step forms, document uploads (pilot licenses, insurance), admin review interface, and a badge system for visual verification status.
- **Document Expiration Tracking**: Monitors critical document expiry with automated notifications and account suspension capabilities; admin interface shows status.
- **Financial Transactions**: Platform-captured payments with transfers via **PayPal Braintree** for rentals and marketplace fees. **PayPal Payouts API** for instant owner withdrawals.
- **Admin Dashboard**: Role-based access, expense tracking, marketplace listing metrics, rental metrics, and monitoring of all financial transactions and withdrawals.
- **Marketplace Features**: Category-specific filters (e.g., keyword search, city, price range, engine type).
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
  - **Braintree Payments (REQUIRES SETUP)**: RentalPaymentScreen created with WebView-based integration following security best practices. Requires: (1) installing `react-native-webview` via `npx expo install react-native-webview` in mobile directory, (2) creating server-side payment HTML page at `server/mobile-braintree-payment.html`, (3) adding server route for payment page. See `MOBILE_PAYMENT_SETUP.md` for complete setup instructions.
  - **Mobile Auth**: JWT-based authentication with 15-minute access tokens, 7-day refresh tokens, automatic token refresh, and secure token storage using Expo SecureStore. OAuth support via WebBrowser → exchange token → deep link (readysetfly://) → JWT tokens.
- **Mobile Marketplace Features (FULLY IMPLEMENTED)**:
  - **Listing Creation**: Mobile users can create marketplace listings in all 6 categories (Aircraft for Sale, Aviation Jobs, CFI Services, Flight School, Mechanic Services, Charter Services) with multi-step form (category → base fields → details → tier selection → promo code → payment).
  - **Cross-Platform Sync**: Listings created on mobile instantly appear on web, and vice versa (shared database).
  - **Tier Selection**: 3 tiers with varying features and pricing (Basic $25/mo, Standard $100/mo, Premium $250/mo).
  - **Promo Code Integration**: PromoCodeInput component validates promo codes (e.g., "LAUNCH2025" for free 7-day listings) in real-time.
  - **Promo Banner**: PromoBanner component displays active promotional campaigns with auto-refresh (30-second polling) to show admin-created promos immediately.
  - **Payment Flow**: MarketplacePaymentScreen uses WebView Braintree integration for paid listings (requires same setup as rental payments).
  - **Navigation**: "Create Listing" button on MarketplaceScreen, full navigation stack for listing creation and payment.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: GPT-4o for AI-powered description generation, billed via Replit credits.
- **PayPal Braintree**: Payment gateway for incoming payments (rentals, marketplace fees) using Drop-in UI. Configured for Production environment.
- **PayPal Payouts API**: For automated, instant owner withdrawals.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads.
- **FAA Registry API**: Planned integration for N-number lookups.