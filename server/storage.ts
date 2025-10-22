import {
  type User,
  type UpsertUser,
  type InsertUser,
  type AircraftListing,
  type InsertAircraftListing,
  type MarketplaceListing,
  type InsertMarketplaceListing,
  type Rental,
  type InsertRental,
  type Message,
  type InsertMessage,
  type Transaction,
  users,
  aircraftListings,
  marketplaceListings,
  rentals,
  messages,
  transactions,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, or, ilike } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>; // REQUIRED for Replit Auth
  searchUsers(query: string): Promise<User[]>; // Admin search by name

  // Aircraft Listings
  getAircraftListing(id: string): Promise<AircraftListing | undefined>;
  getAllAircraftListings(): Promise<AircraftListing[]>;
  getAircraftListingsByOwner(ownerId: string): Promise<AircraftListing[]>;
  createAircraftListing(listing: InsertAircraftListing): Promise<AircraftListing>;
  updateAircraftListing(id: string, updates: Partial<AircraftListing>): Promise<AircraftListing | undefined>;
  deleteAircraftListing(id: string): Promise<boolean>;
  toggleAircraftListingStatus(id: string): Promise<AircraftListing | undefined>;

  // Marketplace Listings
  getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined>;
  getAllMarketplaceListings(): Promise<MarketplaceListing[]>;
  getMarketplaceListingsByCategory(category: string): Promise<MarketplaceListing[]>;
  getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined>;
  deleteMarketplaceListing(id: string): Promise<boolean>;

  // Rentals
  getRental(id: string): Promise<Rental | undefined>;
  getAllRentals(): Promise<Rental[]>;
  getRentalsByRenter(renterId: string): Promise<Rental[]>;
  getRentalsByOwner(ownerId: string): Promise<Rental[]>;
  getRentalsByAircraft(aircraftId: string): Promise<Rental[]>;
  createRental(rental: InsertRental): Promise<Rental>;
  updateRental(id: string, updates: Partial<Rental>): Promise<Rental | undefined>;
  
  // Messages
  getMessagesByRental(rentalId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message | undefined>;

  // Transactions
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async searchUsers(query: string): Promise<User[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        totalFlightHours: users.totalFlightHours,
        certifications: users.certifications,
        isVerified: users.isVerified,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        or(
          ilike(users.firstName, searchPattern),
          ilike(users.lastName, searchPattern),
          ilike(users.email, searchPattern)
        )
      )
      .limit(50);
  }

  // Aircraft Listings
  async getAircraftListing(id: string): Promise<AircraftListing | undefined> {
    const result = await db
      .select()
      .from(aircraftListings)
      .where(eq(aircraftListings.id, id))
      .limit(1);
    return result[0];
  }

  async getAllAircraftListings(): Promise<AircraftListing[]> {
    return await db
      .select()
      .from(aircraftListings)
      .where(eq(aircraftListings.isListed, true));
  }

  async getAircraftListingsByOwner(ownerId: string): Promise<AircraftListing[]> {
    return await db
      .select()
      .from(aircraftListings)
      .where(eq(aircraftListings.ownerId, ownerId));
  }

  async createAircraftListing(insertListing: InsertAircraftListing): Promise<AircraftListing> {
    const [listing] = await db
      .insert(aircraftListings)
      .values(insertListing)
      .returning();
    return listing;
  }

  async updateAircraftListing(id: string, updates: Partial<AircraftListing>): Promise<AircraftListing | undefined> {
    const [listing] = await db
      .update(aircraftListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aircraftListings.id, id))
      .returning();
    return listing;
  }

  async deleteAircraftListing(id: string): Promise<boolean> {
    const result = await db
      .delete(aircraftListings)
      .where(eq(aircraftListings.id, id))
      .returning();
    return result.length > 0;
  }

  async toggleAircraftListingStatus(id: string): Promise<AircraftListing | undefined> {
    const listing = await this.getAircraftListing(id);
    if (!listing) return undefined;
    
    const [updated] = await db
      .update(aircraftListings)
      .set({ 
        isListed: !listing.isListed,
        updatedAt: new Date()
      })
      .where(eq(aircraftListings.id, id))
      .returning();
    return updated;
  }

  // Marketplace Listings
  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    const result = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id))
      .limit(1);
    return result[0];
  }

  async getAllMarketplaceListings(): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.isActive, true));
  }

  async getMarketplaceListingsByCategory(category: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.category, category),
          eq(marketplaceListings.isActive, true)
        )
      );
  }

  async getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.userId, userId));
  }

  async createMarketplaceListing(insertListing: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const [listing] = await db
      .insert(marketplaceListings)
      .values(insertListing)
      .returning();
    return listing;
  }

  async updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .update(marketplaceListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return listing;
  }

  async deleteMarketplaceListing(id: string): Promise<boolean> {
    const result = await db
      .delete(marketplaceListings)
      .where(eq(marketplaceListings.id, id))
      .returning();
    return result.length > 0;
  }

  // Rentals
  async getRental(id: string): Promise<Rental | undefined> {
    const result = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, id))
      .limit(1);
    return result[0];
  }

  async getAllRentals(): Promise<Rental[]> {
    return await db.select().from(rentals);
  }

  async getRentalsByRenter(renterId: string): Promise<Rental[]> {
    return await db
      .select()
      .from(rentals)
      .where(eq(rentals.renterId, renterId));
  }

  async getRentalsByOwner(ownerId: string): Promise<Rental[]> {
    return await db
      .select()
      .from(rentals)
      .where(eq(rentals.ownerId, ownerId));
  }

  async getRentalsByAircraft(aircraftId: string): Promise<Rental[]> {
    return await db
      .select()
      .from(rentals)
      .where(eq(rentals.aircraftId, aircraftId));
  }

  async createRental(insertRental: InsertRental): Promise<Rental> {
    const hourlyRate = parseFloat(insertRental.hourlyRate);
    const estimatedHours = parseFloat(insertRental.estimatedHours);
    const baseCost = hourlyRate * estimatedHours;
    const platformFeeRenter = baseCost * 0.075;
    const platformFeeOwner = baseCost * 0.075;
    const totalCostRenter = baseCost + platformFeeRenter;
    const ownerPayout = baseCost - platformFeeOwner;

    const [rental] = await db
      .insert(rentals)
      .values({
        ...insertRental,
        baseCost: baseCost.toFixed(2),
        platformFeeRenter: platformFeeRenter.toFixed(2),
        platformFeeOwner: platformFeeOwner.toFixed(2),
        totalCostRenter: totalCostRenter.toFixed(2),
        ownerPayout: ownerPayout.toFixed(2),
      })
      .returning();
    return rental;
  }

  async updateRental(id: string, updates: Partial<Rental>): Promise<Rental | undefined> {
    const [rental] = await db
      .update(rentals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rentals.id, id))
      .returning();
    return rental;
  }

  // Messages
  async getMessagesByRental(rentalId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.rentalId, rentalId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  // Transactions
  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(insertTransaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }
}

export const storage = new DatabaseStorage();
