import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import OpenAI from "openai";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { Client, Environment, LogLevel, OrdersController } from "@paypal/paypal-server-sdk";
import { storage } from "./storage";
import { insertAircraftListingSchema, insertMarketplaceListingSchema, insertRentalSchema, insertMessageSchema, insertReviewSchema, insertFavoriteSchema, insertExpenseSchema, insertJobApplicationSchema, insertPromoAlertSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { getUncachableResendClient } from "./resendClient";
import { sendContactFormEmail } from "./email-templates";
import registerMobileAuthRoutes from "./mobile-auth-routes";
import { registerUnifiedAuthRoutes } from "./unified-auth-routes";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { getUpgradeDelta, calculateTotalWithTax, isValidUpgrade, VALID_TIERS } from "@shared/config/listingPricing";

// Initialize OpenAI client with fallback to standard OpenAI if Replit integration vars are missing
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
// Prefer AI_INTEGRATIONS_OPENAI_BASE_URL if valid, otherwise OPENAI_BASE_URL, and only apply when it looks like a URL
const configuredBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
const openaiBaseUrl = configuredBaseUrl && configuredBaseUrl.startsWith("http") ? configuredBaseUrl : undefined;

if (configuredBaseUrl && !openaiBaseUrl) {
  console.warn("OpenAI base URL ignored because it is not a valid http(s) URL", configuredBaseUrl);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
});

// Initialize PayPal SDK
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error('Missing required PayPal secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET');
}

const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.PAYPAL_CLIENT_ID,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: process.env.NODE_ENV === "production" ? Environment.Production : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});

const ordersController = new OrdersController(paypalClient);

// Multer setup for file uploads with disk storage
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname.includes('image') || file.mimetype.startsWith('image/')) {
      cb(null, 'uploads/marketplace/');
    } else {
      cb(null, 'uploads/documents/');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  }
});

const upload = multer({ 
  storage: storage_config, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, and Word documents
    const allowedTypes = [
      'image/',
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type);
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and Word document files are allowed'));
    }
  }
});

// IP-based rate limiting middleware
interface RateLimitOptions {
  windowMs: number;
  max: number;
  dailyMax?: number;
  message?: string;
}

function createIpRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, dailyMax, message = "Too many requests, please try again later" } = options;
  const requests = new Map<string, number[]>();

  // Cleanup stale entries every 5 minutes to prevent memory growth
  setInterval(() => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    for (const [ip, timestamps] of requests.entries()) {
      const recentTimestamps = timestamps.filter(t => now - t < dayInMs);
      if (recentTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, recentTimestamps);
      }
    }
  }, 5 * 60 * 1000);

  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const timestamps = requests.get(ip)!;
    
    // Keep all timestamps within 24 hours for daily limit tracking
    const dailyTimestamps = timestamps.filter(t => now - t < dayInMs);
    
    // Check daily limit first if configured
    if (dailyMax && dailyTimestamps.length >= dailyMax) {
      const oldestDailyTimestamp = Math.min(...dailyTimestamps);
      const retryAfter = Math.ceil((dayInMs - (now - oldestDailyTimestamp)) / 1000);
      
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        error: "Daily request limit exceeded",
        retryAfter 
      });
    }
    
    // Check rolling window limit
    const recentTimestamps = dailyTimestamps.filter(t => now - t < windowMs);
    
    if (recentTimestamps.length >= max) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const retryAfter = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
      
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        error: message,
        retryAfter 
      });
    }
    
    // Record this request and update with all daily timestamps
    dailyTimestamps.push(now);
    requests.set(ip, dailyTimestamps);
    
    next();
  };
}

// Rate limiter for contact form: 5 requests per 10 minutes, 20 per day
const contactFormRateLimiter = createIpRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  dailyMax: 20,
  message: "Too many contact form submissions. Please try again later."
});

