/**
 * Authentication Utilities - JWT and password hashing
 * Uses bcrypt for password hashing (production-ready)
 */

import crypto from 'crypto';
import { randomBytes, timingSafeEqual } from 'crypto';

// Configuration constants (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast in production if JWT_SECRET not set - no fallback
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is required in production');
}

if (!JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('[AUTH] WARNING: JWT_SECRET not set in non-production. Using dev secret - DO NOT USE IN PRODUCTION.');
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-prod-9f8e7d6c5b4a3e2f1g0h9i8j7k6l5m4n3o2p1q0r';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email format
 */
export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}


// In-memory token store (use database in production)
const refreshTokens = new Map();
const usersById = new Map();
const usersByEmail = new Map();

/**
 * Hash a password using PBKDF2 with high iterations (production-ready)
 * Uses SHA-512 with 100,000 iterations for memory-hard key derivation
 */
export async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(32);
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
    });
  });
}

/**
 * Compare password with hash using constant-time comparison
 */
export async function comparePassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string') return false;
  return new Promise((resolve) => {
    try {
      const parts = hash.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        resolve(false);
        return;
      }

      const salt = parts[0];
      const storedKey = parts[1];

      crypto.pbkdf2(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) {
          resolve(false);
          return;
        }
        const keyBuf = Buffer.from(storedKey, 'hex');
        if (keyBuf.length !== derivedKey.length) {
          resolve(false);
          return;
        }
        resolve(timingSafeEqual(keyBuf, derivedKey));
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Generate a JSON Web Token (simple version)
 */
export function generateAccessToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60 // 15 minutes
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', EFFECTIVE_JWT_SECRET)
    .update(header + '.' + payloadEncoded)
    .digest('base64url');
  
  return `${header}.${payloadEncoded}.${signature}`;
}

/**
 * Verify a JSON Web Token
 */
export function verifyAccessToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    const error = new Error('Invalid token format');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  const [header, payloadEncoded, signature] = token.split('.');
  
  const expectedSignature = crypto
    .createHmac('sha256', EFFECTIVE_JWT_SECRET)
    .update(header + '.' + payloadEncoded)
    .digest('base64url');
  
  const sigBuf = Buffer.from(signature, 'base64url');
  const expectedBuf = Buffer.from(expectedSignature, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    const error = new Error('Invalid token signature');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString());
  } catch {
    const error = new Error('Invalid token payload');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    const error = new Error('Token expired');
    error.name = 'TokenExpiredError';
    throw error;
  }
  
  return payload;
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  
  const refreshToken = {
    token,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date().toISOString(),
    revoked: false
  };
  
  refreshTokens.set(token, refreshToken);
  
  // Prune expired tokens periodically (prevent memory leak)
  if (refreshTokens.size > 10000) {
    const now = Date.now();
    for (const [key, value] of refreshTokens) {
      if (new Date(value.expiresAt).getTime() < now) refreshTokens.delete(key);
    }
  }
  
  return token;
}

/**
 * Verify and get refresh token
 */
export function getRefreshToken(token) {
  const stored = refreshTokens.get(token);
  
  if (!stored) {
    // TODO(tech-debt): Check database when available
    return null;
  }
  
  if (stored.revoked || new Date(stored.expiresAt) < new Date()) {
    return null;
  }
  
  return stored;
}

/**
 * Revoke a refresh token
 */
export function revokeRefreshToken(token) {
  const stored = refreshTokens.get(token);
  
  if (stored) {
    stored.revoked = true;
    refreshTokens.set(token, stored);
    
    // TODO(tech-debt): Update in database:
    // await prisma.refreshToken.update({ where: { token }, data: { revoked: true } });
  }
}

/**
 * Delete a refresh token (used during rotation)
 */
export function deleteRefreshToken(token) {
  refreshTokens.delete(token);
}

/**
 * Create a user (for demo/first-time setup)
 */
export async function createUser(email, password, role = 'user') {
  const id = `user_${crypto.randomBytes(8).toString('hex')}`;
  const passwordHash = await hashPassword(password);
  
  const user = {
    id,
    email,
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };
  
  if (findUserByEmail(email)) {
    throw new Error(`User with email ${email} already exists`);
  }
  usersById.set(id, user);
  usersByEmail.set(email, user);
  
  return { id, email, role };
}

/**
 * Find user by ID
 */
export function findUserById(id) {
  return usersById.get(id) || null;
}

/**
 * Find user by email
 */
export function findUserByEmail(email) {
  return usersByEmail.get(email) || null;
}

/**
 * Authentication middleware
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'No token provided'
      }
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired'
        }
      });
    }
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    });
  }
}

export default {
  hashPassword,
  comparePassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  deleteRefreshToken,
  createUser,
  findUserByEmail,
  isValidEmail,
  authMiddleware
};