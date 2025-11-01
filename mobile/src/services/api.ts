import axios, { AxiosResponse } from 'axios';
import type { 
  AircraftListing, 
  MarketplaceListing, 
  Rental, 
  User,
  Message 
} from '@shared/schema';

// Backend API base URL - update this to your production URL when deploying
const API_BASE_URL = 'https://readysetfly.us';

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for session management
});

// Typed API response helper
type ApiResponse<T> = Promise<AxiosResponse<T>>;

// API endpoints with proper TypeScript types
export const apiEndpoints = {
  // Auth
  auth: {
    getUser: (): ApiResponse<User | null> => api.get('/api/auth/user'),
    login: () => `${API_BASE_URL}/api/login`,
    logout: (): ApiResponse<void> => api.post('/api/logout'),
  },
  
  // Aircraft
  aircraft: {
    getAll: (): ApiResponse<AircraftListing[]> => api.get('/api/aircraft'),
    getById: (id: string): ApiResponse<AircraftListing> => api.get(`/api/aircraft/${id}`),
    create: (data: Partial<AircraftListing>): ApiResponse<AircraftListing> => 
      api.post('/api/aircraft', data),
    update: (id: string, data: Partial<AircraftListing>): ApiResponse<AircraftListing> => 
      api.patch(`/api/aircraft/${id}`, data),
    delete: (id: string): ApiResponse<void> => api.delete(`/api/aircraft/${id}`),
  },
  
  // Rentals
  rentals: {
    create: (data: Partial<Rental>): ApiResponse<Rental> => 
      api.post('/api/rentals', data),
    getByUser: (): ApiResponse<Rental[]> => api.get('/api/user/rentals'),
    getById: (id: string): ApiResponse<Rental> => api.get(`/api/rentals/${id}`),
    approve: (id: string): ApiResponse<Rental> => api.patch(`/api/rentals/${id}/approve`),
    completePayment: (id: string, data: { nonce: string }): ApiResponse<Rental> => 
      api.post(`/api/rentals/${id}/complete-payment`, data),
  },
  
  // Marketplace
  marketplace: {
    getAll: (params?: { category?: string }): ApiResponse<MarketplaceListing[]> => 
      api.get('/api/marketplace', { params }),
    getById: (id: string): ApiResponse<MarketplaceListing> => 
      api.get(`/api/marketplace/${id}`),
    create: (data: Partial<MarketplaceListing>): ApiResponse<MarketplaceListing> => 
      api.post('/api/marketplace', data),
    update: (id: string, data: Partial<MarketplaceListing>): ApiResponse<MarketplaceListing> => 
      api.patch(`/api/marketplace/${id}`, data),
    delete: (id: string): ApiResponse<void> => api.delete(`/api/marketplace/${id}`),
  },
  
  // User
  user: {
    getProfile: (): ApiResponse<User> => api.get('/api/user/profile'),
    updateProfile: (data: Partial<User>): ApiResponse<User> => 
      api.patch('/api/user/profile', data),
    getBalance: (): ApiResponse<{ balance: number }> => api.get('/api/user/balance'),
  },
  
  // Messages
  messages: {
    getByRental: (rentalId: string): ApiResponse<Message[]> => 
      api.get(`/api/rentals/${rentalId}/messages`),
    send: (rentalId: string, content: string): ApiResponse<Message> => 
      api.post(`/api/rentals/${rentalId}/messages`, { content }),
  },
};

export default api;
