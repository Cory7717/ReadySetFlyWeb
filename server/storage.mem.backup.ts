import {
  type User,
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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private aircraftListings: Map<string, AircraftListing>;
  private marketplaceListings: Map<string, MarketplaceListing>;
  private rentals: Map<string, Rental>;
  private messages: Map<string, Message>;
  private transactions: Map<string, Transaction>;

  constructor() {
    this.users = new Map();
    this.aircraftListings = new Map();
    this.marketplaceListings = new Map();
    this.rentals = new Map();
    this.messages = new Map();
    this.transactions = new Map();
    this.seedData();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      avatarUrl: insertUser.avatarUrl || null,
      phone: insertUser.phone || null,
      aircraftTypesFlown: insertUser.aircraftTypesFlown || [],
      isVerified: insertUser.isVerified || false,
      licenseVerified: insertUser.licenseVerified || false,
      backgroundCheckCompleted: insertUser.backgroundCheckCompleted || false,
      bankAccountConnected: insertUser.bankAccountConnected || false,
      stripeAccountId: insertUser.stripeAccountId || null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  // Aircraft Listings
  async getAircraftListing(id: string): Promise<AircraftListing | undefined> {
    return this.aircraftListings.get(id);
  }

  async getAllAircraftListings(): Promise<AircraftListing[]> {
    return Array.from(this.aircraftListings.values()).filter(listing => listing.isListed);
  }

  async getAircraftListingsByOwner(ownerId: string): Promise<AircraftListing[]> {
    return Array.from(this.aircraftListings.values()).filter(
      (listing) => listing.ownerId === ownerId
    );
  }

  async createAircraftListing(insertListing: InsertAircraftListing): Promise<AircraftListing> {
    const id = randomUUID();
    const listing: AircraftListing = {
      ...insertListing,
      id,
      engine: insertListing.engine || null,
      avionicsSuite: insertListing.avionicsSuite || null,
      airportCode: insertListing.airportCode || null,
      description: insertListing.description || null,
      isListed: insertListing.isListed ?? true,
      responseTime: insertListing.responseTime || 24,
      acceptanceRate: insertListing.acceptanceRate || 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.aircraftListings.set(id, listing);
    return listing;
  }

  async updateAircraftListing(id: string, updates: Partial<AircraftListing>): Promise<AircraftListing | undefined> {
    const listing = this.aircraftListings.get(id);
    if (!listing) return undefined;
    const updated = { ...listing, ...updates, updatedAt: new Date() };
    this.aircraftListings.set(id, updated);
    return updated;
  }

  async deleteAircraftListing(id: string): Promise<boolean> {
    return this.aircraftListings.delete(id);
  }

  async toggleAircraftListingStatus(id: string): Promise<AircraftListing | undefined> {
    const listing = this.aircraftListings.get(id);
    if (!listing) return undefined;
    const updated = { ...listing, isListed: !listing.isListed, updatedAt: new Date() };
    this.aircraftListings.set(id, updated);
    return updated;
  }

  // Marketplace Listings
  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    return this.marketplaceListings.get(id);
  }

  async getAllMarketplaceListings(): Promise<MarketplaceListing[]> {
    return Array.from(this.marketplaceListings.values()).filter(
      listing => listing.isActive
    );
  }

  async getMarketplaceListingsByCategory(category: string): Promise<MarketplaceListing[]> {
    return Array.from(this.marketplaceListings.values()).filter(
      (listing) => listing.category === category && listing.isActive
    );
  }

  async getMarketplaceListingsByUser(userId: string): Promise<MarketplaceListing[]> {
    return Array.from(this.marketplaceListings.values()).filter(
      (listing) => listing.userId === userId
    );
  }

  async createMarketplaceListing(insertListing: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const id = randomUUID();
    const listing: MarketplaceListing = {
      ...insertListing,
      id,
      tier: insertListing.tier || null,
      images: insertListing.images || [],
      location: insertListing.location || null,
      contactEmail: insertListing.contactEmail || null,
      contactPhone: insertListing.contactPhone || null,
      details: insertListing.details || null,
      price: insertListing.price || null,
      isActive: insertListing.isActive ?? true,
      expiresAt: insertListing.expiresAt || null,
      isPaid: insertListing.isPaid || false,
      monthlyFee: insertListing.monthlyFee || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.marketplaceListings.set(id, listing);
    return listing;
  }

  async updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined> {
    const listing = this.marketplaceListings.get(id);
    if (!listing) return undefined;
    const updated = { ...listing, ...updates, updatedAt: new Date() };
    this.marketplaceListings.set(id, updated);
    return updated;
  }

  async deleteMarketplaceListing(id: string): Promise<boolean> {
    return this.marketplaceListings.delete(id);
  }

  // Rentals
  async getRental(id: string): Promise<Rental | undefined> {
    return this.rentals.get(id);
  }

  async getAllRentals(): Promise<Rental[]> {
    return Array.from(this.rentals.values());
  }

  async getRentalsByRenter(renterId: string): Promise<Rental[]> {
    return Array.from(this.rentals.values()).filter(
      (rental) => rental.renterId === renterId
    );
  }

  async getRentalsByOwner(ownerId: string): Promise<Rental[]> {
    return Array.from(this.rentals.values()).filter(
      (rental) => rental.ownerId === ownerId
    );
  }

  async getRentalsByAircraft(aircraftId: string): Promise<Rental[]> {
    return Array.from(this.rentals.values()).filter(
      (rental) => rental.aircraftId === aircraftId
    );
  }

  async createRental(insertRental: InsertRental): Promise<Rental> {
    const id = randomUUID();
    
    // Calculate fees
    const hourlyRate = parseFloat(insertRental.hourlyRate);
    const estimatedHours = parseFloat(insertRental.estimatedHours);
    const baseCost = hourlyRate * estimatedHours;
    const platformFeeRenter = baseCost * 0.075; // 7.5%
    const platformFeeOwner = baseCost * 0.075; // 7.5%
    const totalCostRenter = baseCost + platformFeeRenter;
    const ownerPayout = baseCost - platformFeeOwner;

    const rental: Rental = {
      ...insertRental,
      id,
      actualHours: null,
      baseCost: baseCost.toFixed(2),
      platformFeeRenter: platformFeeRenter.toFixed(2),
      platformFeeOwner: platformFeeOwner.toFixed(2),
      totalCostRenter: totalCostRenter.toFixed(2),
      ownerPayout: ownerPayout.toFixed(2),
      status: "pending",
      isPaid: false,
      payoutCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rentals.set(id, rental);
    return rental;
  }

  async updateRental(id: string, updates: Partial<Rental>): Promise<Rental | undefined> {
    const rental = this.rentals.get(id);
    if (!rental) return undefined;
    const updated = { ...rental, ...updates, updatedAt: new Date() };
    this.rentals.set(id, updated);
    return updated;
  }

  // Messages
  async getMessagesByRental(rentalId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.rentalId === rentalId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      isRead: false,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    const updated = { ...message, isRead: true };
    this.messages.set(id, updated);
    return updated;
  }

  // Transactions
  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createTransaction(insertTransaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      rentalId: insertTransaction.rentalId || null,
      marketplaceListingId: insertTransaction.marketplaceListingId || null,
      depositedToBankAt: insertTransaction.depositedToBankAt || null,
      description: insertTransaction.description || null,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    const updated = { ...transaction, ...updates };
    this.transactions.set(id, updated);
    return updated;
  }

  private seedData() {
    // Create mock users
    const user1Id = randomUUID();
    const user2Id = randomUUID();
    const user3Id = randomUUID();
    
    this.users.set(user1Id, {
      id: user1Id,
      email: "john.smith@example.com",
      password: "hashed_password_1",
      name: "John Smith",
      phone: "+1 (555) 123-4567",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
      certifications: ["PPL", "IR", "CPL", "Multi-Engine"],
      totalFlightHours: 2500,
      aircraftTypesFlown: ["Cessna 172", "Cessna 182", "Piper Cherokee", "Cirrus SR22"],
      isVerified: true,
      licenseVerified: true,
      backgroundCheckCompleted: true,
      bankAccountConnected: true,
      stripeAccountId: "acct_1234567890",
      createdAt: new Date("2023-01-15"),
    });

    this.users.set(user2Id, {
      id: user2Id,
      email: "sarah.johnson@example.com",
      password: "hashed_password_2",
      name: "Sarah Johnson",
      phone: "+1 (555) 234-5678",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
      certifications: ["PPL", "IR"],
      totalFlightHours: 850,
      aircraftTypesFlown: ["Cessna 172", "Diamond DA40"],
      isVerified: true,
      licenseVerified: true,
      backgroundCheckCompleted: true,
      bankAccountConnected: false,
      stripeAccountId: null,
      createdAt: new Date("2023-06-20"),
    });

    this.users.set(user3Id, {
      id: user3Id,
      email: "mike.davis@example.com",
      password: "hashed_password_3",
      name: "Mike Davis",
      phone: "+1 (555) 345-6789",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
      certifications: ["PPL", "IR", "CPL", "Multi-Engine", "ATP"],
      totalFlightHours: 5200,
      aircraftTypesFlown: ["Cessna 172", "Cessna 182", "Beechcraft Baron", "Citation"],
      isVerified: true,
      licenseVerified: true,
      backgroundCheckCompleted: true,
      bankAccountConnected: true,
      stripeAccountId: "acct_0987654321",
      createdAt: new Date("2022-09-10"),
    });

    // Create mock aircraft listings
    const aircraft1Id = randomUUID();
    const aircraft2Id = randomUUID();
    const aircraft3Id = randomUUID();
    const aircraft4Id = randomUUID();
    const aircraft5Id = randomUUID();
    const aircraft6Id = randomUUID();

    this.aircraftListings.set(aircraft1Id, {
      id: aircraft1Id,
      ownerId: user1Id,
      make: "Cessna",
      model: "172 Skyhawk",
      year: 2018,
      registration: "N12345",
      category: "Single-Engine",
      totalTime: 2500,
      engine: "Lycoming IO-360",
      avionicsSuite: "Garmin G1000",
      requiredCertifications: ["PPL"],
      minFlightHours: 100,
      hourlyRate: "145.00",
      insuranceIncluded: true,
      wetRate: true,
      images: [
        "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800",
        "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&h=600&fit=crop&crop=entropy&seed=1",
        "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&h=600&fit=crop&crop=entropy&seed=2",
      ],
      location: "Santa Monica, CA",
      airportCode: "SMO",
      description: "Beautiful 2018 Cessna 172S Skyhawk equipped with the Garmin G1000 glass cockpit. Perfect for training and cross-country flights. Always hangared, fresh annual.",
      isListed: true,
      responseTime: 12,
      acceptanceRate: 95,
      createdAt: new Date("2023-03-01"),
      updatedAt: new Date("2024-01-10"),
    });

    this.aircraftListings.set(aircraft2Id, {
      id: aircraft2Id,
      ownerId: user1Id,
      make: "Cirrus",
      model: "SR22",
      year: 2020,
      registration: "N99999",
      category: "Single-Engine",
      totalTime: 850,
      engine: "Continental IO-550",
      avionicsSuite: "Garmin Perspective+",
      requiredCertifications: ["PPL", "IR"],
      minFlightHours: 250,
      hourlyRate: "295.00",
      insuranceIncluded: true,
      wetRate: true,
      images: [
        "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=800",
      ],
      location: "Van Nuys, CA",
      airportCode: "VNY",
      description: "Low-time 2020 Cirrus SR22 with all the latest avionics. FIKI equipped, air conditioning, leather interior. Transition training available.",
      isListed: true,
      responseTime: 8,
      acceptanceRate: 98,
      createdAt: new Date("2023-08-15"),
      updatedAt: new Date("2024-01-15"),
    });

    this.aircraftListings.set(aircraft3Id, {
      id: aircraft3Id,
      ownerId: user3Id,
      make: "Piper",
      model: "Cherokee 180",
      year: 2015,
      registration: "N54321",
      category: "Single-Engine",
      totalTime: 3200,
      engine: "Lycoming O-360",
      avionicsSuite: "Garmin G500",
      requiredCertifications: ["PPL"],
      minFlightHours: 75,
      hourlyRate: "125.00",
      insuranceIncluded: true,
      wetRate: true,
      images: [
        "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=800",
      ],
      location: "Burbank, CA",
      airportCode: "BUR",
      description: "Reliable Piper Cherokee 180. Great for time building and cross-country flights. Well-maintained and always available.",
      isListed: true,
      responseTime: 24,
      acceptanceRate: 90,
      createdAt: new Date("2023-05-10"),
      updatedAt: new Date("2024-01-08"),
    });

    this.aircraftListings.set(aircraft4Id, {
      id: aircraft4Id,
      ownerId: user3Id,
      make: "Cessna",
      model: "182 Skylane",
      year: 2017,
      registration: "N77777",
      category: "Single-Engine",
      totalTime: 1800,
      engine: "Lycoming IO-540",
      avionicsSuite: "Garmin G1000",
      requiredCertifications: ["PPL"],
      minFlightHours: 150,
      hourlyRate: "185.00",
      insuranceIncluded: true,
      wetRate: true,
      images: [
        "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800",
      ],
      location: "Long Beach, CA",
      airportCode: "LGB",
      description: "Powerful Cessna 182 Skylane with G1000. Perfect for mountain flying and heavy loads. Always professionally maintained.",
      isListed: true,
      responseTime: 18,
      acceptanceRate: 92,
      createdAt: new Date("2023-07-01"),
      updatedAt: new Date("2024-01-12"),
    });

    this.aircraftListings.set(aircraft5Id, {
      id: aircraft5Id,
      ownerId: user2Id,
      make: "Diamond",
      model: "DA40",
      year: 2019,
      registration: "N11111",
      category: "Single-Engine",
      totalTime: 950,
      engine: "Lycoming IO-360",
      avionicsSuite: "Garmin G1000 NXi",
      requiredCertifications: ["PPL"],
      minFlightHours: 100,
      hourlyRate: "165.00",
      insuranceIncluded: true,
      wetRate: true,
      images: [
        "https://images.unsplash.com/photo-1583427053324-c19f9b3a8394?w=800",
      ],
      location: "Santa Barbara, CA",
      airportCode: "SBA",
      description: "Modern Diamond DA40 with NXi avionics. Excellent visibility and fuel efficiency. Great for training and touring.",
      isListed: true,
      responseTime: 16,
      acceptanceRate: 94,
      createdAt: new Date("2023-09-20"),
      updatedAt: new Date("2024-01-14"),
    });

    this.aircraftListings.set(aircraft6Id, {
      id: aircraft6Id,
      ownerId: user2Id,
      make: "Beechcraft",
      model: "Baron 58",
      year: 2016,
      registration: "N22222",
      category: "Multi-Engine",
      totalTime: 2100,
      engine: "Continental IO-550",
      avionicsSuite: "Garmin G500",
      requiredCertifications: ["PPL", "Multi-Engine"],
      minFlightHours: 500,
      hourlyRate: "425.00",
      insuranceIncluded: true,
      wetRate: true,
      images: [
        "https://images.unsplash.com/photo-1583427053324-c19f9b3a8394?w=800",
      ],
      location: "San Diego, CA",
      airportCode: "MYF",
      description: "Beautiful Beechcraft Baron 58. Twin engine performance with G500 avionics. Perfect for multi-engine training and cross-country travel.",
      isListed: false,
      responseTime: 24,
      acceptanceRate: 88,
      createdAt: new Date("2023-04-05"),
      updatedAt: new Date("2024-01-05"),
    });

    // Create mock marketplace listings
    const marketplace1Id = randomUUID();
    const marketplace2Id = randomUUID();
    const marketplace3Id = randomUUID();

    this.marketplaceListings.set(marketplace1Id, {
      id: marketplace1Id,
      userId: user1Id,
      category: "aircraft-sale",
      tier: "premium",
      title: "2015 Cessna 172S Skyhawk",
      description: "Excellent condition, low hours, always hangared. Equipped with Garmin G1000 avionics suite. Fresh annual inspection. Meticulously maintained logbooks.",
      images: [
        "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800",
        "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&h=600&fit=crop&crop=entropy&seed=3",
        "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&h=600&fit=crop&crop=entropy&seed=4",
      ],
      location: "Van Nuys, CA",
      contactEmail: "john.smith@example.com",
      contactPhone: "+1 (555) 123-4567",
      details: {
        year: 2015,
        totalTime: 2100,
        engine: "Lycoming IO-360",
        registration: "N98765",
      },
      price: "285000.00",
      isActive: true,
      expiresAt: new Date("2024-04-01"),
      isPaid: true,
      monthlyFee: "125.00",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    this.marketplaceListings.set(marketplace2Id, {
      id: marketplace2Id,
      userId: user3Id,
      category: "cfi",
      tier: null,
      title: "CFI/CFII - Instrument Training Specialist",
      description: "10+ years experience. Specializing in instrument ratings and commercial training. Patient, professional instruction. References available.",
      images: [
        "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=800",
      ],
      location: "Los Angeles, CA",
      contactEmail: "mike.davis@example.com",
      contactPhone: "+1 (555) 345-6789",
      details: {
        certifications: ["CFI", "CFII", "MEI"],
        specializations: ["Instrument", "Commercial", "Multi-Engine"],
      },
      price: "75.00",
      isActive: true,
      expiresAt: new Date("2024-02-15"),
      isPaid: true,
      monthlyFee: "40.00",
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    });

    this.marketplaceListings.set(marketplace3Id, {
      id: marketplace3Id,
      userId: user2Id,
      category: "job",
      tier: null,
      title: "First Officer - Part 135 Operations",
      description: "Regional charter operator seeking experienced FO. Citation type rating preferred. Competitive salary and benefits. Based in Southern California.",
      images: [],
      location: "San Diego, CA",
      contactEmail: "sarah.johnson@example.com",
      contactPhone: "+1 (555) 234-5678",
      details: {
        minHours: 1500,
        requiredCertifications: ["CPL", "IR"],
        preferredTypeRating: "Citation",
      },
      price: "75000.00",
      isActive: true,
      expiresAt: new Date("2024-02-28"),
      isPaid: true,
      monthlyFee: "25.00",
      createdAt: new Date("2024-01-10"),
      updatedAt: new Date("2024-01-10"),
    });
  }
}

export const storage = new MemStorage();
