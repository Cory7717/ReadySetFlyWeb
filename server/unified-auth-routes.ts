import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { IStorage } from './storage';
import { generateAccessToken, generateRefreshToken, verifyAccessToken } from './jwt';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Helper function to get refresh token expiry (7 days from now)
function getRefreshTokenExpiry(): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  return expiryDate;
}

/**
 * Unified authentication routes for both web and mobile
 * POST /api/auth/register - Create new account with email/password
 * POST /api/auth/login - Login with email/password
 * POST /api/auth/refresh - Refresh access token
 * POST /api/auth/logout - Logout (invalidate refresh token)
 * GET /api/auth/me - Get current user
 */
export function registerUnifiedAuthRoutes(storage: IStorage) {
  /**
   * POST /api/auth/register
   * Register a new user with email and password
   */
  router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
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
        email: email,
        firstName: firstName,
        lastName: lastName,
        hashedPassword: hashedPassword,
        passwordCreatedAt: new Date(),
        certifications: [],
        totalFlightHours: 0,
        aircraftTypesFlown: [],
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
   * POST /api/auth/login
   * Login with email/password
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
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
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
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
   * POST /api/auth/logout
   * Logout user (invalidate refresh token)
   */
  router.post('/logout', async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await storage.deleteRefreshToken(refreshToken);
      }
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info (requires Bearer token)
   */
  router.get('/me', async (req: Request, res: Response): Promise<void> => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      
      if (!payload) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Get user from database
      const user = await storage.getUser(payload.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
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

      // Return user data (excluding password)
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = user;
      res.status(200).json(userResponse);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  return router;
}

export default router;
