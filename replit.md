# Ready Set Fly - Aviation Marketplace & Rental Platform

## Overview
Ready Set Fly is a comprehensive aviation marketplace and rental platform designed to connect verified pilots with aircraft owners for rentals and other aviation-related services. The platform aims to streamline aircraft rentals, facilitate a multi-category marketplace (aircraft sales, aviation jobs, CFI listings, flight schools, mechanics, charter services), and provide integrated messaging for active rentals. The business vision is to become the leading online hub for the aviation community, enhancing accessibility and efficiency in aircraft utilization and related services, with significant market potential in the private and commercial aviation sectors.

## User Preferences
I prefer detailed explanations and clear breakdowns of complex features. I want to be informed before any major architectural changes are made. I prefer an iterative development approach, focusing on completing high-priority features before moving to medium or low priority tasks. Do not make changes to files or folders without explicit approval, especially those related to core infrastructure or external integrations.

## System Architecture
The platform is built with a **React frontend** utilizing Wouter for routing, TanStack Query for data fetching, and shadcn/ui for components, ensuring a modern and responsive user interface. The **backend** is an Express.js application, persisting data in **PostgreSQL** via Drizzle ORM. **Replit Auth** (OpenID Connect) with passport.js handles authentication, providing secure access and session management. A **WebSocket server** facilitates real-time messaging for active rentals.

Key architectural decisions include a robust **verification system** for both renters and aircraft owners, involving multi-step forms, document uploads, and an admin review interface. This system integrates a **badge system** to visually indicate verification statuses. The platform employs a **platform-captured payments with transfers** model via **Stripe** for all financial transactions, including rental payments, owner payouts, and marketplace listing fees. This involves detailed fee calculations (sales tax, platform commission, processing fees) and comprehensive webhook handling for asynchronous event processing. An **admin dashboard** provides role-based access for user and listing management, and analytics tracking.

## Recent Changes (October 23, 2025)
- **Aircraft Detail Fields**: Added comprehensive aircraft information fields for marketplace listings:
  - Avionics Package (detailed description field)
  - Number of Seats
  - Useful Load (pounds)
  - Annual Due Date (month/year input)
  - Interior Condition (excellent/good/fair/needs-work dropdown)
  - Exterior/Paint Condition (excellent/good/fair/needs-work dropdown)
  - Damage History (disclosure field with note about accuracy requirements)
  - Required fields (Make, Model, Year) now clearly marked with asterisks (*)
- **Payment Security Enhancements**:
  - Implemented server-side pricing calculation for all marketplace listings to prevent client-side price manipulation
  - Added PaymentIntent verification before listing creation to ensure payment completed successfully
  - Fixed user authentication upsert logic to check both ID and email, preventing 404 errors
- **Responsive Design**: All marketplace listing forms now use responsive grid layouts (`grid-cols-1 md:grid-cols-2/3`) for optimal mobile, tablet, and desktop display

## External Dependencies
- **PostgreSQL**: Primary database, hosted via Neon.
- **Replit Auth**: OpenID Connect authentication provider (Google, GitHub, email/password).
- **Replit AI Integrations (OpenAI)**: AI-powered description generation for all listing types using GPT-4o. Integrated via Replit AI blueprint, billed to Replit credits instead of requiring user's OpenAI API key. Supports aircraft rentals, aircraft sales, aviation jobs, CFI listings, flight schools, mechanic services, and charter services.
- **Stripe**: Payment processing for rentals, owner payouts, and marketplace listing subscriptions. Server-side pricing validation prevents client manipulation. Requires `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLIC_KEY`, and `STRIPE_WEBHOOK_SECRET`.
- **WebSocket server**: Custom implementation for real-time messaging.
- **Cloud Storage**: Planned integration (e.g., AWS S3, Cloudinary) for file uploads, currently using placeholder URLs.
- **FAA Registry API**: Planned integration for automatic N-number lookups and cross-verification.