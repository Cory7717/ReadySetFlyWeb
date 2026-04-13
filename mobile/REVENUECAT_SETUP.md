# RevenueCat Setup

RSF mobile uses RevenueCat for in-app subscriptions.

## Required env vars

Set these in the Expo/EAS build environment used for the mobile app:

- `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`

Android uses `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`.

iOS uses `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`.

If either key is missing, the app will disable RevenueCat on that platform and show a clear runtime status message in the paywall screen.

## Where to set them

For local development builds:

```bash
cd mobile
set EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=your_google_public_sdk_key
set EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=your_apple_public_sdk_key
npx expo start --dev-client
```

For EAS:

1. Add the variables to the correct EAS environment: `development`, `preview`, or `production`.
2. Build with the matching profile from [eas.json](/c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/eas.json:1).
3. Confirm the build logs do not show an RSF RevenueCat missing-key warning.

## Expo / native note

RSF is using `react-native-purchases` with Expo development or internal builds.

No additional Expo config plugin is currently required in this repo for RevenueCat.

Real purchases do **not** work correctly in Expo Go. Use an Expo development build, preview build, or production build.

## Android billing testing

Google Play Billing only validates correctly when the app is distributed through the Play testing flow.

Use one of:

- Internal testing
- Closed testing
- Open testing

Do not treat a direct APK install as a valid Play billing test. Direct installs can launch the app, but they do not provide reliable Google Play purchase validation.

## Expected entitlements

RevenueCat entitlements expected by RSF:

- `pro_access`
- `pro_plus_access`

## Expected package IDs

RSF currently expects these package identifiers:

- `$rc_monthly`
- `$rc_annual`
- `pro_plus_monthly`
- `pro_plus_annual`

Optional future package naming supported by the selector:

- `pro_monthly`
- `pro_annual`
- `pro_plus_biannual`

## Current app behavior

- App startup initializes RevenueCat in [App.tsx](/c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/App.tsx:24)
- Runtime purchase logic lives in [src/services/purchases.ts](/c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/services/purchases.ts:1)
- Auth sync logs the signed-in RSF user into RevenueCat in [src/utils/auth.ts](/c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/utils/auth.ts:8)
- The current paywall entry point is [src/screens/LogbookProScreen.tsx](/c:/Users/carme/ReadySetFlyWeb/ReadySetFly/mobile/src/screens/LogbookProScreen.tsx:1)
