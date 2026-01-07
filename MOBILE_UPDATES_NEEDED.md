# 📱 Mobile App - Recent Updates & Parity Tasks

**Status:** Mobile app needs updates to match recent web app enhancements  
**Last Updated:** January 7, 2026  
**Total Work:** ~2-3 weeks to achieve full feature parity

---

## Recent Web App Updates (Not Yet in Mobile)

### 1. ✅ AWS S3 Integration for Image Uploads
**Web Status:** Complete  
**Mobile Status:** ⚠️ PARTIALLY SYNCED

**What Changed:**
- Moved from Replit Google Cloud Storage to AWS S3
- Presigned PUT URLs for uploads
- S3 bucket: `readysetfly-images` (us-east-2)

**Mobile Impact:**
- Image upload code in `CreateMarketplaceListingScreen.tsx` uses old API
- Should still work (backend routes conditional on AWS_S3_BUCKET env var)
- **Action:** Verify uploads still work; no code changes needed if backend working

**Verification:**
1. Create marketplace listing with image
2. Check if images display properly
3. If broken, update upload calls to use new `/api/objects/upload` endpoint

---

### 2. ✅ Aircraft Edit Functionality
**Web Status:** Complete  
**Mobile Status:** ❌ NOT IMPLEMENTED

**What Changed:**
- `/edit-aircraft/:id` route now loads existing aircraft data
- Pre-populates form fields
- PATCH endpoint for updates

**Mobile Needs:**
- [ ] Handle edit mode in `CreateMarketplaceListingScreen.tsx` or new `ListAircraftScreen.tsx`
- [ ] Route parameter detection (useRoute equivalent in mobile)
- [ ] Fetch existing aircraft data
- [ ] Pre-populate form

**Priority:** MEDIUM (aircraft rentals important feature)  
**Effort:** 4-6 hours

---

### 3. ✅ Google Analytics with Correct Measurement ID
**Web Status:** Complete (ID: G-5JJ0LMDQ4F)  
**Mobile Status:** ⚠️ NEEDS UPDATE

**What Changed:**
- Updated GA measurement ID to correct property
- Added debug mode for troubleshooting

**Mobile Needs:**
- [ ] Add GA initialization code to App.tsx
- [ ] Track page/screen navigation events
- [ ] Use same measurement ID: `G-5JJ0LMDQ4F`

**Code Example:**
```typescript
import * as Analytics from 'expo-firebase-analytics'; // or google-analytics

// In App.tsx navigation listener
navigation.addListener('state', () => {
  // Fire page_view event
  gtag('event', 'page_view', {
    page_path: getCurrentRoute(),
    page_title: 'screen_name'
  });
});
```

**Priority:** MEDIUM (analytics important for product insights)  
**Effort:** 2-4 hours

---

## Missing Web Features (NOT in Mobile)

### 4. ❌ Pilot Tools Suite
**Web Status:** Complete  
**Mobile Status:** NOT IMPLEMENTED

#### 4a. Logbook Management ⭐ HIGH PRIORITY
**Web Implementation:**
- `client/src/pages/logbook.tsx`
- Create/edit/delete flight entries
- Dual signatures (pilot + CFI)
- CSV export
- IP audit logging

**Mobile Needs:**
- [ ] Create `LogbookScreen.tsx`
- [ ] Form: date, aircraft, flight time, remarks
- [ ] Signature capture (drawing/text)
- [ ] Lock button (pilot signature)
- [ ] Countersign dialog (CFI)
- [ ] List view with edit/delete
- [ ] CSV export functionality

**Why Important:** Digital flight logging is crucial for pilots  
**Priority:** ⭐ HIGH - Pilots want this  
**Effort:** 16-20 hours (signature drawing component complex)

**API Endpoints to Use:**
- `POST /api/logbook` - Create
- `GET /api/logbook` - List
- `PATCH /api/logbook/:id` - Edit
- `POST /api/logbook/:id/lock` - Pilot sign + lock
- `POST /api/logbook/:id/countersign` - CFI sign

---

#### 4b. Weather Integration
**Web Implementation:**
- `client/src/pages/pilot-tools.tsx`
- METAR/TAF lookup for any airport
- Integrated data display
- Links to aviationweather.gov

**Mobile Needs:**
- [ ] Create `PilotToolsScreen.tsx`
- [ ] Text input for airport ICAO code
- [ ] Display METAR/TAF results
- [ ] External links to resources (NOTAM, TFR, etc.)

**API Endpoint:**
- `GET /api/weather/:icaoCode` - Fetch weather data

**Priority:** MEDIUM (nice-to-have, less critical than logbook)  
**Effort:** 6-8 hours

---

#### 4c. Aviation Resources
**Web Implementation:**
- Links in `client/src/pages/pilot-tools.tsx`
- NOTAM search, TFR monitoring, flight planning tools

**Mobile Needs:**
- [ ] Add buttons in `PilotToolsScreen.tsx`
- [ ] Link to FAA NOTAM search
- [ ] Link to FAA TFR service
- [ ] Link to other aviation resources

