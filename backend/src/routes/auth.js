/**
 * Authentication Routes
 * POST /v1/auth/login, POST /v1/auth/refresh
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  hashPassword, 
  comparePassword, 
  generateAccessToken, 
  verifyAccessToken,
  generateRefreshToken,
  revokeRefreshToken,
  findUserByEmail,
  createUser
} from '../utils/auth.js';

// In-memory user store
const userStore = new Map();

/**
 * Initialize demo user if not exists
 */
(async () => {
  try {
    const demoUser = await createUser('demo@example.com', 'demo123', 'user');
    userStore.set(demoUser.id, demoUser);
  } catch (e) {
    // User may already exist
  }
})();

/**
 * POST /v1/auth/login - Authenticate user
 */
export async function loginHandler(req, res) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Email and password are required'
      }
    });
  }
  
  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials'
      }
    });
  }
  
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials'
      }
    });
  }
  
  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });
  
  const refreshToken = generateRefreshToken(user.id);
  
  return res.json({
    accessToken,
    refreshToken,
    expiresIn: 900,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
}

/**
 * POST /v1/auth/refresh - Refresh access token
 */
export async function refreshHandler(req, res) {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required'
      }
    });
  }
  
  // For now, return a new access token (simplified)
  const newAccessToken = generateAccessToken({
    sub: 'user',
    role: 'user'
  });
  
  return res.json({
    accessToken: newAccessToken,
    expiresIn: 900
  });
}

/**
 * POST /v1/auth/logout - Logout (revoke refresh token)
 */
export async function logoutHandler(req, res) {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }
  
  return res.json({ message: 'Logged out successfully' });
}

/**
 * GET /v1/auth/me - Get current user info
 */
export async function meHandler(req, res) {
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
    return res.json({
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role
    });
  } catch {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    });
  }
}

export default {
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler
};