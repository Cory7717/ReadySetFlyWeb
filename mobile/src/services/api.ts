import axios, { AxiosResponse, AxiosError } from 'axios';
import type { 
  AircraftListing, 
  MarketplaceListing, 
  Rental, 
  User,
  Message 
} from '@shared/schema';
import { TokenStorage } from '../utils/tokenStorage';

// Backend API base URL - update this to your production URL when deploying
const API_BASE_URL = 'https://readysetfly.us';

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token to headers
api.interceptors.request.use(
  async (config) => {
    const token = await TokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await TokenStorage.getRefreshToken();
        if (!refreshToken) {
          // No refresh token, clear everything and reject
          await TokenStorage.clearTokens();
          isRefreshing = false;
          return Promise.reject(error);
        }

        // Try to refresh the token using unified auth endpoint
        const response = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        // Store new tokens
        await TokenStorage.setTokens(accessToken, newRefreshToken);
        
        // Update the authorization header
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Notify all subscribers
        onTokenRefreshed(accessToken);
        isRefreshing = false;

        // Retry the original request
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens
        await TokenStorage.clearTokens();
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Typed API response helper
type ApiResponse<T> = Promise<AxiosResponse<T>>;

// API endpoints with proper TypeScript types
export const apiEndpoints = {
  // Base URL for WebView payments
  baseURL: API_BASE_URL,
  
  // Unified Auth (JWT-based for both web and mobile)
  mobileAuth: {
    register: (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }): ApiResponse<{ user: User; accessToken: string; refreshToken: string }> =>
      api.post('/api/auth/register', data),
    
    login: (data: {
      email: string;
      password: string;
    }): ApiResponse<{ user: User; accessToken: string; refreshToken: string }> =>
      api.post('/api/auth/login', data),
    
    getMe: (): ApiResponse<User> => api.get('/api/auth/me'),
    
    refresh: (refreshToken: string): ApiResponse<{ accessToken: string; refreshToken: string }> =>
      api.post('/api/auth/refresh', { refreshToken }),
    
    logout: async (refreshToken: string): Promise<void> => {
      await api.post('/api/auth/logout', { refreshToken });
      await TokenStorage.clearTokens();
    },
  },

  // Web Auth (fallback - for compatibility)
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
    completePayment: (id: string, data: { paymentNonce: string; amount: number }): ApiResponse<Rental> => 
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
    upgrade: (id: string, newTier: string): ApiResponse<{ message: string; listing: MarketplaceListing; upgradeCost: number }> =>
      api.post(`/api/marketplace/${id}/upgrade`, { newTier }),
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

  // Withdrawals (PayPal Payouts)
  withdrawals: {
    getAll: (): ApiResponse<any[]> => api.get('/api/withdrawals'),
    create: (data: { amount: number; paypalEmail: string }): ApiResponse<any> => 
      api.post('/api/withdrawals', data),
  },

  // Promo Codes
  promoCodes: {
    validate: (data: { code: string; category?: string }): ApiResponse<{
      valid: boolean;
      description?: string;
      discountType?: string;
      message?: string;
    }> => api.post('/api/promo-codes/validate', data),
  },

  // Promo Alerts (Public - for displaying active promotions)
  promoAlerts: {
    getActive: (): ApiResponse<any[]> => api.get('/api/promo-alerts'),
  },
};

export default api;