**Priority:** LOW (mostly external links)  
**Effort:** 2-3 hours

---

### 5. ❌ Ownership Cost Calculator
**Web Status:** Complete  
**Mobile Status:** NOT IMPLEMENTED

**Web Implementation:**
- `client/src/pages/ownership-cost-calculator.tsx`
- Calculates aircraft ownership costs
- Scenario modeling (own vs rent)

**Mobile Needs:**
- [ ] Create `OwnershipCalculatorScreen.tsx`
- [ ] Form inputs: aircraft type, costs, loan details
- [ ] Real-time calculations
- [ ] Results display
- [ ] Scenario comparison

**Why Valuable:** Helps users evaluate rental vs ownership  
**Priority:** LOW-MEDIUM (engagement/monetization opportunity)  
**Effort:** 10-14 hours

---

## Summary: Priority Implementation Order

### Phase 1: Critical (Week 1-2)
1. **Logbook Screen** (16-20h)
   - Flight entry CRUD
   - Signature drawing/text
   - Pilot sign + lock
   - CFI countersign

### Phase 2: High (Week 2-3)
2. **Google Analytics** (2-4h)
3. **Aircraft Edit Mode** (4-6h)

### Phase 3: Medium (Week 3)
4. **Weather Integration** (6-8h)
5. **Ownership Calculator** (10-14h)

### Phase 4: Low
6. **Aviation Resources** (2-3h)

---

## Implementation Checklist

### Logbook Screen
- [ ] Create `mobile/src/screens/LogbookScreen.tsx`
- [ ] Create `mobile/src/components/SignaturePad.tsx` (drawing canvas)
- [ ] Create signature drawing canvas component
  - React Native Gesture Handler for drawing
  - Save as SVG or base64 image
  - Support typing text as fallback
- [ ] Form component for new entry
- [ ] List component for existing entries
- [ ] Edit flow
- [ ] Delete confirmation
- [ ] Lock entry (submit pilot signature)
- [ ] Countersign dialog
- [ ] CSV export via Share/Download
- [ ] Navigation integration (add to tabs/drawer)

### Weather Integration
- [ ] Create `mobile/src/screens/PilotToolsScreen.tsx`
- [ ] ICAO code input field
- [ ] Fetch weather data on submit
- [ ] Display METAR/TAF results
- [ ] External links (NOTAM, TFR, etc.)
- [ ] Error handling
- [ ] Loading state

### Google Analytics
- [ ] Add GA initialization to `App.tsx`
- [ ] Setup measurement ID: `G-5JJ0LMDQ4F`
- [ ] Track screen navigation
- [ ] Add to route change listeners

### Aircraft Edit Mode
- [ ] Modify upload/aircraft screen to detect edit mode
- [ ] Fetch existing aircraft on load
- [ ] Pre-populate form fields
- [ ] Use PATCH endpoint for updates
- [ ] Show "Edit Aircraft" vs "List Aircraft" title

### Ownership Calculator
- [ ] Create `mobile/src/screens/OwnershipCalculatorScreen.tsx`
- [ ] Input form for aircraft details & costs
- [ ] Real-time calculations
- [ ] Results summary
- [ ] Scenario comparison

---

## Database Requirements

All mobile features use existing backend endpoints. No new database tables needed for:
- Logbook (already in PostgreSQL with pilot/cfi signature fields)
- Weather (reads from external API, no DB)
- Ownership Calculator (no persistence)
- Analytics (GA handles persistence)

---

## Known Dependencies/Issues

1. **Signature Drawing:** Will need React Native gesture library
   - `react-native-gesture-handler` (likely already installed)
   - Canvas/SVG library for drawing
   
2. **CSV Export:** Need file system access
   - `expo-file-system` + `expo-sharing` for download/share

3. **Google Analytics:** Need GA initialization
   - `firebase` or `expo-analytics` package

4. **Image Upload:** Verify AWS S3 compatibility
   - Should work with existing `/api/objects/upload` endpoint

---

## Testing Checklist

- [ ] Logbook: Create entry → Sign → View signed
- [ ] Logbook: CFI countersign works
- [ ] Weather: Lookup METAR for valid airport code
- [ ] Weather: External links open in browser
- [ ] Calculator: Calculations accurate
- [ ] GA: Events fire when navigating screens
- [ ] Aircraft Edit: Pre-fills form correctly
- [ ] Image Upload: Still works (S3 backend)

---

## Notes

- Mobile app already has strong foundation (rentals, marketplace, payments working)
- These features enhance specialized use cases (logbook for pilots, calculator for interested buyers)
- Logbook is highest priority (core pilot feature)
- Weather & calculator are nice-to-haves (engagement features)
- All endpoints already exist on backend, just need mobile UI

---

**Status:** Ready for development  
**Estimated Time:** 2-3 weeks for full parity  
**Blockers:** None (all backend endpoints ready)
