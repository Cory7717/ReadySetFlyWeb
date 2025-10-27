# Integration Roadmap

## PayPal Braintree Payment Integration

### Marketplace Setup Requirements

**IMPORTANT:** Braintree Marketplace functionality requires special approval from Braintree.

#### Setup Process:
1. **Contact Braintree Sales**
   - Call: 855-787-6121
   - Or submit ticket via Braintree Control Panel
   - Request: Enable "Braintree Marketplace" for your merchant account

2. **Requirements:**
   - Master merchant account must be US-based
   - All sub-merchants (aircraft owners) must be US-based
   - USD transactions only
   - Platform is jointly liable for all sub-merchant fees, chargebacks, refunds

3. **Key Resources:**
   - [Braintree Marketplace Overview](https://developer.paypal.com/braintree/docs/guides/braintree-marketplace)
   - [Sub-Merchant Onboarding](https://developer.paypal.com/braintree/docs/guides/braintree-marketplace/onboarding)
   - [Funding & Disbursements](https://articles.braintreepayments.com/guides/braintree-marketplace/funding)

## PayPal Braintree Payment Integration

### Required Secrets
- `BRAINTREE_MERCHANT_ID` - Your unique merchant identifier
- `BRAINTREE_PUBLIC_KEY` - Public key for client-side payment form initialization
- `BRAINTREE_PRIVATE_KEY` - Private key for secure server-side transaction processing

### Integration Points

1. **Rental Transactions** (`client/src/pages/rental-payment.tsx`)
   - ✅ COMPLETED: Braintree Drop-in UI for rental payments
   - ✅ COMPLETED: Transaction processing with automatic settlement
   - ✅ COMPLETED: Payment verification and rental activation

2. **Marketplace Listing Fees** (`client/src/pages/marketplace-listing-checkout.tsx`)
   - ✅ COMPLETED: Braintree checkout flow for marketplace listing fees
   - ✅ COMPLETED: One-time fees for marketplace categories ($25-$250/month based on tier)
   - ✅ COMPLETED: Server-side pricing validation

3. **Owner Payouts** (`client/src/pages/owner-payout-setup.tsx`)
   - ✅ COMPLETED: Informational payout setup page with Braintree Marketplace documentation
   - ✅ COMPLETED: Dashboard integration with "Setup Payouts" button
   - ⏳ TODO: Contact Braintree Sales to enable Marketplace functionality
   - ⏳ TODO: Implement Braintree Sub-Merchant account creation API
   - ⏳ TODO: Automatic payout transfers after rental completion (minus platform fees)

### Implementation Steps
1. ✅ Install Braintree package: `braintree` installed
2. ✅ Configure Braintree credentials via Replit Secrets
3. ✅ Create backend endpoints:
   - GET `/api/braintree/client-token` - Generate client token for frontend
   - POST `/api/braintree/checkout-listing` - Process marketplace listing payments
   - POST `/api/braintree/checkout-rental` - Process rental payments
4. ✅ Implement Braintree Drop-in UI in frontend payment forms
5. ✅ Handle payment confirmations and create rental/listing records
6. ✅ Update payment verification endpoints to use Braintree transactions
7. ✅ Create owner payout setup page with instructional information
8. ⏳ TODO: Get Braintree Marketplace approval from Braintree Sales
9. ⏳ TODO: Implement sub-merchant account creation API (`MerchantAccount::create`)
10. ⏳ TODO: Add webhooks for sub-merchant account approval and disbursement failures

### API Endpoints

#### Backend (Braintree Gateway)
```typescript
// Initialize Braintree gateway
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox, // or Production
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});
```

#### Client Token Generation
```typescript
GET /api/braintree/client-token
Response: { clientToken: "..." }
```

#### Transaction Processing
```typescript
POST /api/braintree/checkout-listing
Body: { paymentMethodNonce, category, tier }
Response: { success: true, transactionId: "...", amount: 25 }

POST /api/braintree/checkout-rental
Body: { paymentMethodNonce, amount, rentalId }
Response: { success: true, transactionId: "..." }
```

## WebSocket Messaging Integration

### Integration Points

1. **Server Setup** (`server/routes.ts`)
   ```typescript
   // Add WebSocket server on distinct path (not /vite-hmr)
   import { WebSocketServer, WebSocket } from 'ws';
   
   const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
   
   wss.on('connection', (ws) => {
     ws.on('message', (data) => {
       // Validate rental is active before allowing messages
       // Broadcast to rental participants only
     });
   });
   ```

2. **Client Connection** (`client/src/pages/rental-messages.tsx` - to be created)
   ```typescript
   const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
   const wsUrl = `${protocol}//${window.location.host}/ws`;
   const socket = new WebSocket(wsUrl);
   
   socket.onmessage = (event) => {
     // Handle incoming messages
     // Only show if rental status === "active"
   };
   ```

3. **Active Rental Validation**
   - Server checks rental status before allowing WebSocket connections
   - Frontend shows messaging interface only for active rentals
   - Disable messaging when rental status changes to "completed" or "cancelled"

### Implementation Steps
1. WebSocket package already installed (`ws` in package.json)
2. Create WebSocket server in `server/routes.ts`
3. Add rental ID validation middleware
4. Create messaging UI component with active rental check
5. Store messages in backend via `/api/messages` for persistence

## Current MVP Status

### ✅ Completed
- Backend API routes for aircraft, marketplace, rentals, messages, transactions
- Fee calculation (15% split: 7.5% renter + 7.5% owner)
- Active rental validation for messaging (backend)
- Frontend connected to backend (home, marketplace, aircraft-detail, list-aircraft)
- Mock data seeded (6 aircraft, 3 marketplace listings, 3 users)
- **PayPal Braintree payment integration** for rental and marketplace listing payments
- Braintree Drop-in UI for seamless payment collection
- Server-side transaction verification and validation

### 🚧 In Progress
- Dashboard page needs backend connection
- Profile page needs backend connection
- Braintree Sub-Merchant accounts for owner payouts

### 📝 Future Enhancements
- Full Braintree Sub-Merchant implementation for owner payouts
- Real-time messaging with WebSocket
- Email notifications for rental confirmations
- Calendar view for rental scheduling
- Review/rating system for owners and renters