// Verification middleware - checks if user is verified
// CRITICAL: For rental-related endpoints (aircraft listings, rental bookings),
// verification is ALWAYS enforced for safety and security, regardless of any flags
const isVerified = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // ALWAYS enforce verification for rentals (aircraft listings and bookings)
    // This is a critical security requirement that cannot be disabled
    if (!user.isVerified) {
      return res.status(403).json({ 
        error: "Account verification required",
        message: "Aircraft rentals require verified users for safety and security. Please complete account verification."
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking verification:", error);
    res.status(500).json({ error: "Verification check failed" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware (from blueprint:javascript_log_in_with_replit)
  await setupAuth(app);

  // Unified authentication routes (for both web and mobile)
  app.use('/api/auth', registerUnifiedAuthRoutes(storage));

  // Mobile app authentication routes (JWT-based for React Native) - DEPRECATED, use /api/auth instead
  app.use('/api/mobile/auth', registerMobileAuthRoutes(storage));

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  // Object Storage Routes (for marketplace listing images)
  // Get upload URL for listing images
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ error: 'Failed to get upload URL' });
    }
  });

  // Set ACL policy for uploaded listing images
  app.put('/api/listing-images', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.body.imageURL) {
        return res.status(400).json({ error: 'imageURL is required' });
      }

      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageURL,
        {
          owner: userId,
          visibility: "public", // Listing images are public
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error('Error setting listing image ACL:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Serve objects with ACL check
  app.get('/objects/:objectPath(*)', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub; // May be undefined for unauthenticated requests
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(401);
      }
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Auth routes (from blueprint:javascript_log_in_with_replit)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const sessionUserId = req.user.claims.sub;
      console.log("[AUTH /api/auth/user] Looking up user with session ID:", sessionUserId);
      let user = await storage.getUser(sessionUserId);
      
      if (!user) {
        console.log("[AUTH /api/auth/user] User not found by ID, trying email lookup");
        // Try to find by email as fallback (for testing scenarios where sub may change)
        const email = req.user.claims.email;
        if (email) {
          user = await storage.getUserByEmail(email);
          console.log("[AUTH /api/auth/user] Email lookup result:", user ? `Found user ${user.id}` : "Not found");
        }
        
        if (!user) {
          console.log("[AUTH /api/auth/user] User not found by ID or email");
          return res.status(404).json({ message: "User not found" });
        }
      }
      
      // Grant Super Admin access to @readysetfly.us emails and coryarmer@gmail.com
      const email = user.email?.toLowerCase();
      const shouldBeSuperAdmin = 
        email?.endsWith('@readysetfly.us') || 
        email === 'coryarmer@gmail.com';
      
      // Update super admin status if needed - use the FOUND user's ID, not the session ID
      if (shouldBeSuperAdmin && !user.isSuperAdmin) {
        console.log("[AUTH /api/auth/user] Granting super admin to user:", user.id);
        await storage.updateUser(user.id, { isSuperAdmin: true, isAdmin: true, isVerified: true });
        user = await storage.getUser(user.id); // Refetch updated user
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Delete user account
  app.delete('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("[DELETE /api/auth/user] Deleting user account:", userId);
      
      const success = await storage.deleteUser(userId);
      
      if (success) {
        // Logout the user by destroying the session
        req.logout((err: any) => {
          if (err) {
            console.error("Error logging out after account deletion:", err);
          }
        });
        
        res.json({ message: "Account deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete account" });
      }
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Image upload endpoint for marketplace listings
  app.post("/api/upload-images", isAuthenticated, upload.array('images', 15), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      // Return URLs for uploaded files
      const imageUrls = files.map(file => `/uploads/marketplace/${file.filename}`);
      
      res.json({ imageUrls });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: error.message || "Image upload failed" });
    }
  });

  // Document upload endpoint for invoices and other documents
  app.post("/api/upload-documents", isAuthenticated, upload.array('documents', 5), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      // Return URLs for uploaded documents (saved in uploads/documents/)
      const documentUrls = files.map(file => `/uploads/documents/${file.filename}`);
      
      res.json({ documentUrls });
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: error.message || "Document upload failed" });
    }
  });

  // PayPal - Get Client ID for frontend SDK initialization
  app.get("/api/paypal/config", async (req, res) => {
    res.json({ 
      clientId: process.env.PAYPAL_CLIENT_ID,
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox"
    });
  });

  // PayPal - Create order for marketplace listing fees
  app.post("/api/paypal/create-order-listing", isAuthenticated, async (req: any, res) => {
    try {
      const { category, tier, promoCode, discountAmount, finalAmount } = req.body;
      const userId = req.user.claims.sub;
      
      if (!category) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Server-side pricing calculation - NEVER trust client
      // Category-specific pricing (base price before tax)
      const CATEGORY_PRICING: Record<string, Record<string, number> | number> = {
        'aircraft-sale': {
          basic: 25,
          standard: 40,
          premium: 100,
        },
        'charter': 250,
        'cfi': 30,
        'flight-school': 250,
        'mechanic': 40,
        'jobs': 40,
      };
      
      // Calculate base amount based on category and tier
      let baseAmount: number;
      const categoryPricing = CATEGORY_PRICING[category];
      
      if (typeof categoryPricing === 'object' && tier) {
        // Tier-based pricing (aircraft-sale)
        baseAmount = categoryPricing[tier] || categoryPricing.basic || 25;
      } else if (typeof categoryPricing === 'number') {
        // Fixed pricing for category
        baseAmount = categoryPricing;
      } else {
        // Fallback
        baseAmount = 25;
      }
      
      // Add 8.25% sales tax to base amount
      const salesTax = baseAmount * 0.0825;
      const fullAmount = baseAmount + salesTax;
      
      // If promo code applied, validate and use discounted amount
      let amount = fullAmount;
      if (promoCode && finalAmount !== undefined) {
        // Validate numeric input from client
        const parsedFinal = parseFloat(finalAmount);
        
        if (!Number.isFinite(parsedFinal) || parsedFinal < 0) {
          console.error(`Invalid final amount: ${finalAmount}`);
          return res.status(400).json({ error: "Invalid final amount" });
        }
        
        // Re-validate promo code server-side and get promo details
        const validatedPromo = await storage.validatePromoCodeForContext(promoCode, 'marketplace');
        
        if (!validatedPromo) {
          return res.status(400).json({ error: "Invalid or expired promo code" });
        }
        
        // Calculate discount SERVER-SIDE from validated promo details
        let serverCalculatedDiscount = 0;
        if (validatedPromo.discountType === 'percentage') {
          const discountPercent = parseFloat(validatedPromo.discountValue);
          serverCalculatedDiscount = (fullAmount * discountPercent) / 100;
        } else if (validatedPromo.discountType === 'fixed') {
          serverCalculatedDiscount = parseFloat(validatedPromo.discountValue);
        }
        
        // Clamp discount to not exceed full amount
        serverCalculatedDiscount = Math.min(serverCalculatedDiscount, fullAmount);
        
        // Calculate expected final amount from SERVER-CALCULATED discount
        const expectedFinal = Math.max(0, fullAmount - serverCalculatedDiscount);
        
        // Normalize to cents (integers) for precise comparison
        const expectedFinalCents = Math.round(expectedFinal * 100);
        const providedFinalCents = Math.round(parsedFinal * 100);
        
        // Verify client-provided finalAmount matches server calculation (exact match in cents)
        if (expectedFinalCents !== providedFinalCents) {
          console.error(`Amount mismatch: expected ${expectedFinal.toFixed(2)} ($${expectedFinalCents}¢), got ${parsedFinal.toFixed(2)} ($${providedFinalCents}¢)`);
          return res.status(400).json({ error: "Amount verification failed - promo discount mismatch" });
        }
        
        // Use server-calculated amount (normalized to 2 decimals)
        amount = expectedFinal;
      }
      
      // Normalize amount to 2 decimal places (prevents PayPal errors)
      amount = Math.round(amount * 100) / 100;
      
      // Ensure amount is never $0 (those should use free completion endpoint)
      if (amount <= 0) {
        return res.status(400).json({ error: "Use free completion endpoint for $0 orders" });
      }
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: amount.toFixed(2),
              },
              description: `Ready Set Fly - ${category} listing fee (${tier || 'basic'} tier)`,
              customId: `user:${userId}|category:${category}|tier:${tier || 'basic'}|purpose:marketplace_listing_fee`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // PayPal - Create order for marketplace listing upgrade
  app.post("/api/paypal/create-order-upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const { listingId, newTier } = req.body;
      const userId = req.user.claims.sub;
      
      if (!listingId || !newTier) {
        return res.status(400).json({ error: "Missing required fields: listingId and newTier" });
      }
      
      // Validate new tier
      if (!VALID_TIERS.includes(newTier as any)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      
      // Fetch the existing listing
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Verify ownership
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to upgrade this listing" });
      }
      
      // Validate upgrade (must be going up in tier)
      if (!isValidUpgrade(listing.tier || 'basic', newTier)) {
        return res.status(400).json({ error: "Invalid upgrade - must upgrade to a higher tier" });
      }
      
      // Calculate upgrade cost using shared pricing helper
      const upgradeDelta = getUpgradeDelta(listing.category, listing.tier || 'basic', newTier);
      const totalWithTax = calculateTotalWithTax(upgradeDelta);
      
      // Ensure amount is never $0
      if (totalWithTax <= 0) {
        return res.status(400).json({ error: "Upgrade amount must be greater than $0" });
      }
      
      // Normalize to 2 decimal places
      const amount = Math.round(totalWithTax * 100) / 100;
      
      console.log(`Creating upgrade order for listing ${listingId}: ${listing.tier} → ${newTier}, amount: $${amount}`);
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: amount.toFixed(2),
              },
              description: `Ready Set Fly - Listing Upgrade (${listing.tier} → ${newTier})`,
              customId: `upgrade:${listingId}|user:${userId}|tier:${newTier}`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create upgrade order error:", error);
      res.status(500).json({ error: error.message || "Failed to create upgrade order" });
    }
  });

  // PayPal - Create order for rental payments
  app.post("/api/paypal/create-order-rental", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const { amount, rentalId } = req.body;
      const userId = req.user.claims.sub;
      
      if (!amount || !rentalId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: parseFloat(amount).toFixed(2),
              },
              description: `Ready Set Fly - Aircraft rental payment`,
              customId: `rental:${rentalId}|user:${userId}`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create rental order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // PayPal - Create order for banner ad payments
  app.post("/api/paypal/create-order-banner-ad", async (req: any, res) => {
    try {
      const { orderId, promoCode } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ error: "Missing order ID" });
      }
      
      // Load the banner ad order to get pricing
      const order = await storage.getBannerAdOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Use original grandTotal as baseline (never mutate it)
      const originalAmount = parseFloat(order.grandTotal);
      let discountAmount = parseFloat(order.discountAmount || "0");
      let appliedPromoCode = order.promoCode || null;
      
      // Validate and apply promo code if provided (only if not already applied)
      if (promoCode && !order.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(promoCode, 'banner-ad');
        if (validPromo) {
          appliedPromoCode = validPromo.code;
          
          // Calculate discount from original amount
          if (validPromo.discountType === 'percentage') {
            discountAmount = originalAmount * (parseFloat(validPromo.discountValue) / 100);
          } else if (validPromo.discountType === 'fixed') {
            discountAmount = parseFloat(validPromo.discountValue);
          }
          
          // Persist promo code and discount (but NOT grandTotal - keep it as original)
          await storage.updateBannerAdOrder(orderId, {
            promoCode: validPromo.code,
            discountAmount: discountAmount.toFixed(2),
          });
          
          console.log(`Promo code ${promoCode} applied to order ${orderId}: -$${discountAmount.toFixed(2)}`);
        }
      }
      
      // Calculate final amount from original - discount (idempotent)
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      
      // For $0 orders (100% promo discount), generate a secure token for free completion
      if (finalAmount <= 0) {
        // Generate JWT token for secure free order completion
        const completionToken = jwt.sign(
          {
            orderId: orderId,
            sponsorEmail: order.sponsorEmail,
            type: 'free-order-completion',
          },
          process.env.SESSION_SECRET || 'dev-secret',
          { expiresIn: '15m' } // Token expires in 15 minutes
        );
        
        console.log(`✅ Generated free completion token for banner ad order ${orderId} (100% discount applied)`);
        
        return res.json({
          useFreeCompletion: true,
          completionToken,
          orderId,
          message: 'This order qualifies for free completion - no payment required'
        });
      }
      
      console.log(`Creating PayPal order for ${orderId}: original=$${originalAmount.toFixed(2)}, discount=$${discountAmount.toFixed(2)}, final=$${finalAmount.toFixed(2)}`);
      
      
      const collect = {
        body: {
          intent: "CAPTURE",
          purchaseUnits: [
            {
              amount: {
                currencyCode: "USD",
                value: finalAmount.toFixed(2),
              },
              description: `Ready Set Fly - Banner Ad: ${order.title}`,
              customId: `banner-ad:${orderId}|sponsor:${order.sponsorEmail}${appliedPromoCode ? `|promo:${appliedPromoCode}` : ''}`,
            },
          ],
        },
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.createOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal create banner ad order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // PayPal - Capture order payment (after user approval)
  app.post("/api/paypal/capture-order/:orderID", isAuthenticated, async (req: any, res) => {
    try {
      const { orderID } = req.params;
      
      const collect = {
        id: orderID,
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.captureOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal capture order error:", error);
      res.status(500).json({ error: error.message || "Failed to capture order" });
    }
  });

  // PayPal - Capture banner ad payment (public - no auth required)
  app.post("/api/paypal/capture-banner-ad/:orderID/:bannerAdOrderId", async (req, res) => {
    try {
      const { orderID, bannerAdOrderId } = req.params;
      
      // Capture the PayPal order
      const collect = {
        id: orderID,
        prefer: "return=minimal",
      };

      const { body, ...httpResponse } = await ordersController.captureOrder(collect);
      const jsonResponse = JSON.parse(String(body));
      
      // CRITICAL SECURITY: Verify the captured order matches the banner ad order
      if (jsonResponse.status === 'COMPLETED') {
        // Extract customId from purchase units
        const customId = jsonResponse.purchase_units?.[0]?.custom_id || '';
        
        // Parse customId format: "banner-ad:{orderId}|sponsor:{email}|promo:{code}"
        const orderIdMatch = customId.match(/banner-ad:([^|]+)/);
        const capturedOrderId = orderIdMatch ? orderIdMatch[1] : null;
        
        if (!capturedOrderId || capturedOrderId !== bannerAdOrderId) {
          console.error(`❌ Payment fraud attempt: PayPal order ${orderID} customId mismatch. Expected ${bannerAdOrderId}, got ${capturedOrderId}`);
          return res.status(400).json({ 
            error: "Payment validation failed",
            details: "Order ID mismatch - payment cannot be applied to this order" 
          });
        }
        
        // Extract promo code if present
        const promoMatch = customId.match(/promo:([^|]+)/);
        const promoCode = promoMatch ? promoMatch[1] : null;
        
        // Reload the banner ad order to verify it exists and is pending
        const order = await storage.getBannerAdOrder(bannerAdOrderId);
        if (!order) {
          console.error(`❌ Banner ad order ${bannerAdOrderId} not found during payment capture`);
          return res.status(404).json({ error: "Order not found" });
        }
        
        if (order.paymentStatus === 'paid') {
          console.warn(`⚠️ Banner ad order ${bannerAdOrderId} already marked as paid`);
          return res.status(400).json({ error: "Order already paid" });
        }
        
        // Record promo code usage if applied
        if (promoCode) {
          try {
            const promoCodeRecord = await storage.getPromoCodeByCode(promoCode);
            if (promoCodeRecord) {
              await storage.recordPromoCodeUsage({
                promoCodeId: promoCodeRecord.id,
                userId: null, // Public banner ad payment - no user ID
                bannerAdOrderId: bannerAdOrderId,
              });
              console.log(`✅ Promo code ${promoCode} usage recorded for banner ad order ${bannerAdOrderId}`);
            }
          } catch (error) {
            console.error(`⚠️ Failed to record promo code usage for ${promoCode}:`, error);
            // Don't fail the payment - just log the error
          }
        }
        
        // Update payment status
        await storage.updateBannerAdOrder(bannerAdOrderId, {
          paymentStatus: 'paid',
          paypalOrderId: orderID,
          paypalPaymentDate: new Date(),
        });
        
        console.log(`✅ Banner ad order ${bannerAdOrderId} payment captured: ${orderID}`);
      }
      
      res.status(httpResponse.statusCode).json(jsonResponse);
    } catch (error: any) {
      console.error("PayPal capture banner ad order error:", error);
      res.status(500).json({ error: error.message || "Failed to capture order" });
    }
  });

  // Complete FREE banner ad order (100% promo discount - no PayPal payment required)
  // SECURITY: Requires cryptographically signed token to prevent unauthorized completion
  app.post("/api/banner-ad/complete-free-order/:bannerAdOrderId", async (req, res) => {
    try {
      const { bannerAdOrderId } = req.params;
      const { completionToken } = req.body;
      
      // SECURITY: Validate completion token is provided
      if (!completionToken || typeof completionToken !== 'string') {
        console.error(`❌ Missing completion token for order ${bannerAdOrderId}`);
        return res.status(400).json({ error: "Security token is required" });
      }
      
      // SECURITY: Verify and decode the signed token
      let tokenData: any;
      try {
        tokenData = jwt.verify(completionToken, process.env.SESSION_SECRET || 'dev-secret');
      } catch (error: any) {
        console.error(`❌ Invalid or expired token for order ${bannerAdOrderId}:`, error.message);
        return res.status(403).json({ error: "Invalid or expired security token" });
      }
      
      // SECURITY: Verify token is for this specific order
      if (tokenData.orderId !== bannerAdOrderId) {
        console.error(`❌ Token/order ID mismatch for ${bannerAdOrderId}. Token says: ${tokenData.orderId}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // SECURITY: Verify token type is for free order completion
      if (tokenData.type !== 'free-order-completion') {
        console.error(`❌ Wrong token type for order ${bannerAdOrderId}: ${tokenData.type}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // Load the banner ad order
      const order = await storage.getBannerAdOrder(bannerAdOrderId);
      if (!order) {
        console.error(`❌ Banner ad order ${bannerAdOrderId} not found`);
        return res.status(404).json({ error: "Order not found" });
      }
      
      // SECURITY: Verify sponsor email from token matches order (belt-and-suspenders)
      if (order.sponsorEmail.toLowerCase() !== tokenData.sponsorEmail.toLowerCase()) {
        console.error(`❌ Token email mismatch for order ${bannerAdOrderId}. Expected ${order.sponsorEmail}, token says ${tokenData.sponsorEmail}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // Verify order hasn't been paid yet
      if (order.paymentStatus === 'paid') {
        console.warn(`⚠️ Banner ad order ${bannerAdOrderId} already marked as paid`);
        return res.status(400).json({ error: "Order already paid" });
      }
      
      // Calculate final amount (must be $0 for free orders)
      const originalAmount = parseFloat(order.grandTotal);
      const discountAmount = parseFloat(order.discountAmount || "0");
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      
      // CRITICAL: Verify this is actually a free order
      if (finalAmount > 0) {
        console.error(`❌ Free order validation failed for ${bannerAdOrderId}: final amount is $${finalAmount.toFixed(2)}, not $0.00`);
        return res.status(400).json({ 
          error: "This is not a free order",
          details: `Order total is $${finalAmount.toFixed(2)}. Payment is required.`
        });
      }
      
      // SECURITY: Re-validate promo code is still active and valid
      if (order.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(order.promoCode, 'banner-ad');
        if (!validPromo) {
          console.error(`❌ Promo code ${order.promoCode} is no longer valid for order ${bannerAdOrderId}`);
          return res.status(400).json({ 
            error: "Promo code is no longer valid",
            details: "Please refresh the page and try again"
          });
        }
        
        // Record promo code usage
        try {
          const promoCodeRecord = await storage.getPromoCodeByCode(order.promoCode);
          if (promoCodeRecord) {
            await storage.recordPromoCodeUsage({
              promoCodeId: promoCodeRecord.id,
              userId: null, // Public banner ad payment - no user ID
              bannerAdOrderId: bannerAdOrderId,
            });
            console.log(`✅ Promo code ${order.promoCode} usage recorded for FREE banner ad order ${bannerAdOrderId}`);
          }
        } catch (error) {
          console.error(`⚠️ Failed to record promo code usage for ${order.promoCode}:`, error);
          // Don't fail the order completion - just log the error
        }
      }
      
      // Mark order as paid (even though $0) and set to pending review
      await storage.updateBannerAdOrder(bannerAdOrderId, {
        paymentStatus: 'paid',
        approvalStatus: 'pending_review',
        paypalOrderId: 'FREE-' + bannerAdOrderId, // Mark as free order
        paypalPaymentDate: new Date(),
      });
      
      console.log(`✅ FREE banner ad order ${bannerAdOrderId} completed with promo code ${order.promoCode} by ${order.sponsorEmail}`);
      
      res.json({ 
        status: 'COMPLETED',
        message: 'Free order completed successfully',
        orderId: bannerAdOrderId
      });
    } catch (error: any) {
      console.error("Free banner ad order completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete free order" });
    }
  });

  // Complete FREE marketplace listing (100% promo discount - no PayPal payment required)
  // SECURITY: Requires cryptographically signed token to prevent unauthorized completion
  app.post("/api/marketplace/complete-free-listing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { completionToken, listingData } = req.body;
      
      // SECURITY: Validate completion token is provided
      if (!completionToken || typeof completionToken !== 'string') {
        console.error(`❌ Missing completion token for free marketplace listing`);
        return res.status(400).json({ error: "Security token is required" });
      }
      
      // SECURITY: Verify and decode the signed token
      let tokenData: any;
      try {
        tokenData = jwt.verify(completionToken, process.env.SESSION_SECRET || 'dev-secret');
      } catch (error: any) {
        console.error(`❌ Invalid or expired token for free marketplace listing:`, error.message);
        return res.status(403).json({ error: "Invalid or expired security token" });
      }
      
      // SECURITY: Verify token type is for free order completion
      if (tokenData.type !== 'free-marketplace-listing') {
        console.error(`❌ Wrong token type for free marketplace listing: ${tokenData.type}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // SECURITY: Verify user ID from token matches authenticated user
      if (tokenData.userId !== userId) {
        console.error(`❌ Token user ID mismatch. Expected ${userId}, token says ${tokenData.userId}`);
        return res.status(403).json({ error: "Invalid security token" });
      }
      
      // Calculate final amount (must be $0 for free orders)
      const originalAmount = parseFloat(tokenData.originalAmount);
      const discountAmount = parseFloat(tokenData.discountAmount);
      const finalAmount = Math.max(0, originalAmount - discountAmount);
      
      // CRITICAL: Verify this is actually a free order
      if (finalAmount > 0) {
        console.error(`❌ Free listing validation failed: final amount is $${finalAmount.toFixed(2)}, not $0.00`);
        return res.status(400).json({ 
          error: "This is not a free listing",
          details: `Listing total is $${finalAmount.toFixed(2)}. Payment is required.`
        });
      }
      
      // SECURITY: Re-validate promo code is still active and valid
      if (tokenData.promoCode) {
        const validPromo = await storage.validatePromoCodeForContext(tokenData.promoCode, 'marketplace');
        if (!validPromo) {
          console.error(`❌ Promo code ${tokenData.promoCode} is no longer valid for marketplace listing`);
          return res.status(400).json({ 
            error: "Promo code is no longer valid",
            details: "Please refresh the page and try again"
          });
        }
        
        // Validate the base listing data
        const validatedData = insertMarketplaceListingSchema.parse({ 
          ...listingData, 
          userId,
          monthlyFee: "0",
        });
        
        // Create listing with free promo benefits
        const listing = await storage.createMarketplaceListing({
          ...validatedData,
          isPaid: true, // Mark as paid since it's free with promo
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        
        // Record promo code usage
        try {
          await storage.recordPromoCodeUsage({
            promoCodeCode: tokenData.promoCode,
            userId: userId,
            marketplaceListingId: listing.id,
            discountAmount: discountAmount.toString(),
          });
          console.log(`✅ Promo code ${tokenData.promoCode} usage recorded for FREE marketplace listing ${listing.id}`);
        } catch (error) {
          console.error(`⚠️ Failed to record promo code usage for ${tokenData.promoCode}:`, error);
          // Don't fail the listing creation - just log the error
        }
        
        // Create threshold notification if needed
        try {
          const categoryListings = await storage.getMarketplaceListingsByCategory(listing.category);
          const activeCount = categoryListings.filter((l: any) => l.isActive).length;
          
          if (activeCount === 25 || activeCount === 30) {
            await storage.createAdminNotification({
              type: "listing_threshold",
              category: listing.category,
              title: `${listing.category.replace('-', ' ').toUpperCase()} Listings Threshold Reached`,
              message: `The ${listing.category.replace('-', ' ')} category now has ${activeCount} active listings.`,
              isRead: false,
              isActionable: true,
              listingCount: activeCount,
              threshold: activeCount,
            });
          }
        } catch (notifError) {
          console.error("Failed to create threshold notification:", notifError);
        }
        
        console.log(`✅ FREE marketplace listing ${listing.id} completed with promo code ${tokenData.promoCode} by user ${userId}`);
        
        res.status(201).json({ 
          status: 'COMPLETED',
          message: 'Free listing created successfully',
          listing
        });
      } else {
        return res.status(400).json({ error: "No promo code provided for free listing" });
      }
    } catch (error: any) {
      console.error("Free marketplace listing completion error:", error);
      res.status(500).json({ error: error.message || "Failed to complete free listing" });
    }
  });

  // Mobile PayPal Payment Page - Rental Payments
  app.get("/mobile-paypal-rental-payment", (req, res) => {
    const { amount, rentalId } = req.query;
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .loading { text-align: center; color: #6b7280; padding: 20px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal</p>
    </div>
    
    <div class="card">
      <div class="amount">$${amount}</div>
      
      <div id="error-message"></div>
      
      <div class="field">
        <label>Cardholder Name</label>
        <div id="card-name-field" class="field-container"></div>
      </div>
      
      <div class="field">
        <label>Card Number</label>
        <div id="card-number-field" class="field-container"></div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label>Expiry Date</label>
          <div id="card-expiry-field" class="field-container"></div>
        </div>
        <div class="field">
          <label>CVV</label>
          <div id="card-cvv-field" class="field-container"></div>
        </div>
      </div>
      
      <button id="pay-button" class="btn" disabled>Loading...</button>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    
    const cardFields = paypal.CardFields({
      createOrder: async () => {
        const response = await fetch('/api/paypal/create-order-rental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            amount: '${amount}',
            rentalId: '${rentalId}'
          })
        });
        const order = await response.json();
        return order.id;
      },
      onApprove: async (data) => {
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/paypal/capture-order/' + data.orderID, {
            method: 'POST',
            credentials: 'include'
          });
          const result = await response.json();
          
          if (result.status === 'COMPLETED') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              orderID: data.orderID
            }));
          } else {
            throw new Error('Payment not completed');
          }
        } catch (error) {
          errorDiv.innerHTML = '<div class="error">Payment failed. Please try again.</div>';
          button.disabled = false;
          button.textContent = 'Pay $${amount}';
        }
      },
      onError: (error) => {
        console.error('PayPal error:', error);
        errorDiv.innerHTML = '<div class="error">Payment error. Please check your card details.</div>';
      }
    });

    if (cardFields.isEligible()) {
      cardFields.NameField().render('#card-name-field');
      cardFields.NumberField().render('#card-number-field');
      cardFields.ExpiryField().render('#card-expiry-field');
      cardFields.CVVField().render('#card-cvv-field');
      
      button.disabled = false;
      button.textContent = 'Pay $${amount}';
      
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Processing...';
        await cardFields.submit();
      });
    } else {
      errorDiv.innerHTML = '<div class="error">Card payments are not available.</div>';
    }
  </script>
