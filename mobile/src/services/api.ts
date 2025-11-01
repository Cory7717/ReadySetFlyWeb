import axios from 'axios';

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

// API endpoints
export const apiEndpoints = {
  // Auth
  auth: {
    getUser: () => api.get('/api/auth/user'),
    login: () => `${API_BASE_URL}/api/login`,
    logout: () => api.post('/api/logout'),
  },
  
  // Aircraft
  aircraft: {
    getAll: () => api.get('/api/aircraft'),
    getById: (id: string) => api.get(`/api/aircraft/${id}`),
    create: (data: any) => api.post('/api/aircraft', data),
    update: (id: string, data: any) => api.patch(`/api/aircraft/${id}`, data),
    delete: (id: string) => api.delete(`/api/aircraft/${id}`),
  },
  
  // Rentals
  rentals: {
    create: (data: any) => api.post('/api/rentals', data),
    getByUser: () => api.get('/api/user/rentals'),
    getById: (id: string) => api.get(`/api/rentals/${id}`),
    approve: (id: string) => api.patch(`/api/rentals/${id}/approve`),
    completePayment: (id: string, data: any) => api.post(`/api/rentals/${id}/complete-payment`, data),
  },
  
  // Marketplace
  marketplace: {
    getAll: (params?: any) => api.get('/api/marketplace', { params }),
    getById: (id: string) => api.get(`/api/marketplace/${id}`),
    create: (data: any) => api.post('/api/marketplace', data),
    update: (id: string, data: any) => api.patch(`/api/marketplace/${id}`, data),
    delete: (id: string) => api.delete(`/api/marketplace/${id}`),
  },
  
  // User
  user: {
    getProfile: () => api.get('/api/user/profile'),
    updateProfile: (data: any) => api.patch('/api/user/profile', data),
    getBalance: () => api.get('/api/user/balance'),
  },
  
  // Messages
  messages: {
    getByRental: (rentalId: string) => api.get(`/api/rentals/${rentalId}/messages`),
    send: (rentalId: string, content: string) => api.post(`/api/rentals/${rentalId}/messages`, { content }),
  },
};

export default api;
