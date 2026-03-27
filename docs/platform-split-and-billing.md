## RSF Web / Mobile Split and Billing Guardrails

This document defines the current product boundary for Ready Set Fly and the billing posture we should preserve while native app-store billing is not yet implemented.

### Product split

- Web is the primary surface for:
  - route planning
  - hazard review
  - Leidos filing lifecycle
  - rentals / marketplace management
  - admin and super admin workflows
  - printable/downloadable planning summaries

- Mobile is the primary surface for:
  - tablet cockpit use
  - ownship tracking
  - native ADS-B receiver workflows
  - in-flight traffic awareness
  - live diversion actions
  - quick operational reference during flight

### User-facing message

The clean user story is:

- Plan on the web.
- Fly in the app.

Web should remain useful for planning and testing. Native mobile should become the operational cockpit companion.

### Billing posture

Until Apple / Google native in-app subscription purchase flows are implemented:

- The mobile app should not launch an external checkout flow for RSF subscriptions.
- The mobile app should not contain explicit purchase calls to action that send users to external web billing.
- The mobile app may show membership status and consume existing entitlements after sign-in.
- Billing and subscription-management messaging in mobile should stay neutral:
  - explain that memberships sync into the app
  - explain that billing is managed on the platform where the membership was started

### Current safe behavior

- Web remains the main surface for marketing and subscription purchase.
- Mobile shows membership information and existing access status.
- Mobile premium screens can still honor existing entitlements.

### Next recommended billing step

If RSF wants to sell paid digital features directly inside the native consumer app:

- add Apple in-app subscriptions on iOS
- add Google Play Billing subscriptions on Android
- keep entitlement sync unified across web and mobile

At that point, users can subscribe in-app or on the web, and RSF can reconcile the entitlement server-side.

### In-app subscription rollout sequence

1. Define store products that match RSF membership tiers
   - RSF Pro monthly / annual
   - RSF Pro+ monthly / annual

2. Add native purchase plumbing in mobile
   - iOS StoreKit-backed subscriptions
   - Google Play Billing subscriptions
   - restore purchases flow

3. Add server-side receipt validation
   - Apple receipt / transaction verification
   - Google Play purchase token verification
   - map validated purchases to RSF membership entitlements

4. Keep one entitlement model on the backend
   - app purchases and web purchases should both resolve to the same RSF entitlement object
   - app and web should read the same membership state after sign-in

5. Add app-side membership screens
   - subscribe
   - restore purchases
   - current plan
   - billing source

6. Keep web purchases working
   - users who subscribe on the web should still be able to sign in and consume access in the app
   - app-bought users should also see the same entitlement on the web

7. Only after native billing is working, reintroduce stronger in-app upgrade CTA copy
   - until then, mobile should stay informational and entitlement-aware rather than acting like a checkout surface
