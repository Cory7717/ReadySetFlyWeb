import { Router, Request, Response } from 'express';
import { createSoftAuthRateLimiter } from './middleware/rateLimit';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';
import { IStorage } from './storage';
import { generateAccessToken, generateRefreshToken, verifyAccessToken } from './jwt';
import { getUncachableResendClient } from './resendClient';
import { sendWelcomeEmail } from './email-templates';
import { maybeSyncLogbookProSubscription } from './paypal-subscription-sync';
import { getEntitlementsForUser, resolveMembershipFromStoreSignals } from './membership';

const router = Router();

const registrationRateLimiter = createSoftAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  anonMax: 5,
  authMax: 5,
  key: 'registration',
});

async function establishWebSession(
  req: any,
  userId: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((regenerateError: any) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }

      req.session.userId = userId;

      req.session.save((saveError: any) => {
        if (saveError) {
          reject(saveError);
          return;
        }

        resolve();
      });
    });
  });
}

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

const storeMembershipSyncSchema = z.object({
  platform: z.enum(['ios', 'android']),
  customerInfo: z.object({
    originalAppUserId: z.string().optional().nullable(),
    activeEntitlementIds: z.array(z.string()).optional().nullable(),
    activeProductIds: z.array(z.string()).optional().nullable(),
    latestExpirationDate: z.string().optional().nullable(),
    latestPurchaseDate: z.string().optional().nullable(),
  }),
});

