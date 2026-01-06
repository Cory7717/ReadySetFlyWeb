import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get API URL from environment or use local development
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const initializeSocket = async () => {
  if (socket?.connected) {
    return socket;
  }

  try {
    // Get authentication token
    const token = await AsyncStorage.getItem('auth_token');

    socket = io(API_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return socket;
  } catch (error) {
    console.error('Failed to initialize socket:', error);
    return null;
  }
};

export const getSocket = () => {
  if (!socket) {
    console.warn('Socket not initialized. Call initializeSocket() first.');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinRentalRoom = (rentalId: string) => {
  if (socket?.connected) {
    socket.emit('join-rental', rentalId);
  }
};

export const leaveRentalRoom = (rentalId: string) => {
  if (socket?.connected) {
    socket.emit('leave-rental', rentalId);
  }
};

export const sendMessage = (rentalId: string, message: string) => {
  if (socket?.connected) {
    socket.emit('rental-message', { rentalId, message });
  }
};

export const onMessage = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('rental-message', callback);
  }
};

export const offMessage = () => {
  if (socket) {
    socket.off('rental-message');
  }
};
