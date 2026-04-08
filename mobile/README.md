# Ready Set Fly - Mobile App

React Native Expo mobile application for iOS and Android.
Last updated: 2026-02-02

## 📱 Features

- **Aircraft Rentals**: Browse and book aircraft
- **Marketplace**: 6 categories (Jobs, Sales, CFIs, Schools, Mechanics, Charter)
- **Real-time Messaging**: Chat with owners/renters
- **Profile Management**: Verification, balance, withdrawals
- **Secure Payments**: Braintree integration
- **All website features except Admin Dashboard**

## 🚀 Getting Started

### Prerequisites

- Node.js installed
- Expo Go app on your Android/iOS device
- Backend API running at https://readysetfly.us

### Installation

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **View on your device:**
   - Open **Expo Go** app on your Android device
   - Scan the QR code shown in the terminal
   - App will load instantly on your device!

### Alternative Commands

```bash
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator (Mac only)
npm run web        # Run in web browser
```

## 📁 Project Structure

```
mobile/
├── src/
│   ├── navigation/              # React Navigation setup
│   │   ├── AppNavigator.tsx     # Main tab navigator
│   │   ├── RentalsStack.tsx     # Rentals nested stack
│   │   ├── MarketplaceStack.tsx # Marketplace nested stack
│   │   └── ProfileStack.tsx     # Profile nested stack
│   ├── screens/                 # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── RentalsScreen.tsx
│   │   ├── AircraftDetailScreen.tsx    # ← Phase 3
│   │   ├── BookingScreen.tsx           # ← Phase 3
│   │   ├── MarketplaceScreen.tsx
│   │   ├── MarketplaceCategoryScreen.tsx # ← Phase 3
│   │   ├── MarketplaceDetailScreen.tsx   # ← Phase 3
│   │   ├── MessagesScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── MyRentalsScreen.tsx        # ← Phase 3
│   │   ├── BalanceScreen.tsx          # ← Phase 3
│   │   ├── VerificationScreen.tsx     # ← Phase 3
│   │   └── AuthScreen.tsx
│   ├── services/        # API client with typed endpoints
│   ├── utils/           # Auth hooks and utilities
│   └── components/      # Reusable components
├── App.tsx              # Main app entry
├── metro.config.js      # Metro bundler config
└── package.json         # Dependencies
```

## 🎯 **Phase 3 Features (NEW!)**

### **Nested Navigation**
- Stack navigators within each tab for detail screens
- Smooth transitions between list and detail views
- Tab bar stays visible during navigation

### **Rentals Flow**
1. **Browse Aircraft** → Tap card to view details
2. **Aircraft Detail** → See full specs, location, requirements
3. **Booking Flow** → Enter dates, hours, see cost breakdown
4. **Payment** → Continue to payment (integration pending)

### **Marketplace Flow**
1. **Browse Categories** → 6 aviation categories
2. **Category Listings** → Filter by category
3. **Listing Detail** → Full description, contact info
4. **Contact Seller** → Email/phone integration

### **Profile Features**
1. **My Rentals** → View booking history with status badges
2. **Balance & Withdrawals** → Check earnings, withdraw to PayPal
3. **Verification Status** → Track document uploads
4. **Settings** → Notifications, help & support

## 🔧 Configuration

### Shared Types
Mobile app imports shared TypeScript types from `../shared/schema.ts`:

```typescript
import type { AircraftListing, User, Rental } from '@shared/schema';
```

All API responses are properly typed using these shared schemas, ensuring type safety across the entire stack.

### API Configuration
Backend API URL is configured in `src/services/api.ts`:

```typescript
const API_BASE_URL = 'https://readysetfly.us';
```

### Authentication
The app uses Replit Auth (OIDC) for authentication:
- Session cookies are automatically included in API requests (`withCredentials: true`)
- `useAuth()` hook provides current user state
- AuthScreen handles sign-in flow via web browser redirect

## 🛠 Tech Stack

- **React Native**: Cross-platform mobile framework
- **Expo**: Development toolchain
- **TypeScript**: Type safety
- **React Navigation**: Navigation system
- **TanStack Query**: Data fetching & caching
- **Axios**: HTTP client
- **Expo Vector Icons**: Icon library

## 📝 Development Notes

- LSP errors before `npm install` are expected
- App connects to production backend API
- Uses same database and authentication as web app
- No admin dashboard (web-only feature)

## 🎯 Next Steps

1. Install dependencies: `npm install`
2. Start dev server: `npm start`
3. Scan QR code with Expo Go
4. See live updates as you develop!

## ❓ Troubleshooting

**Dependencies not installing:**
- Make sure you're in the `mobile/` directory
- Try `rm -rf node_modules package-lock.json && npm install`

**App won't load:**
- Ensure backend API is running
- Check your internet connection
- Try clearing Expo cache: `expo start --clear`

**Can't scan QR code:**
- Ensure phone and computer are on same network
- Try tunnel mode: `expo start --tunnel`

## Mobile Build Notes

### Android Google Maps key

- `react-native-maps` on Android needs the Google Maps API key in the native app build.
- Set `GOOGLE_MAPS_API_KEY` in the Expo/EAS build environment used for the Android build.
- `mobile/app.config.ts` injects that key into `android.config.googleMaps.apiKey`.
- The app also exposes `extra.googleMaps.androidApiKeyConfigured` so QA can see whether the build received the key.
- A Render env var on `readysetfly-api` does not reach the Android native build, so setting it only on Render is not sufficient.

### Auth model

- Mobile uses bearer tokens for native auth.
- Shared backend routes protected by `isAuthenticated` now accept both bearer tokens and session auth.
- Auth resume diagnostics log under `[RSF:auth]` and `[RSF:api]`.

### QA logging

- JS/runtime logs: `npx expo start` or `npx expo start --dev-client`
- Android logs: `adb logcat | findstr RSF:`
- Native crash logs: `adb logcat AndroidRuntime:E *:S`
- Enable app diagnostics with `EXPO_PUBLIC_ENABLE_DEBUG_LOGS=true`
- Route map diagnostics appear in Flight Planner when diagnostics are enabled or when the map times out
