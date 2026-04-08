import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@shared/schema';

const AUTH_USER_CACHE_KEY = 'rsf.auth.user';

export const AuthSessionCache = {
  async setUser(user: User | null): Promise<void> {
    if (!user) {
      await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
      return;
    }
    await AsyncStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<User | null> {
    const raw = await AsyncStorage.getItem(AUTH_USER_CACHE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
      return null;
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
  },
};
