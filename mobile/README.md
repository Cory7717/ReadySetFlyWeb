# Ready Set Fly - Mobile App

React Native Expo mobile application for iOS and Android.

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
│   ├── navigation/       # React Navigation setup
│   ├── screens/          # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── RentalsScreen.tsx
│   │   ├── MarketplaceScreen.tsx
│   │   ├── MessagesScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── services/         # API client
│   ├── components/       # Reusable components
│   └── utils/            # Utility functions
├── App.tsx               # Main app entry
├── metro.config.js       # Metro bundler config
└── package.json          # Dependencies
```

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
