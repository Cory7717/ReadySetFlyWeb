# Integration Roadmap

## Stripe Payment Integration (Blueprint: blueprint:javascript_stripe)

### Required Secrets
- `VITE_STRIPE_PUBLIC_KEY` - Frontend publishable key (starts with `pk_`)
- `STRIPE_SECRET_KEY` - Backend secret key (starts with `sk_`)

### Integration Points

1. **Rental Transactions** (`client/src/pages/aircraft-detail.tsx`)
   - Add Stripe checkout flow when user clicks "Request to Book"
   - Create payment intent for rental amount + 7.5% platform fee
   - On successful payment, create rental record via `/api/rentals`

2. **Marketplace Listing Fees** (`client/src/pages/list-aircraft.tsx`, marketplace listing forms)
   - Monthly subscription for aircraft listings
   - One-time fees for marketplace categories ($25-$250/month based on tier)
   - Use `/api/create-subscription` endpoint from Stripe blueprint

3. **Owner Payouts** (`client/src/pages/dashboard.tsx`)
   - Implement Stripe Connect for owner payouts
   - Transfer funds after rental completion (minus 7.5% platform fee)
   - Show pending/completed deposits in dashboard

### Implementation Steps
1. Install Stripe package: Already installed (`stripe` in package.json)
2. Ask user for API keys using `ask_secrets` tool
3. Create `/api/create-payment-intent` route (see blueprint:javascript_stripe)
4. Add Stripe Elements to checkout flow
5. Handle payment confirmations and create rental records

## WebSocket Messaging Integration (Blueprint: blueprint:javascript_websocket)

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

### 🚧 In Progress
- Dashboard page needs backend connection
- Profile page needs backend connection
- Stripe payment flow (scaffolding documented above)
- WebSocket messaging (scaffolding documented above)

### 📝 Future Enhancements
- Full Stripe Connect implementation for owner payouts
- Real-time messaging with WebSocket
- Email notifications for rental confirmations
- Calendar view for rental scheduling
- Review/rating system for owners and renters
