/**
 * Authentication Utilities - JWT and password hashing
 * Simplified version using Node.js built-in crypto
 */

import crypto from 'crypto';

// Configuration constants (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast in production if JWT_SECRET not set
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is required in production');
}

// Use fallback only in development
const EFFECTIVE_JWT_SECRET = JWT_SECRET || crypto.randomBytes(32).toString('hex');

if (!JWT_SECRET) {
  console.warn('[AUTH] WARNING: JWT_SECRET not set. Using generated secret (tokens will not persist across restarts).');
}
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days


// In-memory token store (use database in production)
const refreshTokens = new Map();
const users = new Map(); // In-memory user store

/**
 * Hash a password using scrypt (Node.js built-in)
 * Note: Use bcrypt in production - this is simplified for demo
 */
export async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
    });
  });
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.scrypt(password, Buffer.from(salt, 'hex'), 64, (err, derivedKey) => {
      if (err) return reject(err);
      const keyBuf = Buffer.from(key, 'hex');
      if (keyBuf.length !== derivedKey.length) return resolve(false);
      resolve(crypto.timingSafeEqual(keyBuf, derivedKey));
    });
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
  
  const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString());
  
  if (payload.exp < Math.floor(Date.now() / 1000)) {
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
  
  // TODO(tech-debt): Persist refresh tokens to database - in-memory only for dev
  // await prisma.refreshToken.create({ data: refreshToken });
  
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
  
  users.set(id, user);
  users.set(email, user); // Index by email
  
  return { id, email, role };
}

/**
 * Find user by ID
 */
export function findUserById(id) {
  return users.get(id) || null;
}

/**
 * Find user by email
 */
export function findUserByEmail(email) {
  return users.get(email) || null;
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
  authMiddleware
};