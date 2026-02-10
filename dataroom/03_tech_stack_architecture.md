# Tech stack and architecture

## Web

- React 18 + Vite
- TypeScript
- Tailwind CSS + Radix UI
- TanStack Query
- Wouter routing
- Leaflet for mapping (no Mapbox)

## Backend

- Node.js + Express
- TypeScript
- Drizzle ORM
- WebSockets for real-time messaging

## Data and storage

- PostgreSQL (Neon serverless)
- Object storage for user uploads
- Schema shared between web and mobile (TypeScript)

## Payments

- PayPal Orders API
- Braintree (payouts / marketplace approval pending)

## AI

- OpenAI API integration for content assistance (listing descriptions)

## Deployment

- Backend on Render
- Frontend on GitHub Pages (pages build)

## TBD / confirm

- Current CI/CD pipeline details.
- Environment isolation (dev/stage/prod) and secrets management.
