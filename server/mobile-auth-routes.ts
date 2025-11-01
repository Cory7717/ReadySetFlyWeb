import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { IStorage } from './storage';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyAccessToken,
  getRefreshTokenExpiry 
} from './jwt';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

/**
 * POST /api/mobile/auth/register
 * Register a new user with email/password
 */
export function registerMobileAuthRoutes(storage: IStorage) {
  router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: result.error.format() 
        });
        return;
      }

      const { email, password, firstName, lastName } = result.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }

      // Hash password with bcrypt (cost factor 12)
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await storage.createUser({
        email,
        firstName,
        lastName,
        hashedPassword,
        passwordCreatedAt: new Date(),
        certifications: [],
        totalFlightHours: 0,
      });

      // Generate tokens
      const accessToken = generateAccessToken(user.id, user.email!);
      const refreshToken = generateRefreshToken();
      
      // Store refresh token in database
      await storage.createRefreshToken({
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
      });

      // Return tokens and user data (excluding password)
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(201).json({
        user: userResponse,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  /**
   * POST /api/mobile/auth/login
   * Login with email/password
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: result.error.format() 
        });
        return;
      }

      const { email, password } = result.data;

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || !user.hashedPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.hashedPassword);
      if (!passwordValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Check if account is suspended
      if (user.isSuspended) {
        res.status(403).json({ 
          error: 'Account suspended', 
          reason: user.suspensionReason || 'Your account has been suspended' 
        });
        return;
      }

      // Generate tokens
      const accessToken = generateAccessToken(user.id, user.email!);
      const refreshToken = generateRefreshToken();
      
      // Store refresh token in database
      await storage.createRefreshToken({
        userId: user.id,
        token: refreshToken,
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
      });

      // Return tokens and user data (excluding password)
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(200).json({
        user: userResponse,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  });

  /**
   * POST /api/mobile/auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const result = refreshSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: result.error.format() 
        });
        return;
      }

      const { refreshToken: token } = result.data;

      // Find refresh token in database
      const storedToken = await storage.getRefreshToken(token);
      if (!storedToken) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        // Delete expired token
        await storage.deleteRefreshToken(token);
        res.status(401).json({ error: 'Refresh token expired' });
        return;
      }

      // Get user
      const user = await storage.getUser(storedToken.userId);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      // Check if account is suspended
      if (user.isSuspended) {
        res.status(403).json({ 
          error: 'Account suspended', 
          reason: user.suspensionReason || 'Your account has been suspended' 
        });
        return;
      }

      // Delete old refresh token
      await storage.deleteRefreshToken(token);

      // Generate new tokens (token rotation for security)
      const newAccessToken = generateAccessToken(user.id, user.email!);
      const newRefreshToken = generateRefreshToken();
      
      // Store new refresh token
      await storage.createRefreshToken({
        userId: user.id,
        token: newRefreshToken,
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
      });

      // Return new tokens
      res.status(200).json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  /**
   * POST /api/mobile/auth/logout
   * Logout and invalidate refresh token
   */
  router.post('/logout', async (req: Request, res: Response): Promise<void> => {
    try {
      const result = refreshSchema.safeParse(req.body);
      if (result.success) {
        // Delete the specific refresh token
        await storage.deleteRefreshToken(result.data.refreshToken);
      }
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  return router;
}

export default registerMobileAuthRoutes;
