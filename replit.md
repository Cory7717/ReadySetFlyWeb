# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation-related services. The platform aims to streamline aircraft rentals, facilitate a multi-category marketplace (aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, charter services), and provide integrated messaging for active rentals. The business vision is to become the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in the private and commercial aviation sectors.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform is built with a **React frontend** utilizing Wouter for routing, TanStack Query for data fetching, and shadcn/ui for components, ensuring a modern and responsive user interface. The **backend** is an Express.js application, persisting data in **PostgreSQL** via Drizzle ORM. **Replit Auth** (OpenID Connect) with passport.js handles authentication, providing secure access and session management. A **WebSocket server** facilitates real-time messaging for active rentals.

Key architectural decisions include a robust **verification system** for both renters and aircraft owners, involving multi-step forms, document uploads, and an admin review interface. This system integrates a **badge system** to visually indicate verification statuses. The platform employs a **platform-captured payments with transfers** model via **Stripe** for all financial transactions, including rental payments, owner payouts, and marketplace listing fees. This involves detailed fee calculations (sales tax, platform commission, processing fees) and comprehensive webhook handling for asynchronous event processing. An **admin dashboard** provides role-based access for user and listing management, and analytics tracking.

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect authentication provider (Google, GitHub, email/password).
- **Stripe**: Payment processing for rentals, owner payouts, and marketplace listing subscriptions. Requires `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLIC_KEY`, and `STRIPE_WEBHOOK_SECRET`.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads, currently using placeholder URLs.
- **FAA Registry API**: Planned integration for automatic N-number lookups and cross-verification.