</body>
</html>
    `);
  });

  // Mobile PayPal Payment Page - Marketplace Listings
  app.get("/mobile-paypal-marketplace-payment", (req, res) => {
    const { amount, category, tier } = req.query;
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .loading { text-align: center; color: #6b7280; padding: 20px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal</p>
    </div>
    
    <div class="card">
      <div class="amount">$${amount}</div>
      
      <div id="error-message"></div>
      
      <div class="field">
        <label>Cardholder Name</label>
        <div id="card-name-field" class="field-container"></div>
      </div>
      
      <div class="field">
        <label>Card Number</label>
        <div id="card-number-field" class="field-container"></div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label>Expiry Date</label>
          <div id="card-expiry-field" class="field-container"></div>
        </div>
        <div class="field">
          <label>CVV</label>
          <div id="card-cvv-field" class="field-container"></div>
        </div>
      </div>
      
      <button id="pay-button" class="btn" disabled>Loading...</button>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    
    const cardFields = paypal.CardFields({
      createOrder: async () => {
        const response = await fetch('/api/paypal/create-order-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            category: '${category}',
            tier: '${tier}'
          })
        });
        const order = await response.json();
        return order.id;
      },
      onApprove: async (data) => {
        button.disabled = true;
        button.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/paypal/capture-order/' + data.orderID, {
            method: 'POST',
            credentials: 'include'
          });
          const result = await response.json();
          
          if (result.status === 'COMPLETED') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              orderID: data.orderID
            }));
          } else {
            throw new Error('Payment not completed');
          }
        } catch (error) {
          errorDiv.innerHTML = '<div class="error">Payment failed. Please try again.</div>';
          button.disabled = false;
          button.textContent = 'Pay $${amount}';
        }
      },
      onError: (error) => {
        console.error('PayPal error:', error);
        errorDiv.innerHTML = '<div class="error">Payment error. Please check your card details.</div>';
      }
    });

    if (cardFields.isEligible()) {
      cardFields.NameField().render('#card-name-field');
      cardFields.NumberField().render('#card-number-field');
      cardFields.ExpiryField().render('#card-expiry-field');
      cardFields.CVVField().render('#card-cvv-field');
      
      button.disabled = false;
      button.textContent = 'Pay $${amount}';
      
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Processing...';
        await cardFields.submit();
      });
    } else {
      errorDiv.innerHTML = '<div class="error">Card payments are not available.</div>';
    }
  </script>
</body>
</html>
    `);
  });

  // Banner Ad Payment Page - Public (no auth required)
  app.get("/banner-ad-payment", async (req, res) => {
    const { orderId } = req.query;
    
    if (!orderId) {
      return res.status(400).send("Order ID is required");
    }
    
    // Load order to get amount and details
    const order = await storage.getBannerAdOrder(orderId as string);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    
    const amount = order.grandTotal;
    const title = order.title;
    const sponsorEmail = order.sponsorEmail;
    
    // Calculate final amount after discount
    const originalAmount = parseFloat(order.grandTotal);
    const discountAmount = parseFloat(order.discountAmount || "0");
    const finalAmount = Math.max(0, originalAmount - discountAmount);
    const isFreeOrder = finalAmount === 0;
    
    // Generate signed completion token for free orders
    let completionToken = null;
    if (isFreeOrder) {
      completionToken = jwt.sign(
        {
          type: 'free-order-completion',
          orderId: orderId,
          sponsorEmail: sponsorEmail,
        },
        process.env.SESSION_SECRET || 'dev-secret',
        { expiresIn: '15m' } // Token expires in 15 minutes
      );
      console.log(`Generated free order completion token for ${orderId}`);
    }
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Banner Ad Payment - Ready Set Fly</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f9fafb; }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
    .header p { color: #6b7280; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .order-info { background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .order-info h3 { font-size: 14px; color: #6b7280; margin-bottom: 6px; }
    .order-info p { font-size: 16px; color: #111827; font-weight: 500; }
    .amount { text-align: center; font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
    .field-container { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 44px; background: #fff; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn { width: 100%; padding: 14px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .btn-secondary { background: #6b7280; }
    .btn-secondary:hover { background: #4b5563; }
    .success { background: #d1fae5; color: #047857; padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; }
    .info { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .error { color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .promo-section { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
    .promo-input-group { display: flex; gap: 8px; margin-bottom: 8px; }
    .promo-input { flex: 1; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .promo-btn { padding: 12px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .promo-btn:hover { background: #4b5563; }
    .promo-btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .discount-info { background: #d1fae5; color: #047857; padding: 12px; border-radius: 8px; font-size: 14px; margin-top: 8px; }
    .amount-breakdown { font-size: 14px; color: #6b7280; margin-top: 8px; }
    .amount-breakdown .line { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .amount-breakdown .total { font-weight: bold; color: #111827; padding-top: 8px; border-top: 1px solid #e5e7eb; margin-top: 8px; }
  </style>
  <script src="https://www.paypal.com/sdk/js?client-id=${process.env.PAYPAL_CLIENT_ID}&components=card-fields&disable-funding=paylater"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Complete Payment</h1>
      <p>Secure payment powered by PayPal</p>
    </div>
    
    <div class="card">
      <div class="order-info">
        <h3>Banner Ad Campaign</h3>
        <p>${title}</p>
      </div>
      
      <div class="promo-section">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #374151;">Have a promo code?</label>
        <div class="promo-input-group">
          <input 
            type="text" 
            id="promo-code-input" 
            class="promo-input" 
            placeholder="Enter promo code"
            style="text-transform: uppercase;"
          />
          <button id="apply-promo-btn" class="promo-btn">Apply</button>
        </div>
        <div id="promo-message"></div>
      </div>
      
      <div id="amount-display">
        <div class="amount">$${amount}</div>
      </div>
      
      <div id="success-message"></div>
      <div id="error-message"></div>
      
      <div id="payment-fields">
        <div class="field">
          <label>Cardholder Name</label>
          <div id="card-name-field" class="field-container"></div>
        </div>
        
        <div class="field">
          <label>Card Number</label>
          <div id="card-number-field" class="field-container"></div>
        </div>
        
        <div class="field-row">
          <div class="field">
            <label>Expiry Date</label>
            <div id="card-expiry-field" class="field-container"></div>
          </div>
          <div class="field">
            <label>CVV</label>
            <div id="card-cvv-field" class="field-container"></div>
          </div>
        </div>
        
        <button id="pay-button" class="btn" disabled>Loading...</button>
      </div>
    </div>
  </div>

  <script>
    const button = document.getElementById('pay-button');
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    const paymentFields = document.getElementById('payment-fields');
    const promoInput = document.getElementById('promo-code-input');
    const applyPromoBtn = document.getElementById('apply-promo-btn');
    const promoMessage = document.getElementById('promo-message');
    const amountDisplay = document.getElementById('amount-display');
    
    // Pricing state
    let originalAmount = ${amount};
    let currentAmount = ${amount};
    let appliedPromoCode = null;
    
    // Free order state
    const isFreeOrder = ${isFreeOrder};
    const finalAmount = ${finalAmount};
    const completionToken = '${completionToken || ''}';
    
    // Payment processing state management (30-second timeout)
    let processingTimeout = null;
    
    function startProcessing() {
      button.disabled = true;
      button.textContent = 'Processing...';
      errorDiv.innerHTML = '';
      
      // Set 30-second timeout
      processingTimeout = setTimeout(() => {
        resetProcessing('Payment timed out after 30 seconds. Please try again or contact support@readysetfly.us');
      }, 30000);
    }
    
    function resetProcessing(errorMessage = null) {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
      }
      button.disabled = false;
      button.textContent = 'Pay $' + currentAmount.toFixed(2);
      
      if (errorMessage) {
        errorDiv.innerHTML = '<div class="error">' + errorMessage + '</div>';
      }
    }
    
    // Promo code validation
    applyPromoBtn.addEventListener('click', async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) {
        promoMessage.innerHTML = '<div class="error">Please enter a promo code</div>';
        return;
      }
      
      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = 'Validating...';
      promoMessage.innerHTML = '';
      
      try {
        const response = await fetch('/api/promo-codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, context: 'banner-ad' })
        });
        const result = await response.json();
        
        if (result.valid) {
          appliedPromoCode = result;
          
          // Calculate discount
          let discount = 0;
          if (result.discountType === 'percentage') {
            discount = originalAmount * (result.discountValue / 100);
          } else if (result.discountType === 'fixed') {
            discount = result.discountValue;
          }
          
          currentAmount = Math.max(0, originalAmount - discount);
          
          // Update display with breakdown
          amountDisplay.innerHTML = \`
            <div class="amount-breakdown">
              <div class="line">
                <span>Subtotal:</span>
                <span>$\${originalAmount.toFixed(2)}</span>
              </div>
              <div class="line" style="color: #047857;">
                <span>Discount (\${result.code}):</span>
                <span>-$\${discount.toFixed(2)}</span>
              </div>
              <div class="line total">
                <span>Total:</span>
                <span style="font-size: 24px; color: #1e40af;">$\${currentAmount.toFixed(2)}</span>
              </div>
            </div>
          \`;
          
          promoMessage.innerHTML = \`<div class="discount-info">\${result.description}</div>\`;
          promoInput.disabled = true;
          applyPromoBtn.textContent = 'Applied';
          
          // Update button text with new amount
          if (button.textContent.includes('Pay')) {
            button.textContent = 'Pay $' + currentAmount.toFixed(2);
          }
        } else {
          promoMessage.innerHTML = \`<div class="error">\${result.message || 'Invalid promo code'}</div>\`;
          applyPromoBtn.disabled = false;
          applyPromoBtn.textContent = 'Apply';
        }
      } catch (error) {
        console.error('Promo code validation error:', error);
        promoMessage.innerHTML = '<div class="error">Failed to validate promo code</div>';
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = 'Apply';
      }
    });
    
    // Handle FREE orders differently (no PayPal payment required)
    if (isFreeOrder) {
      // Show claim button instead of card fields
      paymentFields.innerHTML = \`
        <div class="info">Your total is $0.00 after applying the promo code!</div>
        <button id="claim-button" class="btn" data-testid="button-claim-free-order">Claim Free Banner Ad</button>
      \`;
      
      // Add click handler for free order claim
      const claimButton = document.getElementById('claim-button');
      claimButton.addEventListener('click', async () => {
        startProcessing();
        claimButton.textContent = 'Processing...';
        
        try {
          const response = await fetch('/api/banner-ad/complete-free-order/${orderId}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completionToken })
          });
          
          const result = await response.json();
          
          if (response.ok) {
            // Clear timeout - success
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
            
            paymentFields.style.display = 'none';
            successDiv.innerHTML = '<div class="success"><h3>Order Claimed Successfully!</h3><p>Your free banner ad order has been confirmed. It will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
            
            setTimeout(() => {
              window.location.href = '/';
            }, 5000);
          } else {
            resetProcessing(result.error || 'Failed to claim free order. Please contact support@readysetfly.us');
          }
        } catch (error) {
          console.error('Free order claim error:', error);
          resetProcessing('Failed to claim free order. Please try again or contact support@readysetfly.us');
        }
      });
    } else {
      // Standard PayPal payment flow for non-free orders
      const cardFields = paypal.CardFields({
        createOrder: async () => {
          const requestBody = {
            orderId: '${orderId}'
          };
          
          // Include promo code if applied
          if (appliedPromoCode) {
            requestBody.promoCode = appliedPromoCode.code;
          }
          
          const response = await fetch('/api/paypal/create-order-banner-ad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          const order = await response.json();
          
          // Check if backend says this is now a free order (100% discount applied)
          if (order.useFreeCompletion) {
            // Clear timeout
            if (processingTimeout) {
              clearTimeout(processingTimeout);
              processingTimeout = null;
            }
            
            // Complete the free order immediately
            const completeResponse = await fetch('/api/banner-ad/complete-free-order/${orderId}', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                completionToken: order.completionToken 
              })
            });
            
            const result = await completeResponse.json();
            
            if (completeResponse.ok) {
              paymentFields.style.display = 'none';
              successDiv.innerHTML = '<div class="success"><h3>Order Claimed Successfully!</h3><p>Your free banner ad order has been confirmed. It will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
              
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
              
              // Throw to stop PayPal flow
              throw new Error('FREE_ORDER_COMPLETED');
            } else {
              throw new Error(result.error || 'Failed to complete free order');
            }
          }
          
          if (!order.id) {
            throw new Error(order.error || 'Failed to create payment');
          }
          return order.id;
        },
        onApprove: async (data) => {
          // Clear timeout - payment approved
          if (processingTimeout) {
            clearTimeout(processingTimeout);
            processingTimeout = null;
          }
          
          button.disabled = true;
          button.textContent = 'Processing...';
          
          try {
            // Capture the payment
            const response = await fetch('/api/paypal/capture-banner-ad/' + data.orderID + '/${orderId}', {
              method: 'POST'
            });
            const result = await response.json();
            
            if (result.status === 'COMPLETED') {
              paymentFields.style.display = 'none';
              successDiv.innerHTML = '<div class="success"><h3>Payment Successful!</h3><p>Thank you for your payment. Your banner ad order will be reviewed and activated within 1 business day. We will contact you at ${sponsorEmail}.</p></div>';
              
              setTimeout(() => {
                window.location.href = '/';
              }, 5000);
            } else {
              throw new Error('Payment not completed');
            }
          } catch (error) {
            console.error('Payment capture error:', error);
            resetProcessing('Payment capture failed. Please contact support@readysetfly.us with order ID: ${orderId}');
          }
        },
        onError: (error) => {
          console.error('PayPal error:', error);
          resetProcessing('Payment error. Please check your card details and try again.');
        }
      });

      if (cardFields.isEligible()) {
        cardFields.NameField().render('#card-name-field');
        cardFields.NumberField().render('#card-number-field');
        cardFields.ExpiryField().render('#card-expiry-field');
        cardFields.CVVField().render('#card-cvv-field');
        
        button.disabled = false;
        button.textContent = 'Pay $${amount}';
        
        button.addEventListener('click', async () => {
          startProcessing();
          
          try {
            await cardFields.submit();
          } catch (error) {
            console.error('Card field submission error:', error);
            resetProcessing('Payment submission failed. Please check your card details and try again.');
          }
        });
      } else {
        errorDiv.innerHTML = '<div class="error">Card payments are not available. Please contact support@readysetfly.us.</div>';
      }
    }
  </script>
</body>
</html>
    `);
  });

  // Contact Form - Public (no auth required)
  app.post("/api/contact", contactFormRateLimiter, async (req, res) => {
    try {
      // Server-side validation using Zod schema
      const contactFormSchema = z.object({
        firstName: z.string().min(1, "First name is required").max(100),
        lastName: z.string().min(1, "Last name is required").max(100),
        email: z.string().email("Valid email is required").max(255),
        subject: z.string().min(1, "Subject is required").max(200),
        message: z.string().min(10, "Message must be at least 10 characters").max(2000),
      });
      
      const validationResult = contactFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid form data", 
          details: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Persist submission to database BEFORE sending email (audit trail)
      const submission = await storage.createContactSubmission({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: data.subject,
        message: data.message,
        ipAddress: ip,
        emailSent: false,
        emailSentAt: null,
      });
      
      console.log(`Contact form submission persisted: ${submission.id} from ${data.email}`);
      
      // Send email asynchronously (non-blocking)
      sendContactFormEmail(data)
        .then(async () => {
          // Update email status on success
          await storage.updateContactSubmissionEmailStatus(submission.id, true);
          console.log(`Email sent successfully for submission ${submission.id}`);
        })
        .catch((error) => {
          // Log error but don't block response - submission is already persisted
          console.error(`Failed to send email for submission ${submission.id}:`, error);
        });
      
      // Respond immediately after persisting (don't wait for email)
      res.json({ success: true });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ error: "Failed to process contact form submission" });
    }
  });

  // Cron endpoint: Send expiration reminders for banner ads and marketplace listings
  // SECURITY: Requires CRON_SECRET header to prevent unauthorized access
  app.post("/api/cron/send-expiration-reminders", async (req, res) => {
    try {
      // Verify cron secret token
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET; // Fallback to SESSION_SECRET if CRON_SECRET not set
      
      if (!cronSecret || cronSecret !== expectedSecret) {
        console.warn('Unauthorized cron attempt from IP:', req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const {  getBannerAdExpirationReminderHtml, getBannerAdExpirationReminderText, getMarketplaceListingExpirationReminderHtml, getMarketplaceListingExpirationReminderText } = await import('./email-templates');
      const { client, fromEmail } = await getUncachableResendClient();
      
      let bannersProcessed = 0;
      let listingsProcessed = 0;
      let errors: string[] = [];
      
      // Find banner ads expiring soon (configurable lead time, default 3 days)
      const leadDays = Number(process.env.EXPIRATION_REMINDER_DAYS ?? 3);
      const expiringBanners = await storage.getExpiringBannerAdOrders(leadDays);
      
      // Find marketplace listings expiring soon with same lead time
      const expiringListings = await storage.getExpiringMarketplaceListings(leadDays);
      
      // Send banner ad expiration reminders
      for (const banner of expiringBanners) {
        try {
          const htmlBody = getBannerAdExpirationReminderHtml(banner.sponsorName, {
            title: banner.title,
            company: banner.sponsorCompany || banner.sponsorName,
            tier: banner.tier,
            endDate: banner.endDate?.toISOString() || new Date().toISOString(),
            startDate: banner.startDate?.toISOString() || new Date().toISOString(),
          });
          
          const textBody = getBannerAdExpirationReminderText(banner.sponsorName, {
            title: banner.title,
            company: banner.sponsorCompany || banner.sponsorName,
            tier: banner.tier,
            endDate: banner.endDate?.toISOString() || new Date().toISOString(),
            startDate: banner.startDate?.toISOString() || new Date().toISOString(),
            leadDays,
          });
          
          await client.emails.send({
            from: fromEmail,
            to: banner.sponsorEmail,
            subject: `Action Required: Your Ready Set Fly banner campaign ends in ${leadDays} days`,
            html: htmlBody,
            text: textBody,
          });
          
          // Mark reminder as sent
          await storage.updateBannerAdOrder(banner.id, {
            expirationReminderSent: true,
            expirationReminderSentAt: new Date(),
          });
          
          bannersProcessed++;
          console.log(`Sent expiration reminder for banner ad order ${banner.id} to ${banner.sponsorEmail}`);
        } catch (error: any) {
          console.error(`Failed to send reminder for banner ad ${banner.id}:`, error);
          errors.push(`Banner ${banner.id}: ${error.message}`);
        }
      }
      
      // Send marketplace listing expiration reminders
      for (const listing of expiringListings) {
        try {
          // Get user details
          const user = await storage.getUser(listing.userId);
          if (!user || !user.email) {
            console.warn(`Skipping listing ${listing.id} - user not found or no email`);
            continue;
          }
          
          const userName = user.firstName || user.email.split('@')[0];
          
          const htmlBody = getMarketplaceListingExpirationReminderHtml(userName, {
            id: listing.id,
            title: listing.title,
            category: listing.category,
            tier: listing.tier || 'basic',
            expiresAt: listing.expiresAt?.toISOString() || new Date().toISOString(),
          });
          
          const textBody = getMarketplaceListingExpirationReminderText(userName, {
            id: listing.id,
            title: listing.title,
            category: listing.category,
            tier: listing.tier || 'basic',
            expiresAt: listing.expiresAt?.toISOString() || new Date().toISOString(),
            leadDays,
          });
          
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Renew your ${listing.category} listing – ${leadDays} days left on Ready Set Fly`,
            html: htmlBody,
            text: textBody,
          });
          
          // Mark reminder as sent
          await storage.updateMarketplaceListing(listing.id, {
            expirationReminderSent: true,
            expirationReminderSentAt: new Date(),
          });
          
          listingsProcessed++;
          console.log(`Sent expiration reminder for marketplace listing ${listing.id} to ${user.email}`);
        } catch (error: any) {
          console.error(`Failed to send reminder for listing ${listing.id}:`, error);
          errors.push(`Listing ${listing.id}: ${error.message}`);
        }
      }
      
      res.json({
        success: true,
        bannersProcessed,
        listingsProcessed,
        totalReminders: bannersProcessed + listingsProcessed,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Cron job error:', error);
      res.status(500).json({ 
        error: "Failed to send expiration reminders",
        details: error.message 
      });
    }
  });

  // AI Description Generation endpoint
  app.post("/api/generate-description", isAuthenticated, async (req, res) => {
    try {
      const { listingType, details } = req.body;

      if (!openaiApiKey) {
        return res.status(503).json({ error: "AI service unavailable", details: "Missing OpenAI API key" });
      }
      
      if (!listingType || !details) {
        return res.status(400).json({ error: "Missing required fields: listingType and details" });
      }

      let systemPrompt = "";
      let userPrompt = "";

      // Customize prompts based on listing type
      switch (listingType) {
        case "aircraft-rental":
          systemPrompt = "You are an expert aviation copywriter specializing in aircraft rental listings. Create compelling, professional descriptions that highlight aircraft capabilities, features, and benefits for potential renters.";
          userPrompt = `Create a detailed, professional description for this aircraft rental listing:\n\nMake: ${details.make}\nModel: ${details.model}\nYear: ${details.year}\nCategory: ${details.category}\n${details.engine ? `Engine: ${details.engine}\n` : ''}${details.avionics ? `Avionics: ${details.avionics}\n` : ''}${details.totalTime ? `Total Time: ${details.totalTime} hours\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}\n\nWrite a compelling 150-250 word description that emphasizes the aircraft's features, capabilities, and what makes it ideal for renters. Use professional aviation terminology but keep it accessible. Focus on practical benefits and highlight any special features or recent upgrades.`;
          break;

        case "aircraft-sale":
          systemPrompt = "You are an expert aviation sales copywriter. Create persuasive descriptions for aircraft for sale that emphasize value, condition, and investment potential.";
          userPrompt = `Create a detailed sales description for this aircraft:\n\n${details.title}\n${details.price ? `Price: $${details.price}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}\n\nWrite a compelling 150-250 word sales description that highlights the aircraft's value, condition, features, and investment potential. Emphasize what makes this aircraft stand out in the market.`;
          break;

        case "aviation-job":
          systemPrompt = "You are an expert in aviation recruitment. Create engaging job descriptions that attract qualified pilots and aviation professionals.";
          userPrompt = `Create a professional job description for this aviation position:\n\nTitle: ${details.title}\n${details.company ? `Company: ${details.company}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}${details.salary ? `Salary: ${details.salary}\n` : ''}\n\nWrite an engaging 150-250 word job description that outlines responsibilities, requirements, and benefits. Make it appealing to qualified aviation professionals.`;
          break;

        case "cfi-listing":
          systemPrompt = "You are an aviation education expert. Create descriptions for Certified Flight Instructor (CFI) listings that highlight expertise and teaching capabilities.";
          userPrompt = `Create a professional description for this CFI listing:\n\nTitle: ${details.title}\n${details.certifications ? `Certifications: ${details.certifications}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}${details.experience ? `Experience: ${details.experience}\n` : ''}\n\nWrite a 150-250 word description showcasing the instructor's qualifications, teaching style, and what students can expect. Emphasize expertise and approachability.`;
          break;

        case "flight-school":
          systemPrompt = "You are an aviation education marketing expert. Create compelling descriptions for flight schools that attract aspiring pilots.";
          userPrompt = `Create a professional description for this flight school:\n\nName: ${details.title}\n${details.location ? `Location: ${details.location}\n` : ''}${details.programs ? `Programs: ${details.programs}\n` : ''}\n\nWrite a 150-250 word description that highlights the school's programs, instructors, aircraft, and unique advantages. Make it inspiring for aspiring pilots.`;
          break;

        case "mechanic":
          systemPrompt = "You are an aviation maintenance expert. Create professional descriptions for aircraft mechanic services that inspire confidence.";
          userPrompt = `Create a professional description for this aircraft mechanic service:\n\nTitle: ${details.title}\n${details.certifications ? `Certifications: ${details.certifications}\n` : ''}${details.location ? `Location: ${details.location}\n` : ''}${details.specialties ? `Specialties: ${details.specialties}\n` : ''}\n\nWrite a 150-250 word description that emphasizes expertise, certifications, services offered, and commitment to safety and quality.`;
          break;

        case "charter":
          systemPrompt = "You are an aviation charter service marketing expert. Create descriptions that emphasize luxury, convenience, and safety.";
          userPrompt = `Create a professional description for this charter service:\n\nTitle: ${details.title}\n${details.aircraftType ? `Aircraft Type: ${details.aircraftType}\n` : ''}${details.location ? `Based: ${details.location}\n` : ''}${details.capacity ? `Capacity: ${details.capacity}\n` : ''}\n\nWrite a 150-250 word description that highlights the service's benefits, aircraft capabilities, safety record, and commitment to customer satisfaction. Emphasize luxury and convenience.`;
          break;

        default:
          return res.status(400).json({ error: "Invalid listing type" });
      }

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const description = completion.choices[0]?.message?.content || "";

      res.json({ description });
    } catch (error: any) {
      console.error("AI description generation error:", {
        message: error?.message,
        status: error?.status,
        response: error?.response?.data,
        baseURL: openaiBaseUrl || "default",
      });
      res.status(500).json({ 
        error: "Failed to generate description",
        details: error?.message || "Unexpected error",
      });
    }
  });

  // Aircraft Listings
  app.get("/api/aircraft", async (req, res) => {
    try {
      const listings = await storage.getAllAircraftListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft listings" });
    }
  });

  app.get("/api/aircraft/:id", async (req, res) => {
    try {
      const listing = await storage.getAircraftListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft" });
    }
  });

  app.get("/api/aircraft/owner/:ownerId", async (req, res) => {
    try {
      const listings = await storage.getAircraftListingsByOwner(req.params.ownerId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner aircraft" });
    }
  });

  app.post("/api/aircraft", 
    isAuthenticated, 
    isVerified,
    upload.fields([
      { name: 'insuranceDoc', maxCount: 1 },
      { name: 'annualInspectionDoc', maxCount: 1 },
    ]),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        // Parse listing data - handle both multipart and JSON
        const hasFiles = files && Object.keys(files).length > 0;
        const listingData = hasFiles ? JSON.parse(req.body.listingData || '{}') : req.body;
        
        // Create individual placeholder URLs for each verification document type (only if files present)
        const timestamp = Date.now();
        const insuranceDocUrl = hasFiles && files.insuranceDoc ? `/uploads/insurance-${userId}-${timestamp}.pdf` : null;
        const annualInspectionDocUrl = hasFiles && files.annualInspectionDoc ? `/uploads/annual-${userId}-${timestamp}.pdf` : null;
        
        // Collect all non-null document URLs for verification submission
        const docUrls = [
          insuranceDocUrl,
          annualInspectionDocUrl,
        ].filter((url): url is string => url !== null);
        
        // Calculate annual due date (12 months from inspection date)
        let annualDueDate = null;
        if (listingData.annualInspectionDate) {
          const inspectionDate = new Date(listingData.annualInspectionDate);
          const dueDate = new Date(inspectionDate);
          dueDate.setFullYear(dueDate.getFullYear() + 1);
          // Convert back to YYYY-MM-DD string format for text field
          annualDueDate = dueDate.toISOString().split('T')[0];
        }
        
        // Calculate 100-hour remaining (currentTach - hour100InspectionTach)
        let hour100Remaining = null;
        if (listingData.requires100Hour && 
            listingData.currentTach !== undefined && listingData.currentTach !== null &&
            listingData.hour100InspectionTach !== undefined && listingData.hour100InspectionTach !== null) {
          const remaining = 100 - (listingData.currentTach - listingData.hour100InspectionTach);
          hour100Remaining = Math.max(0, remaining);
        }
        
        // Create listing - if verification docs provided, keep unlisted until admin approval
        // Otherwise, publish immediately (preserves existing behavior for JSON-only submissions)
        const validatedData = insertAircraftListingSchema.parse({
          ...listingData,
          ownerId: userId,
          isListed: !hasFiles || docUrls.length === 0, // Publish immediately if no verification docs
          ownershipVerified: false,
          maintenanceVerified: false,
          hasMaintenanceTracking: !!listingData.maintenanceTrackingProvider,
          // Automatic calculations
          annualDueDate,
          hour100Remaining,
          // Include verification doc URLs in listing for reference
          insuranceDocUrl,
          annualInspectionDocUrl,
        });
        
        const listing = await storage.createAircraftListing(validatedData);
        
        // Create verification submission for admin review (only if verification docs provided)
        if (hasFiles && docUrls.length > 0) {
          await storage.createVerificationSubmission({
            userId,
            type: 'owner_aircraft',
            status: 'pending',
            aircraftId: listing.id,
            submissionData: {
              ...listingData,
              registration: listing.registration,
              make: listing.make,
              model: listing.model,
            },
            documentUrls: docUrls,
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
            rejectionReason: null,
            faaRegistryChecked: false,
            faaRegistryMatch: null,
            faaRegistryData: null,
            sources: [],
            fileHashes: [],
            pilotLicenseExpiresAt: null,
            medicalCertExpiresAt: null,
            insuranceExpiresAt: null,
            governmentIdExpiresAt: null,
            expirationNotificationSent: false,
            lastNotificationSentAt: null,
          });
        }
        
        res.status(201).json(listing);
      } catch (error: any) {
        console.error("Create aircraft listing error:", error);
        res.status(400).json({ error: error.message || "Invalid aircraft data" });
      }
    }
  );

  app.patch("/api/aircraft/:id", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      
      // Verify ownership or admin status
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to update this aircraft" });
      }
      
      const updatedListing = await storage.updateAircraftListing(req.params.id, req.body);
      res.json(updatedListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update aircraft" });
    }
  });

  app.post("/api/aircraft/:id/toggle", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      
      // Verify ownership or admin status
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to toggle this aircraft" });
      }
      
      const toggledListing = await storage.toggleAircraftListingStatus(req.params.id);
      res.json(toggledListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle aircraft status" });
    }
  });

  app.delete("/api/aircraft/:id", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getAircraftListing(req.params.id);
      
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      
      // Verify ownership or admin status
      const user = await storage.getUser(userId);
      if (listing.ownerId !== userId && !user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this aircraft" });
      }
      
      await storage.deleteAircraftListing(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete aircraft" });
    }
  });

  // Marketplace Listings with filtering
  app.get("/api/marketplace", async (req, res) => {
    try {
      const { city, category, minPrice, maxPrice, engineType, keyword, radius, cfiRating } = req.query;
      
      // If no filters provided, use the old method
      if (!city && !category && !minPrice && !maxPrice && !engineType && !keyword && !radius && !cfiRating) {
        const listings = await storage.getAllMarketplaceListings();
        return res.json(listings);
      }

      // Use filtered query with validation
      const filters: any = {};
      if (city) filters.city = city as string;
      if (category) filters.category = category as string;
      
      // Validate and parse numeric price filters
      if (minPrice) {
        const parsed = parseFloat(minPrice as string);
        if (!isNaN(parsed)) filters.minPrice = parsed;
      }
      if (maxPrice) {
        const parsed = parseFloat(maxPrice as string);
        if (!isNaN(parsed)) filters.maxPrice = parsed;
      }
      
      if (engineType) filters.engineType = engineType as string;
      if (keyword) filters.keyword = keyword as string;
      if (cfiRating) filters.cfiRating = cfiRating as string;
      
      // Validate and parse radius filter
      if (radius) {
        const parsed = parseFloat(radius as string);
        if (!isNaN(parsed)) filters.radius = parsed;
      }

      const listings = await storage.getFilteredMarketplaceListings(filters);
      res.json(listings);
    } catch (error) {
      console.error("Failed to fetch marketplace listings:", error);
      res.status(500).json({ error: "Failed to fetch marketplace listings" });
    }
  });

  app.get("/api/marketplace/category/:category", async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByCategory(req.params.category);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category listings" });
    }
  });

  app.get("/api/marketplace/user/:userId", async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByUser(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user listings" });
    }
  });

  // Get flagged marketplace listings (admin only) - MUST come before :id route
  app.get("/api/marketplace/flagged", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const flaggedListings = await storage.getFlaggedMarketplaceListings();
      res.json(flaggedListings);
    } catch (error) {
      console.error("Error fetching flagged listings:", error);
      res.status(500).json({ error: "Failed to fetch flagged listings" });
    }
  });

  app.get("/api/marketplace/:id", async (req: any, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Check if current user has flagged this listing
      let userHasFlagged = false;
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        userHasFlagged = await storage.checkIfUserFlaggedListing(req.params.id, userId);
      }
      
      res.json({ ...listing, userHasFlagged });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // Increment marketplace listing view count
  app.post("/api/marketplace/:id/view", async (req: any, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Increment view count
      await storage.incrementMarketplaceViewCount(req.params.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to increment view count:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  // Promo code validation (public for banner ads, authenticated for marketplace)
  app.post("/api/promo-codes/validate", async (req: any, res) => {
    try {
      const { code, context } = req.body;
      
      if (!code || !context) {
        return res.status(400).json({ valid: false, message: "Code and context are required" });
      }

      if (context !== "banner-ad" && context !== "marketplace") {
        return res.status(400).json({ valid: false, message: "Invalid context" });
      }

      // Validate using database
      const promoCode = await storage.validatePromoCodeForContext(code, context);
      
      if (!promoCode) {
        return res.json({ valid: false, message: "Invalid or expired promo code" });
      }

      // Return valid promo code details
      res.json({ 
        valid: true,
        code: promoCode.code,
        description: promoCode.description || "Promo code applied successfully!",
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue ? parseFloat(promoCode.discountValue) : null,
      });
    } catch (error: any) {
      console.error("Promo code validation error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate promo code" });
    }
  });

  // Auto-deactivate expired listings (called periodically or on-demand)
  app.post("/api/marketplace/check-expirations", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const result = await storage.deactivateExpiredListings();
      res.json({ 
        deactivatedCount: result.deactivatedCount,
        message: `Deactivated ${result.deactivatedCount} expired listings`
      });
    } catch (error: any) {
      console.error("Failed to check expirations:", error);
      res.status(500).json({ error: "Failed to check expirations" });
    }
  });

  // Reactivate a listing (renew for another 30 days with payment)
  app.post("/api/marketplace/:id/reactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { transactionId } = req.body;
      
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to reactivate this listing" });
      }
      
      // Payment verification is REQUIRED for reactivation
      if (!transactionId) {
        return res.status(402).json({ 
          error: "Payment required",
          message: "Payment is required to reactivate this listing."
        });
      }
      
      // Verify payment was successful with Braintree
      const transaction = await gateway.transaction.find(transactionId);
      
      if (transaction.status !== 'settled' && transaction.status !== 'submitted_for_settlement') {
        return res.status(402).json({ 
          error: "Payment required",
          message: "Payment has not been completed."
        });
      }
      
      if (transaction.customFields?.user_id !== userId) {
        return res.status(403).json({ 
          error: "Unauthorized",
          message: "Payment verification failed"
        });
      }
      
      // Calculate monthlyFee from payment amount
      const monthlyFee = parseFloat(transaction.amount);
      
      // Reactivate listing for another 30 days
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const updated = await storage.updateMarketplaceListing(req.params.id, {
        isActive: true,
        expiresAt: newExpiresAt,
        isPaid: true,
        monthlyFee: monthlyFee.toString(),
        updatedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to reactivate listing:", error);
      res.status(500).json({ error: "Failed to reactivate listing" });
    }
  });

  app.post("/api/marketplace", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { promoCode, paymentIntentId, ...listingData } = req.body;
      
      // Check if user is a Super Admin
      const user = await storage.getUser(userId);
      const email = req.user.claims.email;
      const isSuperAdmin = 
        email?.endsWith('@readysetfly.us') || 
        email === 'coryarmer@gmail.com';
      
      let monthlyFee = 25; // Default fee
      let isPaid = false;
      let expiresAt: Date | null = null;
      
      // Super Admins get free listings for testing (no expiration)
      if (isSuperAdmin) {
        monthlyFee = 0;
        isPaid = true; // Mark as paid since it's free for testing
        expiresAt = null; // No expiration for Super Admin test listings
      }
      // Check if promo code is LAUNCH2025 for free 7-day listing
      else if (promoCode && promoCode.toUpperCase() === "LAUNCH2025") {
        monthlyFee = 0;
        isPaid = true; // Mark as paid since it's free
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      }
      // Regular users must have a paid transaction
      else if (paymentIntentId) {
        // Verify payment was successful with Braintree
        const transaction = await gateway.transaction.find(paymentIntentId);
        
        if (transaction.status !== 'settled' && transaction.status !== 'submitted_for_settlement') {
          return res.status(402).json({ 
            error: "Payment required",
            message: "Payment has not been completed. Please complete your payment first."
          });
        }
        
        // Verify the payment matches the user
        if (transaction.customFields?.user_id !== userId) {
          return res.status(403).json({ 
            error: "Unauthorized",
            message: "Payment verification failed"
          });
        }
        
        // Calculate monthlyFee from payment amount
        monthlyFee = parseFloat(transaction.amount);
        isPaid = true;
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      }
      // No payment method provided and not super admin or promo
      else {
        return res.status(402).json({ 
          error: "Payment required",
          message: "Please complete payment to create a listing."
        });
      }
      
      // Validate the base listing data first
      const validatedData = insertMarketplaceListingSchema.parse({ 
        ...listingData, 
        userId,
        monthlyFee: monthlyFee.toString(),
      });
      
      // Create listing with promo code benefits directly in storage
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        isPaid,
        expiresAt,
      });
      
      // Check listing threshold and create notification if needed
      try {
        const categoryListings = await storage.getMarketplaceListingsByCategory(listing.category);
        const activeCount = categoryListings.filter((l: any) => l.isActive).length;
        
        // Create notification when reaching 25 or 30 active listings
        if (activeCount === 25 || activeCount === 30) {
          await storage.createAdminNotification({
            type: "listing_threshold",
            category: listing.category,
            title: `${listing.category.replace('-', ' ').toUpperCase()} Listings Threshold Reached`,
            message: `The ${listing.category.replace('-', ' ')} category now has ${activeCount} active listings. Consider monitoring this category for capacity.`,
            isRead: false,
            isActionable: true,
            listingCount: activeCount,
            threshold: activeCount,
          });
        }
      } catch (notifError) {
        // Don't fail the listing creation if notification fails
        console.error("Failed to create threshold notification:", notifError);
      }
      
      res.status(201).json(listing);
    } catch (error: any) {
      console.error("Marketplace listing creation error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      res.status(400).json({ error: error.message || "Invalid listing data" });
    }
  });

  app.patch("/api/marketplace/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      
      // First, fetch the existing listing to verify ownership
      const existingListing = await storage.getMarketplaceListing(listingId);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Prevent editing sample listings
      if ((existingListing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be edited" });
      }
      
      // Verify the user owns this listing
      if (existingListing.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized - you can only edit your own listings" });
      }
      
      // Update the listing (don't allow changing userId or payment-related fields)
      const { userId: _, monthlyFee: __, isPaid: ___, expiresAt: ____, ...updateData } = req.body;
      const listing = await storage.updateMarketplaceListing(listingId, updateData);
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      res.json(listing);
    } catch (error: any) {
      console.error("Marketplace listing update error:", error);
      res.status(500).json({ error: error.message || "Failed to update listing" });
    }
  });

  // Upgrade marketplace listing tier
  app.post("/api/marketplace/:id/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { newTier, transactionId } = req.body;
      
      // Validate new tier
      if (!['basic', 'standard', 'premium'].includes(newTier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      
      // Fetch the existing listing
      const existingListing = await storage.getMarketplaceListing(listingId);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Prevent upgrading sample listings
      if ((existingListing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be upgraded" });
      }
      
      // Verify ownership
      if (existingListing.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized - you can only upgrade your own listings" });
      }
      
      // Check if already at this tier
      if (existingListing.tier === newTier) {
        return res.status(400).json({ error: "Listing is already at this tier" });
      }
      
      // Define tier pricing based on category
      const getTierPrice = (category: string, tier: string): number => {
        const CATEGORY_PRICING: Record<string, Record<string, number> | number> = {
          'aircraft-sale': { basic: 25, standard: 40, premium: 100 },
          'charter': 250,
          'cfi': 30,
          'flight-school': 250,
          'mechanic': 40,
          'jobs': 40,
        };
        
        const categoryPricing = CATEGORY_PRICING[category];
        if (typeof categoryPricing === 'object') {
          return categoryPricing[tier] || 25;
        }
        return typeof categoryPricing === 'number' ? categoryPricing : 25;
      };
      
      const tierPrices: Record<string, number> = {
        basic: getTierPrice(existingListing.category, 'basic'),
        standard: getTierPrice(existingListing.category, 'standard'),
        premium: getTierPrice(existingListing.category, 'premium'),
      };
      
      // Calculate price difference
      const currentPrice = tierPrices[existingListing.tier] || 25;
      const newPrice = tierPrices[newTier];
      const priceDifference = newPrice - currentPrice;
      
      // Verify upgrade is to a higher tier
      if (priceDifference <= 0) {
        return res.status(400).json({ error: "Can only upgrade to a higher tier" });
      }
      
      // For now, we'll update the tier immediately (payment verification would go here)
      // In production, you'd verify the Braintree transaction before updating
      const updatedListing = await storage.updateMarketplaceListing(listingId, {
        tier: newTier,
        monthlyFee: newPrice.toString(),
      });
      
      res.json({
        message: "Listing upgraded successfully",
        listing: updatedListing,
        upgradeCost: priceDifference,
      });
    } catch (error: any) {
      console.error("Marketplace listing upgrade error:", error);
      res.status(500).json({ error: error.message || "Failed to upgrade listing" });
    }
  });

  // Complete marketplace listing upgrade after PayPal payment
  app.post("/api/marketplace/:id/complete-upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { newTier, orderId } = req.body;
      
      if (!newTier || !orderId) {
        return res.status(400).json({ error: "Missing required fields: newTier and orderId" });
      }
      
      // Validate new tier
      if (!VALID_TIERS.includes(newTier as any)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      
      // Fetch the existing listing
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Prevent upgrading sample listings
      if ((listing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be upgraded" });
      }
      
      // Verify ownership
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to upgrade this listing" });
      }
      
      // Validate upgrade (must be going up in tier)
      if (!isValidUpgrade(listing.tier || 'basic', newTier)) {
        return res.status(400).json({ error: "Invalid upgrade - must upgrade to a higher tier" });
      }
      
      // Verify PayPal order was captured
      try {
        const { body } = await ordersController.getOrder({ id: orderId });
        const orderData = JSON.parse(String(body));
        
        if (orderData.status !== 'COMPLETED') {
          return res.status(400).json({ error: "Payment not completed" });
        }
        
        // Verify the order is for this listing upgrade
        const customId = orderData.purchase_units?.[0]?.custom_id || '';
        if (!customId.includes(`upgrade:${listingId}`)) {
          return res.status(400).json({ error: "Payment order mismatch" });
        }
      } catch (paypalError: any) {
        console.error("PayPal order verification error:", paypalError);
        return res.status(400).json({ error: "Failed to verify payment" });
      }
      
      // Check for replay attacks - verify this order hasn't been used before
      // This is a simple check - in production you'd store used orderIds in the database
      const transactionHistory = (listing as any).upgradeTransactions || [];
      if (transactionHistory.includes(orderId)) {
        return res.status(400).json({ error: "This payment has already been processed" });
      }
      
      // Calculate new monthly fee using shared pricing helper
      const upgradeDelta = getUpgradeDelta(listing.category, listing.tier || 'basic', newTier);
      const newMonthlyFee = (parseFloat(listing.monthlyFee || '25') + upgradeDelta).toString();
      
      // Update the listing with new tier and track the transaction
      const updatedListing = await storage.updateMarketplaceListing(listingId, {
        tier: newTier,
        monthlyFee: newMonthlyFee,
        upgradeTransactions: [...transactionHistory, orderId],
      } as any);
      
      console.log(`✅ Listing ${listingId} upgraded: ${listing.tier} → ${newTier}, PayPal order: ${orderId}`);
      
      res.json({
        message: "Listing upgraded successfully",
        listing: updatedListing,
        transactionId: orderId,
      });
    } catch (error: any) {
      console.error("Complete upgrade error:", error);
      res.status(500).json({ error: error.message || "Failed to complete upgrade" });
    }
  });

  app.delete("/api/marketplace/:id", async (req, res) => {
    try {
      // Check if listing is a sample listing
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if ((listing as any).isExample) {
        return res.status(403).json({ error: "Sample listings cannot be deleted" });
      }
      
      const deleted = await storage.deleteMarketplaceListing(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });

  // Flag marketplace listing as spam/fraud
  app.post("/api/marketplace/:id/flag", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.params.id;
      const { reason } = req.body;

      // Check if listing exists
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }

      // Attempt to flag the listing
      const result = await storage.flagMarketplaceListing(listingId, userId, reason);

      if (!result.success) {
        return res.status(400).json({ error: "You have already flagged this listing", flagCount: result.flagCount });
      }

      res.json({ 
        message: "Listing flagged successfully",
        flagCount: result.flagCount,
      });
    } catch (error: any) {
      console.error("Error flagging marketplace listing:", error);
      res.status(500).json({ error: "Failed to flag listing" });
    }
  });

  // Rentals
  app.get("/api/rentals", async (req, res) => {
    try {
      const rentals = await storage.getAllRentals();
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rentals" });
    }
  });

  app.get("/api/rentals/renter/:renterId", async (req, res) => {
    try {
      const rentals = await storage.getRentalsByRenter(req.params.renterId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch renter rentals" });
    }
  });

  app.get("/api/rentals/owner/:ownerId", async (req, res) => {
    try {
      const rentals = await storage.getRentalsByOwner(req.params.ownerId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch owner rentals" });
    }
  });

  app.get("/api/rentals/aircraft/:aircraftId", async (req, res) => {
    try {
      const rentals = await storage.getRentalsByAircraft(req.params.aircraftId);
      res.json(rentals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft rentals" });
    }
  });

  app.get("/api/rentals/:id", async (req, res) => {
    try {
      const rental = await storage.getRental(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rental" });
    }
  });

  app.post("/api/rentals", isAuthenticated, isVerified, async (req: any, res) => {
    try {
      const renterId = req.user.claims.sub;
      
      // Add renterId from session and ensure dates/hours are properly formatted
      const rentalData = {
        ...req.body,
        renterId,
        // Convert dates to ISO strings if they aren't already
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        // Ensure estimatedHours and hourlyRate are strings
        estimatedHours: String(req.body.estimatedHours),
        hourlyRate: String(req.body.hourlyRate),
      };
      
      const validatedData = insertRentalSchema.parse(rentalData);
      const rental = await storage.createRental(validatedData);
      res.status(201).json(rental);
    } catch (error: any) {
      console.error("Rental creation error:", error);
      res.status(400).json({ error: error.message || "Invalid rental data" });
    }
  });

  app.patch("/api/rentals/:id", async (req, res) => {
    try {
      const rental = await storage.updateRental(req.params.id, req.body);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      res.json(rental);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rental" });
    }
  });

  // Complete rental payment - verifies payment and updates status
  app.post("/api/rentals/:id/complete-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID required" });
      }

      const rental = await storage.getRental(req.params.id);
      
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }

      // Verify the rental belongs to the current user (renter)
      if (rental.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to complete this rental" });
      }

      // Verify rental is in approved status
      if (rental.status !== "approved") {
        return res.status(400).json({ error: "Rental must be in approved status" });
      }

      // NOTE: Payment was already captured by PayPal in the frontend before reaching this endpoint
      // The transactionId is the PayPal order ID that was successfully captured
      console.log(`[RENTAL PAYMENT] PayPal order ${transactionId} captured for rental ${rental.id}`);

      // Update rental to mark as paid and active
      const updatedRental = await storage.updateRental(req.params.id, {
        isPaid: true,
        status: "active",
      });

      // Credit owner's balance with their payout amount
      const ownerPayoutAmount = parseFloat(rental.ownerPayout);
      await storage.addToUserBalance(rental.ownerId, ownerPayoutAmount);
      console.log(`[RENTAL PAYMENT] Credited $${ownerPayoutAmount} to owner ${rental.ownerId} for rental ${rental.id}`);

      res.json(updatedRental);
    } catch (error: any) {
      console.error("Complete payment error:", error);
      res.status(500).json({ error: error.message || "Failed to complete rental payment" });
    }
  });

  // Messages
  app.get("/api/rentals/:rentalId/messages", async (req, res) => {
    try {
      // Verify rental exists and is active
      const rental = await storage.getRental(req.params.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }

      const messages = await storage.getMessagesByRental(req.params.rentalId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      // Verify rental exists and is active
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "active") {
        return res.status(403).json({ error: "Messaging only available for active rentals" });
      }

      const validatedData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid message data" });
    }
  });

  app.patch("/api/messages/:id/read", async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });

  // Reviews
  app.get("/api/reviews/user/:userId", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByUser(req.params.userId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.get("/api/reviews/rental/:rentalId", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByRental(req.params.rentalId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.get("/api/rentals/:rentalId/can-review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rental = await storage.getRental(req.params.rentalId);
      
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }

      // Only completed rentals can be reviewed
      if (rental.status !== "completed") {
        return res.json({ canReview: false, reason: "Rental must be completed" });
      }

      // Check if user is either the renter or owner
      const isParticipant = rental.renterId === userId || rental.ownerId === userId;
      if (!isParticipant) {
        return res.json({ canReview: false, reason: "Not a participant in this rental" });
      }

      // Check if user has already reviewed
      const hasReviewed = await storage.hasUserReviewedRental(req.params.rentalId, userId);
      if (hasReviewed) {
        return res.json({ canReview: false, reason: "Already reviewed" });
      }

      // Determine who should be reviewed (the other party)
      const revieweeId = rental.renterId === userId ? rental.ownerId : rental.renterId;
      
      res.json({ 
        canReview: true, 
        revieweeId,
        rental 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check review eligibility" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify rental exists and is completed
      const rental = await storage.getRental(req.body.rentalId);
      if (!rental) {
        return res.status(404).json({ error: "Rental not found" });
      }
      if (rental.status !== "completed") {
        return res.status(400).json({ error: "Can only review completed rentals" });
      }

      // Verify user is participant
      const isParticipant = rental.renterId === userId || rental.ownerId === userId;
      if (!isParticipant) {
        return res.status(403).json({ error: "Not authorized to review this rental" });
      }

      // Verify user hasn't already reviewed
      const hasReviewed = await storage.hasUserReviewedRental(req.body.rentalId, userId);
      if (hasReviewed) {
        return res.status(400).json({ error: "Already reviewed this rental" });
      }

      // SERVER-SIDE DETERMINATION: reviewee is always the other party in the rental
      // This prevents client-side spoofing of revieweeId
      const revieweeId = rental.renterId === userId ? rental.ownerId : rental.renterId;

      // Validate and create review (exclude revieweeId from client input)
      const { revieweeId: clientRevieweeId, ...reviewData } = req.body;
      const validatedData = insertReviewSchema.parse({
        ...reviewData,
        reviewerId: userId,
        revieweeId, // Server-calculated, not from client
      });
      
      const review = await storage.createReview(validatedData);
      res.status(201).json(review);
    } catch (error: any) {
      console.error("Review creation error:", error);
      res.status(400).json({ error: error.message || "Invalid review data" });
    }
  });

  // Favorites
  app.post("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const validatedData = insertFavoriteSchema.parse({
        ...req.body,
        userId, // Server-side, not from client
      });

      const favorite = await storage.addFavorite(userId, validatedData.listingType, validatedData.listingId);
      res.status(201).json(favorite);
    } catch (error: any) {
      console.error("Add favorite error:", error);
      res.status(400).json({ error: error.message || "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites/:listingType/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingType, listingId } = req.params;

      if (listingType !== "marketplace" && listingType !== "aircraft") {
        return res.status(400).json({ error: "listingType must be 'marketplace' or 'aircraft'" });
      }

      const removed = await storage.removeFavorite(userId, listingType, listingId);
      if (!removed) {
        return res.status(404).json({ error: "Favorite not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  app.get("/api/favorites/check/:listingType/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listingType, listingId } = req.params;

      if (listingType !== "marketplace" && listingType !== "aircraft") {
        return res.status(400).json({ error: "listingType must be 'marketplace' or 'aircraft'" });
      }

      const isFavorited = await storage.checkIfFavorited(userId, listingType, listingId);
      res.json({ isFavorited });
    } catch (error) {
      console.error("Check favorite error:", error);
      res.status(500).json({ error: "Failed to check favorite status" });
    }
  });

  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  // Transactions
  app.get("/api/transactions/user/:userId", async (req, res) => {
    try {
      const transactions = await storage.getTransactionsByUser(req.params.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const transaction = await storage.createTransaction(req.body);
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid transaction data" });
    }
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.updateTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  // Verification Submissions
  app.post("/api/verification-submissions", 
    isAuthenticated, 
    upload.fields([
      { name: 'governmentIdFront', maxCount: 1 },
      { name: 'governmentIdBack', maxCount: 1 },
      { name: 'pilotCertificatePhoto', maxCount: 1 },
    ]), 
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        // Parse submission data from form
        const submissionData = JSON.parse(req.body.submissionData || '{}');
        const type = req.body.type || 'renter_identity';
        
        // In production, upload files to cloud storage (S3, Replit Object Storage, etc.)
        // For now, create placeholder URLs
        const documentUrls: string[] = [];
        
        if (files.governmentIdFront) {
          documentUrls.push(`/uploads/id-front-${userId}-${Date.now()}.jpg`);
        }
        if (files.governmentIdBack) {
          documentUrls.push(`/uploads/id-back-${userId}-${Date.now()}.jpg`);
        }
        if (files.pilotCertificatePhoto) {
          documentUrls.push(`/uploads/pilot-cert-${userId}-${Date.now()}.jpg`);
        }
        
        // Create verification submission
        const submission = await storage.createVerificationSubmission({
          userId,
          type,
          status: 'pending',
          aircraftId: null,
          submissionData,
          documentUrls,
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          rejectionReason: null,
          faaRegistryChecked: false,
          faaRegistryMatch: null,
          faaRegistryData: null,
          sources: [],
          fileHashes: [],
          pilotLicenseExpiresAt: null,
          medicalCertExpiresAt: null,
          insuranceExpiresAt: null,
          governmentIdExpiresAt: null,
          expirationNotificationSent: false,
          lastNotificationSentAt: null,
        });
        
        res.json(submission);
      } catch (error: any) {
        console.error("Verification submission error:", error);
        res.status(500).json({ error: error.message || "Failed to submit verification" });
      }
    }
  );

  app.get("/api/verification-submissions/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      // Only allow users to view their own submissions (or admins)
      const requestingUser = await storage.getUser(requestingUserId);
      if (requestingUserId !== targetUserId && !requestingUser?.isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const submissions = await storage.getVerificationSubmissionsByUser(targetUserId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch verification submissions" });
    }
  });

  app.get("/api/verification-submissions/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Disable caching for admin verification data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const submissions = await storage.getPendingVerificationSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending verifications" });
    }
  });

  app.patch("/api/verification-submissions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const reviewerId = req.user.claims.sub;
      const updates = {
        ...req.body,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      };
      
      const submission = await storage.updateVerificationSubmission(req.params.id, updates);
      
      if (!submission) {
        return res.status(404).json({ error: "Verification submission not found" });
      }
      
      // If approved, update user verification status
      if (req.body.status === 'approved') {
        if (submission.type === 'renter_identity') {
          const submissionData = submission.submissionData as any;
          await storage.updateUser(submission.userId, {
            legalFirstName: submissionData.legalFirstName,
            legalLastName: submissionData.legalLastName,
            dateOfBirth: submissionData.dateOfBirth,
            identityVerified: true,
            identityVerifiedAt: new Date(),
            isVerified: true, // Legacy field
          });
          
          // If FAA data provided, update that too
          if (submissionData.faaCertificateNumber) {
            await storage.updateUser(submission.userId, {
              faaCertificateNumber: submissionData.faaCertificateNumber,
              pilotCertificateName: submissionData.pilotCertificateName,
              faaVerified: true,
              faaVerifiedMonth: new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }),
              faaVerifiedAt: new Date(),
            });
          }
        } else if (submission.type === 'owner_aircraft' && submission.aircraftId) {
          // Approve owner/aircraft verification - publish the listing
          await storage.updateAircraftListing(submission.aircraftId, {
            ownershipVerified: true,
            maintenanceVerified: true,
            maintenanceVerifiedAt: new Date(),
            isListed: true, // Publish the listing
          });
        }
      }
      
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update verification submission" });
    }
  });

  // Withdrawal Requests (PayPal Payouts)
  app.get("/api/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await storage.getUserBalance(userId);
      res.json({ balance });
    } catch (error) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  app.post("/api/withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, paypalEmail } = req.body;

      // Validate inputs
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount" });
      }

      if (!paypalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
        return res.status(400).json({ error: "Valid PayPal email is required" });
      }

      // Check if user has sufficient balance
      const userBalance = parseFloat(await storage.getUserBalance(userId));
      if (userBalance < parsedAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Deduct amount from user balance atomically before processing
      await storage.deductFromUserBalance(userId, parsedAmount);

      // Create initial withdrawal request  
      const request = await storage.createWithdrawalRequest({
        userId,
        amount: amount.toString(),
        paypalEmail
      });

      // Update to processing status
      await storage.updateWithdrawalRequest(request.id, { status: "processing" });

      // Automatically process payout via PayPal
      try {
        const { sendPayout } = await import("./paypal-payouts");
        const payoutResult = await sendPayout({
          recipientEmail: paypalEmail,
          amount: parsedAmount,
          senderItemId: request.id,
          note: `Withdrawal request ${request.id}`,
          emailSubject: "You've received a payout from Ready Set Fly",
          emailMessage: "Your rental earnings have been sent to your PayPal account."
        });

        if (payoutResult.success) {
          // Update withdrawal with success status and PayPal details
          const completedRequest = await storage.updateWithdrawalRequest(request.id, {
            status: "completed",
            payoutBatchId: payoutResult.batchId,
            payoutItemId: payoutResult.itemId,
            transactionId: payoutResult.transactionId,
            processedAt: new Date()
          });

          console.log(`[PAYOUT SUCCESS] User ${userId} withdrawal ${request.id}: $${parsedAmount} sent to ${paypalEmail}`);
          res.json(completedRequest);
        } else {
          // Payout failed - refund user balance
          await storage.addToUserBalance(userId, parsedAmount);
          await storage.updateWithdrawalRequest(request.id, {
            status: "failed",
            failureReason: payoutResult.error,
            processedAt: new Date()
          });

          console.error(`[PAYOUT FAILED] User ${userId} withdrawal ${request.id}: ${payoutResult.error}`);
          res.status(400).json({ 
            error: `Payout failed: ${payoutResult.error}. Your balance has been refunded.`
          });
        }
      } catch (payoutError: any) {
        // Exception during payout - refund balance and mark as failed
        await storage.addToUserBalance(userId, parsedAmount);
        await storage.updateWithdrawalRequest(request.id, {
          status: "failed",
          failureReason: payoutError.message,
          processedAt: new Date()
        });

        console.error(`[PAYOUT ERROR] User ${userId} withdrawal ${request.id}:`, payoutError);
        res.status(500).json({ 
          error: `Payout processing error: ${payoutError.message}. Your balance has been refunded.`
        });
      }
    } catch (error: any) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ error: error.message || "Failed to create withdrawal request" });
    }
  });

  app.get("/api/withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getWithdrawalRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      // searchUsers already sanitizes sensitive fields at the storage layer
      const users = query ? await storage.searchUsers(query) : [];
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // Get specific user details (admin)
  app.get("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Get user's aircraft listings (admin)
  app.get("/api/admin/users/:userId/aircraft", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const listings = await storage.getAircraftListingsByOwner(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's aircraft listings" });
    }
  });

  // Get user's marketplace listings (admin)
  app.get("/api/admin/users/:userId/marketplace", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const listings = await storage.getMarketplaceListingsByUser(req.params.userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's marketplace listings" });
    }
  });

  // Get user's verification submissions (admin)
  app.get("/api/admin/users/:userId/verifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const verifications = await storage.getVerificationSubmissionsByUser(req.params.userId);
      res.json(verifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user's verification submissions" });
    }
  });

  // Reset user password (admin)
  app.post("/api/admin/users/:userId/reset-password", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // In a real implementation, this would send a password reset email
      // For now, we'll just return success
      // TODO: Integrate with email service to send password reset link
      
      res.json({ 
        success: true, 
        message: "Password reset email would be sent to user",
        email: user.email 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate password reset" });
    }
  });

  // Update user (admin) - for verification toggles and admin status
  app.patch("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.userId, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/admin/aircraft", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Note: getAllAircraftListings already has reasonable limits in storage layer
      const listings = await storage.getAllAircraftListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch aircraft listings" });
    }
  });

  app.get("/api/admin/marketplace", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Note: getAllMarketplaceListings already has reasonable limits in storage layer
      const listings = await storage.getAllMarketplaceListings();
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch marketplace listings" });
    }
  });

  // Update aircraft listing (admin actions)
  app.patch("/api/admin/aircraft/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { isListed, isFeatured, adminNotes } = req.body;
      const updates: any = {};
      
      if (typeof isListed === 'boolean') updates.isListed = isListed;
      if (typeof isFeatured === 'boolean') updates.isFeatured = isFeatured;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      
      const aircraft = await storage.updateAircraftListing(req.params.id, updates);
      if (!aircraft) {
        return res.status(404).json({ error: "Aircraft listing not found" });
      }
      res.json(aircraft);
    } catch (error) {
      console.error("Error updating aircraft listing:", error);
      res.status(500).json({ error: "Failed to update aircraft listing" });
    }
  });

  // Update marketplace listing (admin actions)
  app.patch("/api/admin/marketplace/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { isActive, isFeatured, adminNotes, expiresAt } = req.body;
      const updates: any = {};
      
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof isFeatured === 'boolean') updates.isFeatured = isFeatured;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      
      const listing = await storage.updateMarketplaceListing(req.params.id, updates);
      if (!listing) {
        return res.status(404).json({ error: "Marketplace listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error updating marketplace listing:", error);
      res.status(500).json({ error: "Failed to update marketplace listing" });
    }
  });

  // Admin Analytics
  app.get("/api/admin/analytics", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // User Metrics (Admin only)
  app.get("/api/admin/user-metrics", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [userMetrics, geographic, retention] = await Promise.all([
        storage.getUserMetrics(),
        storage.getGeographicDistribution(),
        storage.getUserRetentionMetrics()
      ]);
      
      res.json({
        ...userMetrics,
        geographic,
        retention
      });
    } catch (error) {
      console.error("Error fetching user metrics:", error);
      res.status(500).json({ error: "Failed to fetch user metrics" });
    }
  });

  // Admin - Withdrawal Requests
  app.get("/api/admin/withdrawals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllWithdrawalRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });

  app.get("/api/admin/withdrawals/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getPendingWithdrawalRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error);
      res.status(500).json({ error: "Failed to fetch pending withdrawals" });
    }
  });

  app.post("/api/admin/withdrawals/:id/process", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const withdrawalId = req.params.id;
      const adminId = req.user.claims.sub;

      // Get withdrawal request
      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      if (withdrawal.status !== "pending") {
        return res.status(400).json({ error: "Withdrawal request is not pending" });
      }

      // Update status to processing
      await storage.updateWithdrawalRequest(withdrawalId, {
        status: "processing",
        processedBy: adminId,
        processedAt: new Date()
      });

      // Send payout via PayPal
      const { sendPayout } = await import("./paypal-payouts");
      const payoutResult = await sendPayout({
        recipientEmail: withdrawal.paypalEmail,
        amount: parseFloat(withdrawal.amount),
        senderItemId: withdrawalId,
        note: `Withdrawal request ${withdrawalId}`,
        emailSubject: "You've received a payout from Ready Set Fly",
        emailMessage: "Your rental earnings have been sent to your PayPal account."
      });

      if (payoutResult.success) {
        // Update withdrawal with PayPal details
        await storage.updateWithdrawalRequest(withdrawalId, {
          status: "completed",
          payoutBatchId: payoutResult.batchId,
          payoutItemId: payoutResult.itemId,
          transactionId: payoutResult.transactionId
        });

        res.json({
          success: true,
          message: "Payout sent successfully",
          withdrawal: await storage.getWithdrawalRequest(withdrawalId)
        });
      } else {
        // Payout failed - refund user balance and mark as failed
        await storage.addToUserBalance(withdrawal.userId, parseFloat(withdrawal.amount));
        await storage.updateWithdrawalRequest(withdrawalId, {
          status: "failed",
          failureReason: payoutResult.error
        });

        res.status(400).json({
          success: false,
          error: payoutResult.error,
          message: "Payout failed, user balance has been refunded"
        });
      }
    } catch (error: any) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ error: error.message || "Failed to process withdrawal" });
    }
  });

  app.patch("/api/admin/withdrawals/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const withdrawalId = req.params.id;
      const { status, adminNotes } = req.body;

      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      // If cancelling, refund user balance
      if (status === "cancelled" && withdrawal.status === "pending") {
        await storage.addToUserBalance(withdrawal.userId, parseFloat(withdrawal.amount));
      }

      const updated = await storage.updateWithdrawalRequest(withdrawalId, {
        status,
        adminNotes,
        processedBy: req.user.claims.sub,
        processedAt: new Date()
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ error: error.message || "Failed to update withdrawal" });
    }
  });

  // Stale & Orphaned Listings Management (Admin only)
  app.get("/api/admin/stale-listings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const daysStale = parseInt(req.query.days as string) || 60;
      const [staleAircraft, staleMarketplace] = await Promise.all([
        storage.getStaleAircraftListings(daysStale),
        storage.getStaleMarketplaceListings(daysStale)
      ]);
      
      res.json({
        aircraft: staleAircraft,
        marketplace: staleMarketplace,
        totalCount: staleAircraft.length + staleMarketplace.length
      });
    } catch (error) {
      console.error("Error fetching stale listings:", error);
      res.status(500).json({ error: "Failed to fetch stale listings" });
    }
  });

  app.get("/api/admin/orphaned-listings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [orphanedAircraft, orphanedMarketplace] = await Promise.all([
        storage.getOrphanedAircraftListings(),
        storage.getOrphanedMarketplaceListings()
      ]);
      
      res.json({
        aircraft: orphanedAircraft,
        marketplace: orphanedMarketplace,
        totalCount: orphanedAircraft.length + orphanedMarketplace.length
      });
    } catch (error) {
      console.error("Error fetching orphaned listings:", error);
      res.status(500).json({ error: "Failed to fetch orphaned listings" });
    }
  });

  app.post("/api/admin/send-listing-reminders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getUncachableResendClient } = await import('./resendClient');
      const { getListingReminderEmailHtml, getListingReminderEmailText } = await import('./email-templates');
      
      const usersWithListings = await storage.getUsersWithActiveListings();
      const { client, fromEmail } = await getUncachableResendClient();
      
      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      for (const { user, aircraftCount, marketplaceCount } of usersWithListings) {
        if (!user.email) {
          failureCount++;
          errors.push(`User ${user.id} has no email`);
          continue;
        }

        try {
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `📋 Monthly Listing Review - ${aircraftCount + marketplaceCount} Active Listing${aircraftCount + marketplaceCount === 1 ? '' : 's'}`,
            html: getListingReminderEmailHtml(user.firstName || 'Pilot', aircraftCount, marketplaceCount),
            text: getListingReminderEmailText(user.firstName || 'Pilot', aircraftCount, marketplaceCount),
          });
          successCount++;
        } catch (emailError: any) {
          failureCount++;
          errors.push(`Failed to send to ${user.email}: ${emailError.message}`);
          console.error(`Error sending email to ${user.email}:`, emailError);
        }
      }

      res.json({
        success: true,
        totalUsers: usersWithListings.length,
        emailsSent: successCount,
        emailsFailed: failureCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error("Error sending listing reminders:", error);
      res.status(500).json({ error: error.message || "Failed to send listing reminders" });
    }
  });

  // Refresh Listings (User endpoints)
  app.patch("/api/aircraft/:id/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const aircraft = await storage.getAircraftListing(req.params.id);
      if (!aircraft) {
        return res.status(404).json({ error: "Aircraft listing not found" });
      }

      // Get user from session
      const sessionUserId = req.user.claims.sub;
      const user = await storage.getUser(sessionUserId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify ownership
      if (aircraft.ownerId !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to refresh this listing" });
      }

      const updated = await storage.refreshAircraftListing(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing aircraft listing:", error);
      res.status(500).json({ error: "Failed to refresh aircraft listing" });
    }
  });

  app.patch("/api/marketplace/:id/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Marketplace listing not found" });
      }

      // Get user from session
      const sessionUserId = req.user.claims.sub;
      const user = await storage.getUser(sessionUserId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Verify ownership
      if (listing.userId !== user.id && !user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to refresh this listing" });
      }

      const updated = await storage.refreshMarketplaceListing(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing marketplace listing:", error);
      res.status(500).json({ error: "Failed to refresh marketplace listing" });
    }
  });

  // CRM - Leads (Admin only)
  app.get("/api/crm/leads", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/crm/leads", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const lead = await storage.createLead(req.body);
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/crm/leads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const lead = await storage.updateLead(req.params.id, req.body);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/crm/leads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteLead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // CRM - Contacts (Admin only)
  app.get("/api/crm/contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/crm/contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const contact = await storage.createContact(req.body);
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/crm/contacts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/crm/contacts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // CRM - Deals (Admin only)
  app.get("/api/crm/deals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.post("/api/crm/deals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deal = await storage.createDeal(req.body);
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.patch("/api/crm/deals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deal = await storage.updateDeal(req.params.id, req.body);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/crm/deals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteDeal(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // CRM - Activities (Admin only)
  app.get("/api/crm/activities", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/crm/activities", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activity = await storage.createActivity(req.body);
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/crm/activities/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activity = await storage.updateActivity(req.params.id, req.body);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.delete("/api/crm/activities/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteActivity(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // Expenses (Admin only - for analytics tracking)
  app.get("/api/admin/expenses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const expenses = await storage.getAllExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/admin/expenses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = insertExpenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const expense = await storage.createExpense(result.data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/admin/expenses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Validate partial update data
      const result = insertExpenseSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const expense = await storage.updateExpense(req.params.id, result.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/admin/expenses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteExpense(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // Promo Codes (Admin only)
  app.get("/api/admin/promo-codes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promo codes" });
    }
  });

  app.post("/api/admin/promo-codes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { insertPromoCodeSchema } = await import("@shared/schema");
      const result = insertPromoCodeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const promoCode = await storage.createPromoCode(result.data);
      res.status(201).json(promoCode);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(400).json({ error: "Promo code already exists" });
      }
      res.status(500).json({ error: "Failed to create promo code" });
    }
  });

  app.patch("/api/admin/promo-codes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { insertPromoCodeSchema } = await import("@shared/schema");
      const result = insertPromoCodeSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.format() });
      }
      const promoCode = await storage.updatePromoCode(req.params.id, result.data);
      if (!promoCode) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      res.json(promoCode);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Promo code already exists" });
      }
      res.status(500).json({ error: "Failed to update promo code" });
    }
  });

  app.delete("/api/admin/promo-codes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deletePromoCode(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Promo code not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete promo code" });
    }
  });

  // Admin Notifications
  app.get("/api/admin/notifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notifications = await storage.getAllAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/admin/notifications/unread", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notifications = await storage.getUnreadAdminNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.post("/api/admin/notifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notification = await storage.createAdminNotification(req.body);
      res.status(201).json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.patch("/api/admin/notifications/:id/read", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/admin/notifications/:id/actionable", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { isActionable } = req.body;
      const notification = await storage.markNotificationAsActionable(req.params.id, isActionable);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.delete("/api/admin/notifications/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteAdminNotification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Banner Ad Orders - Admin Management
  app.get("/api/admin/banner-ad-orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { approvalStatus, paymentStatus } = req.query;
      const orders = await storage.getBannerAdOrdersByStatus(
        approvalStatus as string | undefined,
        paymentStatus as string | undefined
      );
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad orders" });
    }
  });

  app.get("/api/admin/banner-ad-orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const order = await storage.getBannerAdOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad order" });
    }
  });

  app.post("/api/admin/banner-ad-orders", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // BACKEND VALIDATION: Recalculate pricing server-side to prevent tampering
      const { calculateBannerAdPricing } = await import("../shared/config/bannerPricing");
      const { validatePromoCode, calculatePromoDiscount } = await import("../shared/config/promoCodes");
      
      const tier = req.body.tier;
      const promoCode = req.body.promoCode?.trim();
      
      // Calculate base pricing
      const basePricing = calculateBannerAdPricing(tier);
      
      // Apply promo code if provided and valid
      let finalPricing = {
        monthlyRate: basePricing.monthlyRate.toString(),
        totalAmount: basePricing.subscriptionTotal.toString(),
        creationFee: basePricing.creationFee.toString(),
        grandTotal: basePricing.grandTotal.toString(),
        discountAmount: "0.00",
        promoCode: "",
      };
      
      if (promoCode) {
        const promo = validatePromoCode(promoCode);
        if (promo) {
          const discounts = calculatePromoDiscount(
            basePricing.creationFee,
            basePricing.subscriptionTotal,
            promoCode
          );
          
          finalPricing = {
            monthlyRate: basePricing.monthlyRate.toString(),
            totalAmount: basePricing.subscriptionTotal.toString(),
            creationFee: discounts.finalCreationFee.toFixed(2),
            grandTotal: discounts.finalGrandTotal.toFixed(2),
            discountAmount: discounts.totalDiscount.toFixed(2),
            promoCode: promo.code,
          };
        }
      }
      
      // Override request body with validated pricing
      const validatedOrderData = {
        ...req.body,
        ...finalPricing,
      };
      
      const order = await storage.createBannerAdOrder(validatedOrderData);
      
      // Send email notification to sponsor (non-blocking)
      (async () => {
        try {
          const { getUncachableResendClient } = await import("./resendClient");
          const { getBannerAdOrderEmailHtml, getBannerAdOrderEmailText } = await import("./email-templates");
          
          const { client, fromEmail } = await getUncachableResendClient();
          
          await client.emails.send({
            from: fromEmail,
            to: order.sponsorEmail,
            subject: `Banner Ad Order Confirmation - ${order.title}`,
            html: getBannerAdOrderEmailHtml(order.sponsorName, {
              orderId: order.id,
              title: order.title,
              tier: order.tier,
              monthlyRate: order.monthlyRate,
              creationFee: order.creationFee,
              totalAmount: order.totalAmount,
              grandTotal: order.grandTotal,
              promoCode: order.promoCode || undefined,
              discountAmount: order.discountAmount || undefined,
            }),
            text: getBannerAdOrderEmailText(order.sponsorName, {
              orderId: order.id,
              title: order.title,
              tier: order.tier,
              monthlyRate: order.monthlyRate,
              creationFee: order.creationFee,
              totalAmount: order.totalAmount,
              grandTotal: order.grandTotal,
              promoCode: order.promoCode || undefined,
              discountAmount: order.discountAmount || undefined,
            }),
          });
          
          console.log(`✅ Banner ad order confirmation email sent to ${order.sponsorEmail}`);
        } catch (emailError) {
          console.error('❌ Failed to send banner ad order email:', emailError);
        }
      })();
      
      res.status(201).json(order);
    } catch (error) {
      console.error('Banner ad order creation error:', error);
      res.status(500).json({ error: "Failed to create banner ad order", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/admin/banner-ad-orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // CRITICAL: Load existing order to get tier if not provided in request
      const existingOrder = await storage.getBannerAdOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      
      // BACKEND VALIDATION: Always recalculate pricing server-side to prevent tampering
      const { calculateBannerAdPricing } = await import("../shared/config/bannerPricing");
      const { validatePromoCode, calculatePromoDiscount } = await import("../shared/config/promoCodes");
      
      // Use tier from request, or fallback to existing tier
      const tier = req.body.tier || existingOrder.tier;
      const promoCode = req.body.promoCode?.trim() ?? (req.body.promoCode === "" ? "" : existingOrder.promoCode);
      
      // ALWAYS calculate base pricing
      const basePricing = calculateBannerAdPricing(tier);
      
      // Apply promo code if provided and valid
      let finalPricing = {
        monthlyRate: basePricing.monthlyRate.toString(),
        totalAmount: basePricing.subscriptionTotal.toString(),
        creationFee: basePricing.creationFee.toString(),
        grandTotal: basePricing.grandTotal.toString(),
        discountAmount: "0.00",
        promoCode: "",
      };
      
      if (promoCode) {
        const promo = validatePromoCode(promoCode);
        if (promo) {
          const discounts = calculatePromoDiscount(
            basePricing.creationFee,
            basePricing.subscriptionTotal,
            promoCode
          );
          
          finalPricing = {
            monthlyRate: basePricing.monthlyRate.toString(),
            totalAmount: basePricing.subscriptionTotal.toString(),
            creationFee: discounts.finalCreationFee.toFixed(2),
            grandTotal: discounts.finalGrandTotal.toFixed(2),
            discountAmount: discounts.totalDiscount.toFixed(2),
            promoCode: promo.code,
          };
        }
      }
      
      // ALWAYS override request body with validated pricing
      req.body = {
        ...req.body,
        tier, // Ensure tier is set
        ...finalPricing,
      };
      
      const order = await storage.updateBannerAdOrder(req.params.id, req.body);
      res.json(order);
    } catch (error) {
      console.error('Banner ad order update error:', error);
      res.status(500).json({ error: "Failed to update banner ad order" });
    }
  });

  app.delete("/api/admin/banner-ad-orders/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBannerAdOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner ad order" });
    }
  });

  app.post("/api/admin/banner-ad-orders/:id/activate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ad = await storage.activateBannerAdOrder(req.params.id);
      if (!ad) {
        return res.status(400).json({ error: "Failed to activate order. Order must be paid and have required content." });
      }
      res.json(ad);
    } catch (error) {
      // Handle duplicate activation attempt
      if (error instanceof Error && error.message === 'ALREADY_ACTIVATED') {
        return res.status(409).json({ error: "This order has already been activated." });
      }
      // Handle missing image
      if (error instanceof Error && error.message === 'IMAGE_REQUIRED') {
        return res.status(400).json({ errorCode: "IMAGE_REQUIRED", error: "Banner image is required. Please upload an image before activating this order." });
      }
      console.error('Banner ad order activation error:', error);
      res.status(500).json({ error: "Failed to activate banner ad order", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/admin/banner-ad-orders/:id/approval", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { approvalStatus, adminNotes } = req.body;
      
      // Validate approval status
      const validStatuses = ['approved', 'rejected', 'sent', 'draft'];
      if (!approvalStatus || !validStatuses.includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status. Must be: approved, rejected, sent, or draft" });
      }
      
      // Get current order to check payment status
      const order = await storage.getBannerAdOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Banner ad order not found" });
      }
      
      // Only allow approval if order is paid
      if (approvalStatus === 'approved' && order.paymentStatus !== 'paid') {
        return res.status(400).json({ error: "Cannot approve unpaid orders. Order must be paid before approval." });
      }
      
      // Update approval status
      const updated = await storage.updateBannerAdOrder(req.params.id, {
        approvalStatus,
        adminNotes: adminNotes || order.adminNotes
      });
      
      console.log(`✅ Banner ad order ${req.params.id} approval status updated to: ${approvalStatus}`);
      res.json(updated);
    } catch (error) {
      console.error('Banner ad order approval error:', error);
      res.status(500).json({ error: "Failed to update approval status" });
    }
  });

  // Banner Ads - Admin Management
  app.get("/api/admin/banner-ads", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ads = await storage.getAllBannerAds();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ads" });
    }
  });

  app.get("/api/admin/banner-ads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ad = await storage.getBannerAd(req.params.id);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      res.json(ad);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banner ad" });
    }
  });

  app.post("/api/admin/banner-ads", isAuthenticated, isAdmin, async (req, res) => {
    // Reject manual creation - banner ads must be created by activating paid orders
    res.status(403).json({ 
      error: "Manual banner ad creation is not allowed", 
      message: "Banner ads can only be created by activating paid banner ad orders. Please use the 'Activate Order' button in the Banner Ad Orders section." 
    });
  });

  app.patch("/api/admin/banner-ads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log("[BANNER UPDATE] Request body:", req.body);
      console.log("[BANNER UPDATE] Banner ID:", req.params.id);
      
      // Admin can update ALL fields
      const updateData: any = {};
      
      // Handle date conversions
      if (req.body.startDate) {
        updateData.startDate = new Date(req.body.startDate);
      }
      if (req.body.endDate) {
        updateData.endDate = new Date(req.body.endDate);
      }
      
      // Copy all other fields
      const fieldsToUpdate = ['title', 'description', 'imageUrl', 'link', 'placements', 'category', 'isActive'];
      for (const field of fieldsToUpdate) {
        if (field in req.body) {
          updateData[field] = req.body[field];
        }
      }
      
      console.log("[BANNER UPDATE] Update data:", updateData);
      
      const ad = await storage.updateBannerAd(req.params.id, updateData);
      if (!ad) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      console.log("[BANNER UPDATE] Success! Updated ad:", ad);
      res.json(ad);
    } catch (error) {
      console.error("[BANNER UPDATE] Error:", error);
      res.status(500).json({ error: "Failed to update banner ad" });
    }
  });

  app.delete("/api/admin/banner-ads/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBannerAd(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Banner ad not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete banner ad" });
    }
  });

  // Banner Ads - Public Endpoints
  app.get("/api/banner-ads/active", async (req, res) => {
    try {
      const { placement, category } = req.query;
      const ads = await storage.getActiveBannerAds(
        placement as string | undefined,
        category as string | undefined
      );
      res.json(ads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active banner ads" });
    }
  });

  app.post("/api/banner-ads/:id/impression", async (req, res) => {
    try {
      await storage.incrementBannerImpressions(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track impression" });
    }
  });

  app.post("/api/banner-ads/:id/click", async (req, res) => {
    try {
      await storage.incrementBannerClicks(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to track click" });
    }
  });

  // Extract invoice data using OpenAI Vision API
  app.post("/api/admin/extract-invoice-data", isAuthenticated, isAdmin, upload.single('invoice'), async (req, res) => {
    const fs = await import('fs/promises');
    let filePath: string | null = null;
    let shouldCleanup = false;
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No invoice file provided" });
      }

      filePath = req.file.path;
      shouldCleanup = true; // File was uploaded, ensure cleanup

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Please upload an image or PDF." });
      }

      // Read file and convert to base64
      const fileBuffer = await fs.readFile(filePath);
      const base64Image = fileBuffer.toString('base64');
      const mimeType = req.file.mimetype;

      const prompt = `You are an invoice data extraction assistant. Analyze this invoice image and extract the following information in JSON format:
{
  "amount": "the total amount (just the number with decimal, no currency symbol)",
  "date": "the invoice date in YYYY-MM-DD format",
  "description": "a brief description of what the invoice is for (company name + service/product)",
  "category": "best matching category: 'server', 'database', or 'other'"
}

If you cannot find certain fields, omit them from the response. Be accurate and only return the JSON object, nothing else.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1, // Lower temperature for more consistent extraction
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      
      // Parse JSON from response (handle potential markdown code blocks)
      let extractedData: any = {};
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (parseError) {
        console.error('Failed to parse AI response:', responseText);
        extractedData = {};
      }

      // Validate extracted data structure
      const validatedData: any = {};
      if (extractedData.amount && typeof extractedData.amount === 'string') {
        validatedData.amount = extractedData.amount;
      }
      if (extractedData.date && typeof extractedData.date === 'string') {
        validatedData.date = extractedData.date;
      }
      if (extractedData.description && typeof extractedData.description === 'string') {
        validatedData.description = extractedData.description;
      }
      if (extractedData.category && ['server', 'database', 'other'].includes(extractedData.category)) {
        validatedData.category = extractedData.category;
      }

      res.json(validatedData);
    } catch (error: any) {
      console.error('Invoice extraction error:', error);
      const errorMessage = error.message || "Failed to extract invoice data";
      res.status(500).json({ error: errorMessage });
    } finally {
      // Always clean up the uploaded file
      if (filePath && shouldCleanup) {
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
    }
  });

  // Promo Alerts (Public read active, Admin read all/write)
  app.get("/api/promo-alerts", async (req, res) => {
    try {
      const alerts = await storage.getActivePromoAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Failed to fetch promo alerts:', error);
      res.status(500).json({ error: "Failed to fetch promotional alerts" });
    }
  });

  app.get("/api/admin/promo-alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const alerts = await storage.getAllPromoAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Failed to fetch all promo alerts:', error);
      res.status(500).json({ error: "Failed to fetch promotional alerts" });
    }
  });

  app.post("/api/promo-alerts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertPromoAlertSchema.parse(req.body);
      const alert = await storage.createPromoAlert(validatedData);
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to create promo alert:', error);
      res.status(400).json({ error: error.message || "Failed to create promotional alert" });
    }
  });

  app.patch("/api/promo-alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const partialSchema = insertPromoAlertSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const alert = await storage.updatePromoAlert(req.params.id, validatedData);
      if (!alert) {
        return res.status(404).json({ error: "Promotional alert not found" });
      }
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to update promo alert:', error);
      res.status(400).json({ error: error.message || "Failed to update promotional alert" });
    }
  });

  app.delete("/api/promo-alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deletePromoAlert(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Promotional alert not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete promo alert:', error);
      res.status(500).json({ error: "Failed to delete promotional alert" });
    }
  });

  // Grant promotional free time to marketplace listing (admin only)
  app.post("/api/admin/marketplace/:id/grant-promo", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { durationDays } = req.body;
      
      if (!durationDays || durationDays < 1 || durationDays > 31) {
        return res.status(400).json({ error: "Duration must be between 1 and 31 days" });
      }
      
      const listing = await storage.grantMarketplacePromoFreeTime(
        req.params.id, 
        durationDays, 
        req.user.id
      );
      
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      res.json(listing);
    } catch (error: any) {
      console.error('Failed to grant promo free time:', error);
      res.status(500).json({ error: error.message || "Failed to grant promotional free time" });
    }
  });

  // Job Applications
  app.post("/api/job-applications", upload.single('resume'), async (req: any, res) => {
    try {
      const { listingId, firstName, lastName, email, phone, currentJobTitle, yearsOfExperience, coverLetter } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: "Resume file is required" });
      }
      
      // Get the listing to retrieve job poster's email
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing || listing.category !== 'job') {
        return res.status(404).json({ error: "Job listing not found" });
      }
      
      // CRITICAL: Validate email exists BEFORE creating application to avoid inconsistent state
      const listingOwner = await storage.getUser(listing.userId);
      const recipientEmail = listing.contactEmail || listingOwner?.email;
      
      if (!recipientEmail) {
        console.error(`No recipient email found for job listing ${listingId}. contactEmail: ${listing.contactEmail}, owner email: ${listingOwner?.email}`);
        return res.status(400).json({ 
          error: "Job listing does not have a contact email configured. Please contact the job poster to update their listing." 
        });
      }
      
      // Get authenticated user if logged in
      const applicantId = req.user ? req.user.claims.sub : null;
      
      // Validate application data
      const applicationData = insertJobApplicationSchema.parse({
        listingId,
        applicantId,
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        currentJobTitle: currentJobTitle || undefined,
        yearsOfExperience: yearsOfExperience || undefined,
        coverLetter: coverLetter || undefined,
        resumeUrl: `/uploads/documents/${req.file.filename}`,
      });
      
      // CRITICAL: Send email FIRST before creating application to ensure transactional consistency
      // If email fails, no application is saved (prevents orphaned applications + duplicate submissions)
      try {
        const { client, fromEmail } = await getUncachableResendClient();
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0066cc 0%, #004a99 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Job Application Received</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">
      You've received a new application for your job listing:
    </p>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #0066cc;">${listing.title}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${listing.location || 'Location not specified'}</p>
    </div>
    
    <div style="margin: 25px 0;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 15px 0; color: #374151;">Applicant Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Name:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${firstName} ${lastName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${email}</td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${phone}</td>
        </tr>
        ` : ''}
        ${currentJobTitle ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Current Job Title:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${currentJobTitle}</td>
        </tr>
        ` : ''}
        ${yearsOfExperience ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Years of Experience:</td>
          <td style="padding: 8px 0; font-weight: 500; font-size: 14px;">${yearsOfExperience}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${coverLetter ? `
    <div style="margin: 25px 0;">
      <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 10px 0; color: #374151;">Cover Letter</h3>
      <div style="background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 3px solid #0066cc;">
        <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${coverLetter}</p>
      </div>
    </div>
    ` : ''}
    
    <div style="margin: 30px 0; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Note:</strong> The applicant's resume has been uploaded to your Ready Set Fly dashboard. Log in to view the full application and resume.
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/marketplace/${listingId}` : 'https://readysetfly.com'}" 
         style="display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; font-size: 16px;">
        View Application
      </a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
        Ready Set Fly - Aviation Marketplace & Rental Platform
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
        `;
        
        console.log(`Sending job application email to: ${recipientEmail} for listing: ${listing.title}`);
        
        await client.emails.send({
          from: fromEmail,
          to: recipientEmail,
          subject: `Inquiry From Ready Set Fly about your Aviation Jobs Listing: ${listing.title}`,
          html: emailHtml,
        });
        
        console.log(`Job application email sent successfully to: ${recipientEmail}`);
        
        // Create application AFTER email sends successfully (transactional consistency)
        const application = await storage.createJobApplication(applicationData);
        
        res.json(application);
      } catch (emailError) {
        console.error(`CRITICAL: Failed to send job application email to ${recipientEmail}:`, emailError);
        // Email send failed, so don't create application (prevents orphaned records)
        return res.status(500).json({ 
          error: "Failed to send notification to job poster. Please try again or contact support@readysetfly.us" 
        });
      }
    } catch (error: any) {
      console.error('Job application error:', error);
      res.status(500).json({ error: error.message || "Failed to submit application" });
    }
  });

  // Get applications for a specific listing (job poster only)
  app.get("/api/job-applications/listing/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify user owns the listing
      const listing = await storage.getMarketplaceListing(req.params.listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view applications for this listing" });
      }
      
      const applications = await storage.getJobApplicationsByListing(req.params.listingId);
      res.json(applications);
    } catch (error) {
      console.error('Failed to fetch job applications:', error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // Get applications by applicant (user's own applications)
  app.get("/api/job-applications/applicant", isAuthenticated, async (req: any, res) => {
    try {
      const applicantId = req.user.claims.sub;
      const applications = await storage.getJobApplicationsByApplicant(applicantId);
      res.json(applications);
    } catch (error) {
      console.error('Failed to fetch user applications:', error);
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // Update application status (job poster only)
  app.patch("/api/job-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const application = await storage.getJobApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Verify user owns the listing
      const listing = await storage.getMarketplaceListing(application.listingId);
      if (!listing || listing.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this application" });
      }
      
      const updated = await storage.updateJobApplication(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Failed to update application:', error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  // Update current user's profile (authenticated)
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paypalEmail } = req.body;

      // Only allow updating specific safe fields
      const updateData: any = {};
      if (paypalEmail !== undefined) {
        updateData.paypalEmail = paypalEmail;
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Users/Profile
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging (active rentals only)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Validate rental exists and is active
        if (message.type === 'chat' && message.rentalId) {
          const rental = await storage.getRental(message.rentalId);
          
          if (!rental || rental.status !== 'active') {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Messaging only available for active rentals'
            }));
            return;
          }
          
          // Store message in backend
          await storage.createMessage({
            rentalId: message.rentalId,
            senderId: message.senderId,
            receiverId: message.receiverId || rental.ownerId, // Default to owner if not specified
            content: message.content,
          });
          
          // Broadcast to all connected clients (in production, filter by rental participants)
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'chat',
                rentalId: message.rentalId,
                senderId: message.senderId,
                content: message.content,
                timestamp: new Date(),
              }));
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  return httpServer;
}
