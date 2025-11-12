# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is an aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation services. It aims to be the leading online hub for the aviation community, facilitating aircraft rentals and supporting a multi-category marketplace including aircraft sales, jobs, CFI listings, flight schools, mechanics, and charter services. The platform seeks to enhance accessibility and efficiency in aircraft utilization and related services, targeting significant market potential in both private and commercial aviation.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform operates as a **monorepo** encompassing shared backend, web, and mobile applications.

- **Frontend**: React (Web) and React Native Expo (Mobile - iOS/Android) for a unified experience, excluding the admin dashboard on mobile. Uses Wouter, TanStack Query, and shadcn/ui for web components.
- **Backend**: Express.js, serving both web and mobile clients.
- **Shared Types**: Common TypeScript schemas ensure consistency across the monorepo.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Unified system supporting OAuth (Google/GitHub via Replit Auth) and email/password. Web uses session cookies with rolling expiration; mobile uses JWT tokens (15-min access, 7-day refresh). Email verification is required for email/password users, while OAuth users are automatically verified.
- **Real-time Messaging**: Custom WebSocket server for real-time communication.
- **UI/UX**: Responsive design optimized for all devices, utilizing production-ready components.
- **Verification System**: Multi-step forms for document uploads (pilot licenses, insurance), requiring admin review. Verification is mandatory for aircraft rental listings (owners) and booking rentals (renters).
- **Document Expiration Tracking**: System to monitor document expiry, provide automated notifications, and enable account suspension for expired documents.
- **Financial Transactions**: Integrated with PayPal Expanded Checkout for platform-captured payments (rentals, marketplace fees) and PayPal Payouts API for instant owner withdrawals. A strict "no refunds for weather-related cancellations" policy is enforced.
- **Admin Dashboard**: Provides role-based access for expense tracking, marketplace and rental metrics, and monitoring financial transactions. Includes an admin notification system for marketplace listing thresholds and a banner ad order system for managing sponsored advertisements from order creation to live ad activation.
- **Banner Ad Rotation System**: Professional, non-intrusive rotating banner ad component for monetization. Features automated 8-second rotation through multiple ads, placement-specific targeting (home, rentals, marketplace), category-specific filtering for marketplace, real-time impression and click tracking, and intelligent layout management that creates zero gap when no ads are available. Component includes "Sponsored" labeling, rotation indicator dots, external link handling with security headers, and comprehensive state management that resets on ad collection changes to ensure accurate tracking.
- **Marketplace Features**: Category-specific filters for efficient searching (e.g., keyword, location, price range). Aircraft rental filters include location-based search with keyword, city/state, and radius selection.
- **Listing Management**: Automated system for identifying and managing stale/orphaned listings, with user refresh options and email reminders.
- **App Store Compliance**: Implements comprehensive Privacy Policy and Terms of Service. Features a multi-channel account deletion system for permanent user data removal across all platforms.
- **Mobile Payment & Withdrawal Integration**: Full functionality for withdrawals via PayPal Payouts API and payments via WebView-based PayPal integration for rentals and marketplace listings.
- **Mobile Marketplace Features**: Allows users to create listings in all categories with multi-step forms, tier selection, promo code integration, and payment processing.
- **Contact Form System**: Public API endpoint for contact submissions with server-side validation, IP-based rate limiting, database persistence for all submissions, and asynchronous email delivery via Resend.
- **Expiration Reminder System**: Automated 2-day expiration reminder emails for both banner ads and marketplace listings. Scheduled cron endpoint (`/api/cron/send-expiration-reminders`) checks daily for expiring items, sends professional reminder emails via Resend, and tracks sent status in database. Endpoint is secured with `X-Cron-Secret` header authentication.
- **Listing Upgrade System**: PayPal-integrated tier upgrade flow for aircraft-sale listings. Users can upgrade from Basic ($25/mo) → Standard ($40/mo) → Premium ($100/mo) tiers through secure payment processing. Features include: modal-based tier selection, upgrade cost calculation with tax, checkout page integration, server-side pricing validation, ownership verification, downgrade prevention, and replay attack protection via upgradeTransactions tracking. Pricing configuration centralized in shared/config/listingPricing.ts for consistency.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect provider for user authentication.
- **Replit AI Integrations (OpenAI)**: GPT-4o for AI-powered description generation.
- **PayPal Expanded Checkout**: Payment gateway for incoming transactions.
- **PayPal Payouts API**: For automated owner withdrawals.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Replit Object Storage**: Google Cloud Storage-backed for image uploads and storage.
- **Resend Email Service**: Transactional email provider for notifications and system emails.
- **FAA Registry API**: Planned integration for N-number lookups.