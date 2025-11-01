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
- **Authentication**: Replit Auth (OpenID Connect) with Passport.js.
- **Real-time Messaging**: Custom WebSocket server.
- **UI/UX**: Production-ready components, responsive design across all devices (web and mobile), with specific optimizations for mobile headers, hero sections, and navigation.
- **Verification System**: Multi-step forms, document uploads (pilot licenses, insurance), admin review interface, and a badge system for visual verification status.
- **Document Expiration Tracking**: Monitors critical document expiry with automated notifications and account suspension capabilities; admin interface shows status.
- **Financial Transactions**: Platform-captured payments with transfers via **PayPal Braintree** for rentals and marketplace fees. **PayPal Payouts API** for instant owner withdrawals.
- **Admin Dashboard**: Role-based access, expense tracking, marketplace listing metrics, rental metrics, and monitoring of all financial transactions and withdrawals.
- **Marketplace Features**: Category-specific filters (e.g., keyword search, city, price range, engine type).
- **Listing Management**: Automated system for detecting and managing stale and orphaned listings, with user refresh buttons and monthly email reminders.
- **Sample Listings**: Professionally written example listings for all marketplace categories, visually distinct and read-only.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: GPT-4o for AI-powered description generation, billed via Replit credits.
- **PayPal Braintree**: Payment gateway for incoming payments (rentals, marketplace fees) using Drop-in UI. Configured for Production environment.
- **PayPal Payouts API**: For automated, instant owner withdrawals.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads.
- **FAA Registry API**: Planned integration for N-number lookups.