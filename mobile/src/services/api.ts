import axios, { AxiosResponse, AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { 
  AircraftListing, 
  MarketplaceListing, 
  Rental, 
  User,
  Message 
} from '@shared/schema';
import { TokenStorage } from '../utils/tokenStorage';
import { errorDiagnostic, logDiagnostic, warnDiagnostic } from '../utils/diagnostics';

// Backend API base URL - set EXPO_PUBLIC_API_URL in app config/env
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://readysetfly-api.onrender.com';

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function subscribeTokenRefresh(resolve: (token: string) => void, reject: (error: unknown) => void) {
  refreshSubscribers.push({ resolve, reject });
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((subscriber) => subscriber.resolve(token));
  refreshSubscribers = [];
}

function onTokenRefreshFailed(error: unknown) {
  refreshSubscribers.forEach((subscriber) => subscriber.reject(error));
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
    (config as InternalAxiosRequestConfig & { metadata?: { startedAt: number } }).metadata = {
      startedAt: Date.now(),
    };
    const token = await TokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    logDiagnostic('api', 'request', {
      method: config.method?.toUpperCase(),
      url: `${config.baseURL || ''}${config.url || ''}`,
    });
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh on 401
api.interceptors.response.use(
  (response) => {
    const metadata = (response.config as InternalAxiosRequestConfig & { metadata?: { startedAt: number } }).metadata;
    logDiagnostic('api', 'response', {
      method: response.config.method?.toUpperCase(),
      url: `${response.config.baseURL || ''}${response.config.url || ''}`,
      status: response.status,
      durationMs: metadata?.startedAt ? Date.now() - metadata.startedAt : undefined,
    });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    const metadata = (originalRequest as InternalAxiosRequestConfig & { metadata?: { startedAt: number } })?.metadata;

    warnDiagnostic('api', 'response_error', {
      method: originalRequest?.method?.toUpperCase(),
      url: `${originalRequest?.baseURL || ''}${originalRequest?.url || ''}`,
      status: error.response?.status,
      durationMs: metadata?.startedAt ? Date.now() - metadata.startedAt : undefined,
      code: error.code,
      message: error.message,
    });

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
          }, reject);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await TokenStorage.getRefreshToken();
        if (!refreshToken) {
          warnDiagnostic('auth', 'refresh_skipped_missing_refresh_token');
          isRefreshing = false;
          return Promise.reject(error);
        }

        // Try to refresh the token using unified auth endpoint
        logDiagnostic('auth', 'refresh_started');
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
        logDiagnostic('auth', 'refresh_succeeded');

        // Retry the original request
        return axios(originalRequest);
      } catch (refreshError) {
        const refreshStatus = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        const shouldClearTokens = refreshStatus === 400 || refreshStatus === 401 || refreshStatus === 403;
        if (shouldClearTokens) {
          await TokenStorage.clearTokens();
        }
        errorDiagnostic('auth', 'refresh_failed', {
          status: refreshStatus,
          shouldClearTokens,
          message: refreshError instanceof Error ? refreshError.message : String(refreshError),
        });
        onTokenRefreshFailed(refreshError);
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
    completePayment: (id: string, data: { orderId: string }): ApiResponse<Rental> => 
      api.post(`/api/rentals/${id}/complete-payment`, data),
    getMessages: (id: string): ApiResponse<Message[]> => 
      api.get(`/api/rentals/${id}/messages`),
  },
  
  // Marketplace
  marketplace: {
    getAll: (params?: { category?: string }): ApiResponse<MarketplaceListing[]> => 
      api.get('/api/marketplace', { params }),
    getById: (id: string): ApiResponse<MarketplaceListing> => 
      api.get(`/api/marketplace/${id}`),
    create: (data: Partial<MarketplaceListing>): ApiResponse<MarketplaceListing> => 
      api.post('/api/marketplace', data),
    completeCreate: (data: { orderId: string; listingData: Partial<MarketplaceListing> }): ApiResponse<MarketplaceListing> =>
      api.post('/api/marketplace/complete-create', data),
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

  membership: {
    syncStorePurchase: (data: {
      platform: 'ios' | 'android';
      customerInfo: {
        originalAppUserId?: string | null;
        activeEntitlementIds?: string[];
        activeProductIds?: string[];
        latestExpirationDate?: string | null;
        latestPurchaseDate?: string | null;
      };
    }): ApiResponse<User> => api.post('/api/auth/mobile-membership/sync', data),
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

  // Reviews
  reviews: {
    create: (data: { rentalId: string; revieweeId: string; rating: number; comment: string }): ApiResponse<any> =>
      api.post('/api/reviews', data),
    getByUser: (userId: string): ApiResponse<any[]> => api.get(`/api/reviews/user/${userId}`),
    getByRental: (rentalId: string): ApiResponse<any[]> => api.get(`/api/reviews/rental/${rentalId}`),
  },

  // Favorites
  favorites: {
    getAll: (): ApiResponse<{ marketplace: any[]; aircraft: any[] }> => api.get('/api/favorites'),
    check: (listingType: string, listingId: string): ApiResponse<{ isFavorited: boolean }> =>
      api.get(`/api/favorites/check/${listingType}/${listingId}`),
    toggle: (data: { listingType: string; listingId: string }): ApiResponse<{ action: string }> =>
      api.post('/api/favorites', data),
  },

  // Airport favorites + alerts
  airportFavorites: {
    getAll: (): ApiResponse<any[]> => api.get('/api/airports/favorites'),
    check: (icao: string): ApiResponse<{ isFavorited: boolean }> =>
      api.get(`/api/airports/favorites/check/${icao}`),
    add: (data: { icao: string; name?: string | null; city?: string | null; state?: string | null; alertIfr?: boolean; alertMvfr?: boolean }): ApiResponse<any> =>
      api.post('/api/airports/favorites', data),
    remove: (icao: string): ApiResponse<{ success: boolean }> =>
      api.delete(`/api/airports/favorites/${icao}`),
    updateAlerts: (icao: string, data: { alertIfr?: boolean; alertMvfr?: boolean }): ApiResponse<any> =>
      api.patch(`/api/airports/favorites/${icao}/alerts`, data),
  },
};

export default api;
