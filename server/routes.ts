import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertAircraftListingSchema, insertMarketplaceListingSchema, insertRentalSchema, insertMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Stripe payment intent endpoint (requires STRIPE_SECRET_KEY)
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, rentalId } = req.body;
      
      // TODO: Initialize Stripe when API keys are available
      // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      // const paymentIntent = await stripe.paymentIntents.create({
      //   amount: Math.round(amount * 100),
      //   currency: "usd",
      //   metadata: { rentalId },
      // });
      
      // For now, return mock client secret
      res.json({ 
        clientSecret: "mock_client_secret_" + Date.now(),
        message: "Stripe integration pending - API keys required"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Payment intent failed" });
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

  app.post("/api/aircraft", async (req, res) => {
    try {
      const validatedData = insertAircraftListingSchema.parse(req.body);
      const listing = await storage.createAircraftListing(validatedData);
      res.status(201).json(listing);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid aircraft data" });
    }
  });

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

  // Marketplace Listings
  app.get("/api/marketplace", async (req, res) => {
    try {
      const listings = await storage.getAllMarketplaceListings();
      res.json(listings);
    } catch (error) {
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

  app.post("/api/marketplace", async (req, res) => {
    try {
      const validatedData = insertMarketplaceListingSchema.parse(req.body);
      const listing = await storage.createMarketplaceListing(validatedData);
      res.status(201).json(listing);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid listing data" });
    }
  });

  app.patch("/api/marketplace/:id", async (req, res) => {
    try {
      const listing = await storage.updateMarketplaceListing(req.params.id, req.body);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(listing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update listing" });
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

  // Users/Profile
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      // Don't allow updating password through this endpoint
      const { password, ...updates } = req.body;
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
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
