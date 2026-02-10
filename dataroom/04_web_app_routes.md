# Web app routes and modules

## Public routes

Key public routes from the app router:

- / (landing)
- /rentals
- /marketplace
- /aircraft/:id
- /pilot-tools
- /flight-planner
- /approach-plates
- /tfr-map
- /ownership-cost-calculator
- /weight-balance
- /radio-comms-trainer
- /adsb-receiver-help
- /gps-sims
- /student (and student sub-routes)
- /ifr-tools
- /faq
- /events
- /privacy-policy
- /terms-of-service

## Protected routes (auth required)

- /dashboard
- /profile
- /messages
- /favorites
- /my-listings
- /list-aircraft
- /create-marketplace-listing
- /marketplace/listing/checkout
- /rental-payment/:id
- /owner-payout-setup
- /owner-withdrawals
- /verify-identity
- /logbook
- /notifications
- /admin (role-based)

## Major feature areas

- Rentals: search, booking, payments, messaging, reviews
- Marketplace: listing creation, paid tiers, upgrades, checkout
- Pilot tools: weather, planning, training utilities
- Admin: users, listings, verifications, banners, analytics

## TBD / confirm

- Admin role matrix and default permission sets.
