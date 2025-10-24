import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import OpenAI from "openai";
import Stripe from "stripe";
import { storage } from "./storage";
import { insertAircraftListingSchema, insertMarketplaceListingSchema, insertRentalSchema, insertMessageSchema, insertReviewSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";

// Initialize OpenAI client with Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Initialize Stripe client (from blueprint:javascript_stripe)
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// Verification middleware - checks if user is verified
const isVerified = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ 
        error: "Account verification required",
        message: "You must complete account verification before creating listings."
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

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

  // Auth routes (from blueprint:javascript_log_in_with_replit)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Grant Super Admin access to @readysetfly.us emails and coryarmer@gmail.com
      const email = user.email?.toLowerCase();
      const shouldBeSuperAdmin = 
        email?.endsWith('@readysetfly.us') || 
        email === 'coryarmer@gmail.com';
      
      // Update super admin status if needed
      if (shouldBeSuperAdmin && !user.isSuperAdmin) {
        await storage.updateUser(userId, { isSuperAdmin: true, isAdmin: true, isVerified: true });
        user = await storage.getUser(userId); // Refetch updated user
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Stripe payment intent endpoint for marketplace listing fees (from blueprint:javascript_stripe)
  app.post("/api/create-listing-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { category, tier } = req.body;
      const userId = req.user.claims.sub;
      
      if (!category) {
        return res.status(400).json({ error: "Missing category" });
      }
      
      // Server-side pricing calculation - NEVER trust client
      const TIER_PRICING: Record<string, number> = {
        basic: 25,
        standard: 100,
        premium: 250,
      };
      
      // Calculate amount server-side based on category and tier
      let amount: number;
      if (category === 'aircraft-sale' && tier) {
        amount = TIER_PRICING[tier] || 25;
      } else {
        amount = 25; // Fixed fee for other marketplace categories
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          userId,
          category,
          tier: tier || "basic",
          purpose: "marketplace_listing_fee",
          // Note: listingData is NOT stored here due to Stripe's 500-char metadata limit
          // The actual listing is created via POST /api/marketplace after payment succeeds
        },
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
      });
    } catch (error: any) {
      console.error("Stripe payment intent error:", error);
      res.status(500).json({ error: error.message || "Payment intent failed" });
    }
  });
  
  // Stripe payment intent endpoint for rental payments (requires STRIPE_SECRET_KEY)
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, rentalId } = req.body;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        metadata: { rentalId },
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Payment intent failed" });
    }
  });

  // AI Description Generation endpoint
  app.post("/api/generate-description", isAuthenticated, async (req, res) => {
    try {
      const { listingType, details } = req.body;
      
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
      console.error("AI description generation error:", error);
      res.status(500).json({ 
        error: "Failed to generate description",
        details: error.message 
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
      { name: 'registrationDoc', maxCount: 1 },
      { name: 'llcAuthorization', maxCount: 1 },
      { name: 'annualInspectionDoc', maxCount: 1 },
      { name: 'hour100InspectionDoc', maxCount: 1 },
      { name: 'maintenanceTrackingDoc', maxCount: 1 },
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
        const registrationDocUrl = hasFiles && files.registrationDoc ? `/uploads/reg-doc-${userId}-${timestamp}.pdf` : null;
        const llcAuthorizationUrl = hasFiles && files.llcAuthorization ? `/uploads/llc-auth-${userId}-${timestamp}.pdf` : null;
        const annualInspectionDocUrl = hasFiles && files.annualInspectionDoc ? `/uploads/annual-${userId}-${timestamp}.pdf` : null;
        const hour100InspectionDocUrl = hasFiles && files.hour100InspectionDoc ? `/uploads/100hr-${userId}-${timestamp}.pdf` : null;
        const maintenanceTrackingDocUrl = hasFiles && files.maintenanceTrackingDoc ? `/uploads/maintenance-${userId}-${timestamp}.pdf` : null;
        
        // Collect all non-null document URLs for verification submission
        const docUrls = [
          registrationDocUrl,
          llcAuthorizationUrl,
          annualInspectionDocUrl,
          hour100InspectionDocUrl,
          maintenanceTrackingDocUrl
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
          registrationDocUrl,
          llcAuthorizationUrl,
          annualInspectionDocUrl,
          hour100InspectionDocUrl,
          maintenanceTrackingDocUrl,
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
          });
        }
        
        res.status(201).json(listing);
      } catch (error: any) {
        console.error("Create aircraft listing error:", error);
        res.status(400).json({ error: error.message || "Invalid aircraft data" });
      }
    }
  );

  app.patch("/api/aircraft/:id", async (req, res) => {
    try {
      const listing = await storage.updateAircraftListing(req.params.id, req.body);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update aircraft" });
    }
  });

  app.post("/api/aircraft/:id/toggle", async (req, res) => {
    try {
      const listing = await storage.toggleAircraftListingStatus(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle aircraft status" });
    }
  });

  app.delete("/api/aircraft/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAircraftListing(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Aircraft not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete aircraft" });
    }
  });

  // Marketplace Listings with filtering
  app.get("/api/marketplace", async (req, res) => {
    try {
      const { city, category, minPrice, maxPrice, engineType } = req.query;
      
      // If no filters provided, use the old method
      if (!city && !category && !minPrice && !maxPrice && !engineType) {
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

  app.get("/api/marketplace/:id", async (req, res) => {
    try {
      const listing = await storage.getMarketplaceListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // Promo code validation
  app.post("/api/promo-codes/validate", isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.body;
      // For now, accept "LAUNCH2025" as a valid free 7-day promo code
      if (code && code.toUpperCase() === "LAUNCH2025") {
        return res.json({ 
          valid: true, 
          description: "Free 7-day marketplace listing!",
          discountType: "free_7_day",
        });
      }
      res.json({ valid: false, message: "Invalid promo code" });
    } catch (error: any) {
      console.error("Promo code validation error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate promo code" });
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
      // Regular users must have a paid payment intent
      else if (paymentIntentId) {
        // Verify payment was successful
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          return res.status(402).json({ 
            error: "Payment required",
            message: "Payment has not been completed. Please complete your payment first."
          });
        }
        
        // Verify the payment matches the user
        if (paymentIntent.metadata.userId !== userId) {
          return res.status(403).json({ 
            error: "Unauthorized",
            message: "Payment verification failed"
          });
        }
        
        // Calculate monthlyFee from payment amount (convert from cents)
        monthlyFee = paymentIntent.amount / 100;
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

  app.delete("/api/marketplace/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMarketplaceListing(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete listing" });
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

  app.post("/api/rentals", async (req, res) => {
    try {
      const validatedData = insertRentalSchema.parse(req.body);
      const rental = await storage.createRental(validatedData);
      res.status(201).json(rental);
    } catch (error: any) {
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
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: "Payment intent ID required" });
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

      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ error: "Payment not completed" });
      }

      // Verify the payment amount matches the rental cost
      const expectedAmount = Math.round(parseFloat(rental.totalCostRenter) * 100);
      if (paymentIntent.amount !== expectedAmount) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      // Verify the rentalId in metadata matches
      if (paymentIntent.metadata.rentalId !== rental.id) {
        return res.status(400).json({ error: "Payment intent does not match this rental" });
      }

      // Update rental to mark as paid and active
      const updatedRental = await storage.updateRental(req.params.id, {
        isPaid: true,
        status: "active",
      });

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
      { name: 'selfie', maxCount: 1 },
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
        if (files.selfie) {
          documentUrls.push(`/uploads/selfie-${userId}-${Date.now()}.jpg`);
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

  // Admin Analytics
  app.get("/api/admin/analytics", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
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
