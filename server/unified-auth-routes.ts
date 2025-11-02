import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';
import { IStorage } from './storage';
import { generateAccessToken, generateRefreshToken, verifyAccessToken } from './jwt';
import { getUncachableResendClient } from './resendClient';

const router = Router();

// Helper function to hash refresh tokens for secure storage
function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Helper function to generate email verification token
function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to get verification token expiry (24 hours from now)
function getVerificationTokenExpiry(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate;
}

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
 * POST /api/auth/web-register - Web registration (creates session)
 * POST /api/auth/web-login - Web login (creates session)
 * POST /api/auth/register - Mobile registration (returns JWT tokens)
 * POST /api/auth/login - Mobile login (returns JWT tokens)
 * POST /api/auth/refresh - Refresh access token (mobile)
 * POST /api/auth/logout - Logout (invalidate refresh token)
 * GET /api/auth/me - Get current user (mobile)
 */
export function registerUnifiedAuthRoutes(storage: IStorage) {
  /**
   * POST /api/auth/web-register
   * Register a new user with email and password (WEB - creates session)
   */
  router.post('/web-register', async (req: any, res: Response): Promise<void> => {
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

      // Generate email verification token
      const verificationToken = generateEmailVerificationToken();
      const verificationExpires = getVerificationTokenExpiry();

      // Create user
      const user = await storage.createUser({
        email: email,
        firstName: firstName,
        lastName: lastName,
        hashedPassword: hashedPassword,
        passwordCreatedAt: new Date(),
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        emailVerified: false,
        certifications: [],
        totalFlightHours: 0,
        aircraftTypesFlown: [],
      });

      // Send verification email
      try {
        const resend = getUncachableResendClient();
        const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
        
        await resend.emails.send({
          from: 'Ready Set Fly <noreply@readysetfly.us>',
          to: email,
          subject: 'Verify your Ready Set Fly account',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1e40af;">Welcome to Ready Set Fly!</h1>
              <p>Hi ${firstName},</p>
              <p>Thank you for creating an account with Ready Set Fly. Please verify your email address by clicking the button below:</p>
              <a href="${verificationUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email Address</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="color: #6b7280; word-break: break-all;">${verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create this account, you can safely ignore this email.</p>
              <p style="color: #6b7280; margin-top: 30px;">Best regards,<br>The Ready Set Fly Team</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email sending fails
      }

      // Create web session (compatible with Replit Auth middleware)
      req.session.userId = user.id;
      req.session.passport = {
        user: {
          claims: {
            sub: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
          }
        }
      };

      // Return user data (excluding password)
      const { hashedPassword: _, passwordCreatedAt: __, emailVerificationToken: ___, ...userResponse } = user;
      res.status(201).json({ 
        user: userResponse,
        message: 'Account created! Please check your email to verify your account.'
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  /**
   * POST /api/auth/web-login
   * Login with email/password (WEB - creates session)
   */
  router.post('/web-login', async (req: any, res: Response): Promise<void> => {
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

      // Create web session (compatible with Replit Auth middleware)
      req.session.userId = user.id;
      req.session.passport = {
        user: {
          claims: {
            sub: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
          }
        }
      };

      // Return user data (excluding password and verification token)
      const { hashedPassword: _, passwordCreatedAt: __, emailVerificationToken: ___, ...userResponse } = user;
      res.status(200).json({ user: userResponse });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  });

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
   * GET /api/auth/verify-email
   * Verify email address with token
   */
  router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'Verification token is required' });
        return;
      }

      // Find user by verification token
      const users = await storage.getAllUsers();
      const user = users.find(u => u.emailVerificationToken === token);
      
      if (!user) {
        res.status(404).json({ error: 'Invalid verification token' });
        return;
      }

      // Check if token has expired
      if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
        res.status(400).json({ error: 'Verification token has expired' });
        return;
      }

      // Update user to mark email as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      res.status(200).json({ message: 'Email verified successfully!' });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Failed to verify email' });
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
