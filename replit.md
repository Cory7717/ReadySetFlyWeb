# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation-related services. The platform aims to streamline aircraft rentals, facilitate a multi-category marketplace (aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, charter services), and provide integrated messaging for active rentals. The business vision is to become the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in the private and commercial aviation sectors.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform features a **React frontend** with Wouter for routing, TanStack Query for data fetching, and shadcn/ui for components, ensuring a modern and responsive user interface across all devices. The **backend** is an Express.js application, persisting data in **PostgreSQL** via Drizzle ORM. **Replit Auth** (OpenID Connect) with passport.js handles secure authentication and session management. A **WebSocket server** facilitates real-time messaging for active rentals.

Core architectural decisions include a robust **verification system** for renters and aircraft owners, incorporating multi-step forms, document uploads (e.g., pilot licenses, insurance), and an admin review interface. A **badge system** visually indicates verification statuses. All financial transactions utilize a **platform-captured payments with transfers** model via **Stripe**, handling rental payments, owner payouts, and marketplace listing fees with detailed fee calculations and webhook processing. An **admin dashboard** provides role-based access for comprehensive management and analytics. The system also includes an **expiration system for marketplace listings** with a grace period and reactivation functionality, and a **rating and review system** for completed rentals, calculating average user ratings. Database schema updates and performance indexes are implemented for enhanced functionality and efficient querying of location, engine type, and category filters. Production-ready image uploads use multer with local disk storage.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect authentication provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: AI-powered description generation for all listing types (aircraft rentals, sales, jobs, CFI, flight schools, mechanics, charter services) using GPT-4o, billed via Replit credits.
- **Stripe**: Payment processing for rentals, owner payouts, and marketplace listing subscriptions, including server-side pricing validation.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads.
- **FAA Registry API**: Planned integration for automatic N-number lookups and cross-verification.