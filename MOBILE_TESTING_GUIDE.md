# Mobile App Testing Guide - Ready Set Fly

## ✅ Prerequisites Check

Your mobile app is ready to test! Here's what you have:
- ✅ Expo SDK 54 installed
- ✅ React Native app configured
- ✅ All features implemented (Messaging, Reviews, Favorites)

---

## 🚀 Quick Start - Test on Your Phone

### Option 1: Using Expo Go App (Easiest - Recommended for Testing)

#### Step 1: Install Expo Go on Your Phone
- **iPhone:** [Download from App Store](https://apps.apple.com/app/expo-go/id982107779)
- **Android:** [Download from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

#### Step 2: Start the Development Server
```powershell
cd C:\Users\carme\ReadySetFlyWeb\ReadySetFly\mobile
npm start
```

This will:
- Start the Expo dev server
- Show a QR code in your terminal
- Open Expo Dev Tools in your browser

#### Step 3: Connect Your Phone
**On iPhone:**
1. Open the **Camera** app
2. Point it at the QR code in your terminal
3. Tap the notification that appears
4. The app will open in Expo Go

**On Android:**
1. Open the **Expo Go** app
2. Tap "Scan QR Code"
3. Scan the QR code from your terminal
4. The app will load

#### Step 4: Important - Update API URL
Currently, your mobile app points to production (`https://readysetfly.us`). 

**To test with your local backend:**
1. Make sure your backend is running on port 5000
2. Find your computer's local IP address:
   ```powershell
   ipconfig
   # Look for "IPv4 Address" (usually 192.168.x.x)
   ```
3. Update `mobile/src/services/api.ts` line 12:
   ```typescript
   // Change from:
   const API_BASE_URL = 'https://readysetfly.us';
   
   // To (use YOUR IP address):
   const API_BASE_URL = 'http://192.168.1.100:5000';
   ```

**Important Notes:**
- Your phone and computer must be on the **same WiFi network**
- If using local backend, start it first: `npm run dev` in main project folder
- The app will hot-reload when you make code changes

---

### Option 2: Build and Install Native App (Production Testing)

If you want to test a standalone app without Expo Go:

#### For Android (APK)
```powershell
cd C:\Users\carme\ReadySetFlyWeb\ReadySetFly\mobile

# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Login to Expo
eas login

# Build Android APK
eas build --platform android --profile preview
```

This will:
- Build a standalone APK
- Take 10-15 minutes
- Give you a download link when complete
- You can install the APK directly on your Android device

#### For iOS (Requires Apple Developer Account)
```powershell
# Build for iOS
eas build --platform ios --profile preview
```

Note: iOS builds require an Apple Developer account ($99/year)

---

## 🧪 What to Test

Once the app loads on your phone, test these features:

### 1. Authentication
- [ ] Tap "Sign In" button
- [ ] Complete Google OAuth flow
- [ ] Verify you're signed in (shows your name)

### 2. Aircraft Rentals
- [ ] Browse aircraft listings
- [ ] Search/filter aircraft
- [ ] View aircraft details
- [ ] See reviews on aircraft details
- [ ] Tap the heart icon to favorite an aircraft
- [ ] Book an aircraft (test flow)

### 3. Messaging System (NEW!)
- [ ] Go to "Messages" tab
- [ ] View active rental conversations
- [ ] Send a message
- [ ] Verify real-time message delivery

### 4. Reviews (NEW!)
- [ ] Go to "Profile" → "My Rentals"
- [ ] Find a completed rental
- [ ] Tap "Leave a Review"
- [ ] Submit a 5-star review with comment
- [ ] Verify it appears on aircraft detail page

### 5. Favorites (NEW!)
- [ ] Go to "Profile" → "Favorites"
- [ ] See your favorited aircraft and marketplace items
- [ ] Toggle favorites (heart icon)
- [ ] Verify tabs work (Aircraft vs Marketplace)

### 6. Marketplace
- [ ] Browse marketplace categories
- [ ] View listings
- [ ] Create a new listing
- [ ] Test AI description generator

### 7. Balance & Withdrawals
- [ ] Go to "Profile" → "Balance & Withdrawals"
- [ ] View your balance
- [ ] Test withdrawal flow (if you have balance)

---

## 🐛 Troubleshooting

### "Cannot connect to Metro bundler"
- Make sure your phone and computer are on the same WiFi
- Restart the Expo server: Ctrl+C then `npm start` again
- Try shaking your phone and tapping "Reload"

### "Network request failed" or API errors
- Check that backend is running on port 5000
- Verify you updated API_BASE_URL with your local IP
- Make sure Windows Firewall allows port 5000

### "Socket connection failed" (Messaging)
- WebSocket needs your local IP, not localhost
- Update socket.ts if needed:
  ```typescript
  const API_URL = 'http://192.168.1.100:5000';
  ```

### App crashes or freezes
- Shake your phone to open dev menu
- Tap "Reload"
- Check terminal for error messages

---

## 🔥 Quick Commands Reference

```powershell
# Start development server
cd C:\Users\carme\ReadySetFlyWeb\ReadySetFly\mobile
npm start

# Start with cache cleared
npm start --clear

# Run on Android emulator (if you have Android Studio)
npm run android

# Run on iOS simulator (if you have Xcode - Mac only)
npm run ios

# Stop the server
# Press Ctrl+C in terminal
```

---

## 📱 Expo Go App Features

While testing in Expo Go, you can:
- **Shake your phone** - Opens developer menu
- **Reload** - Refresh the app
- **Debug** - View console logs
- **Performance Monitor** - See FPS and memory usage

---

## 🎯 Next Steps After Testing

Once you've tested successfully:

1. **Report Issues** - Note any bugs or UX issues
2. **Test on Both Platforms** - iOS and Android behavior may differ
3. **Performance Check** - Ensure smooth scrolling and navigation
4. **Real Data Test** - Test with actual rental bookings
5. **Build Production App** - Use EAS Build when ready to publish

---

## 📊 Current Mobile App Status

✅ **IMPLEMENTED:**
- Aircraft rentals (browse, search, book, pay)
- Marketplace (all 6 categories)
- Real-time messaging (NEW!)
- Reviews & ratings (NEW!)
- Favorites/wishlist (NEW!)
- Balance & PayPal withdrawals
- Verification status
- Google OAuth authentication

⏳ **OPTIONAL (Lower Priority):**
- My Listings management
- Personal Info editor

---

## 🆘 Need Help?

If you encounter issues:
1. Check the terminal where `npm start` is running for errors
2. Check Expo Dev Tools in your browser
3. Shake phone → Tap "Show Element Inspector" to debug UI
4. Enable Remote Debugging for full console access

**Common First-Time Setup:**
- Make sure backend is running: `npm run dev` in main project folder
- Your phone must be on same WiFi as your computer
- Update API_BASE_URL to your local IP (192.168.x.x:5000)

---

**Happy Testing! 🚀**

