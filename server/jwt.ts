import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'default-jwt-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

/**
 * Generate an access token (short-lived, 15 minutes)
 */
export function generateAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = { userId, email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Generate a refresh token (long-lived, 30 days)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Get expiry date for refresh token (30 days from now)
 */
export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
}