// Helper function to get refresh token expiry (7 days from now)
function getRefreshTokenExpiry(): Date {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  return expiryDate;
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  router.post('/web-register', registrationRateLimiter, async (req: any, res: Response): Promise<void> => {
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

      const pendingInvite = await storage.getAdminInviteByEmail(email.toLowerCase());
      if (pendingInvite && (!pendingInvite.expiresAt || new Date(pendingInvite.expiresAt) > new Date())) {
        await storage.acceptAdminInvite(pendingInvite.id, user.id);
      }

      // Send verification email
      try {
        const { client, fromEmail } = await getUncachableResendClient();
        const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}`;
        
        await client.emails.send({
          from: fromEmail,
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
        await sendWelcomeEmail({ email, firstName });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email sending fails
      }

      try {
        await establishWebSession(req, user.id);
      } catch (sessionError) {
        console.error('Session save error:', sessionError);
        res.status(500).json({ error: 'Failed to create session' });
        return;
      }

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

      try {
        await establishWebSession(req, user.id);
      } catch (sessionError) {
        console.error('Session save error:', sessionError);
        res.status(500).json({ error: 'Failed to create session' });
        return;
      }

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
  router.post('/register', registrationRateLimiter, async (req: Request, res: Response): Promise<void> => {
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

      const pendingInvite = await storage.getAdminInviteByEmail(email.toLowerCase());
      if (pendingInvite && (!pendingInvite.expiresAt || new Date(pendingInvite.expiresAt) > new Date())) {
        await storage.acceptAdminInvite(pendingInvite.id, user.id);
      }

      // Send welcome email (no verification flow for mobile)
      try {
        await sendWelcomeEmail({ email, firstName });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
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

      // Find user by verification token using direct query
      const user = await storage.getUserByVerificationToken(token);
      
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

      const syncedUser = await maybeSyncLogbookProSubscription(storage, user);

      // Return user data (excluding password)
      const entitlements = getEntitlementsForUser(syncedUser);
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = syncedUser;
      res.status(200).json({ ...userResponse, entitlements });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  /**
   * POST /api/auth/mobile-membership/sync
   * Sync RevenueCat/App Store/Google Play membership into RSF entitlements
   */
  router.post('/mobile-membership/sync', async (req: Request, res: Response): Promise<void> => {
    try {
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

      const result = storeMembershipSyncSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: result.error.format(),
        });
        return;
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const { platform, customerInfo } = result.data;
      const activeProductIds = Array.from(
        new Set((customerInfo.activeProductIds || []).map((value) => value.trim()).filter(Boolean))
      );
      const activeEntitlementIds = Array.from(
        new Set((customerInfo.activeEntitlementIds || []).map((value) => value.trim()).filter(Boolean))
      );
      const membershipPlan = resolveMembershipFromStoreSignals({
        productIds: activeProductIds,
        entitlementIds: activeEntitlementIds,
      });
      const expiresAt = parseOptionalDate(customerInfo.latestExpirationDate);
      const purchaseAt = parseOptionalDate(customerInfo.latestPurchaseDate);
      const provider = platform === 'ios' ? 'app_store' : 'google_play';

      let updatedUser = user;
      if (membershipPlan) {
        updatedUser =
          (await storage.updateUser(user.id, {
            membershipTier: membershipPlan.tier,
            membershipStatus: 'active',
            membershipProvider: provider,
            membershipInterval: membershipPlan.interval,
            membershipEndsAt: expiresAt,
            membershipTrialEndsAt: null,
            membershipNextBillingAt: expiresAt,
            paypalSubscriptionId: null,
            paypalPlanId: null,
            logbookProStatus: membershipPlan.tier === 'free' ? 'inactive' : 'active',
            logbookProPlan: membershipPlan.interval,
            logbookProStartedAt: purchaseAt || user.logbookProStartedAt || new Date(),
            logbookProEndsAt: expiresAt,
            logbookProCanceledAt: null,
            logbookProCancelAtPeriodEnd: false,
          })) || user;
      } else if (user.membershipProvider === 'app_store' || user.membershipProvider === 'google_play') {
        updatedUser =
          (await storage.updateUser(user.id, {
            membershipTier: 'free',
            membershipStatus: 'inactive',
            membershipProvider: provider,
            membershipInterval: null,
            membershipEndsAt: null,
            membershipTrialEndsAt: null,
            membershipNextBillingAt: null,
            logbookProStatus: 'inactive',
            logbookProPlan: null,
            logbookProEndsAt: null,
            logbookProCanceledAt: new Date(),
            logbookProCancelAtPeriodEnd: false,
          })) || user;
      }

      const entitlements = getEntitlementsForUser(updatedUser);
      const { hashedPassword: _, passwordCreatedAt: __, ...userResponse } = updatedUser;
      res.status(200).json({ ...userResponse, entitlements });
    } catch (error) {
      console.error('Mobile membership sync error:', error);
      res.status(500).json({ error: 'Failed to sync mobile membership' });
    }
  });

  /**
   * GET /api/auth/mobile-oauth-callback
   * Callback after OAuth login - creates exchange token for mobile
   */
  router.get('/mobile-oauth-callback', async (req: any, res: Response): Promise<void> => {
    try {
      // Check if user is authenticated via OAuth (req.user.claims.sub) or session
      const userId = req.user?.claims?.sub || req.session?.userId;
      
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Generate a short-lived exchange token (valid for 5 minutes)
      const exchangeToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      // Store exchange token in database
      await storage.createOAuthExchangeToken({
        token: exchangeToken,
        userId: userId,
        expiresAt,
      });

      // Redirect to mobile app with exchange token
      res.redirect(`readysetfly://oauth-callback?token=${exchangeToken}`);
    } catch (error) {
      console.error('Mobile OAuth callback error:', error);
      res.status(500).json({ error: 'Failed to process OAuth callback' });
    }
  });

  /**
   * POST /api/auth/exchange-oauth-token
   * Exchange OAuth token for JWT tokens (mobile)
   */
  router.post('/exchange-oauth-token', async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Exchange token is required' });
        return;
      }

      // Verify exchange token
      const exchangeData = await storage.verifyOAuthExchangeToken(token);
      if (!exchangeData) {
        res.status(401).json({ error: 'Invalid or expired exchange token' });
        return;
      }

      // Get user
      const user = await storage.getUser(exchangeData.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user.id, user.email!);
      const refreshToken = generateRefreshToken();

      // Store refresh token in database
      await storage.createRefreshToken({
        userId: user.id,
        token: hashRefreshToken(refreshToken),
        expiresAt: getRefreshTokenExpiry(),
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
      });

      // Delete the exchange token (one-time use)
      await storage.deleteOAuthExchangeToken(token);

      // Return tokens and user data
      const { hashedPassword: _, passwordCreatedAt: __, emailVerificationToken: ___, ...userResponse } = user;
      res.status(200).json({
        accessToken,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      console.error('Token exchange error:', error);
      res.status(500).json({ error: 'Failed to exchange token' });
    }
  });

  return router;
}

export default router;
