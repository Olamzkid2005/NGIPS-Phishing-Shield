/**
 * Authentication Routes
 * POST /v1/auth/login, POST /v1/auth/refresh
 */

import {
  hashPassword, 
  comparePassword, 
  generateAccessToken, 
  verifyAccessToken,
  generateRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  revokeRefreshToken,
  findUserByEmail,
  findUserById,
  createUser
} from '../utils/auth.js';

/**
 * Initialize demo user if not exists (dev only)
 */
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      await createUser('demo@example.com', 'demo123', 'user');
    } catch (e) {
      // User may already exist
    }
  })();
}

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
    return res.status(400).json({ error: { code: 'MISSING_TOKEN', message: 'Refresh token required' } });
  }
  
  const stored = getRefreshToken(refreshToken);
  if (!stored) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } });
  }
  
  // Delete used token (rotation)
  deleteRefreshToken(refreshToken);
  
  const userId = stored?.userId;
  const user = findUserById(userId);
  const role = user?.role || 'user';
  
  const newAccessToken = generateAccessToken({ sub: userId, role });
  const newRefreshToken = generateRefreshToken(userId);
  
  return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
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