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
  createUser,
  isValidEmail
} from '../utils/auth.js';

/**
 * Validate login input
 */
function validateLoginInput(email, password) {
  if (!email || !password) {
    return { valid: false, error: 'Email and password are required' };
  }

  if (!isValidEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (typeof password !== 'string' || password.length < 1) {
    return { valid: false, error: 'Password is required' };
  }

  return { valid: true };
}

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

  const validation = validateLoginInput(email, password);
  if (!validation.valid) {
    return res.status(400).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: validation.error
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

  const userId = stored.userId;
  const user = findUserById(userId);
  const role = user?.role || 'user';

  // Generate new tokens BEFORE invalidating old one
  // This ensures user doesn't lose access if generation fails
  let newAccessToken;
  let newRefreshToken;
  try {
    newAccessToken = generateAccessToken({ sub: userId, role });
    newRefreshToken = generateRefreshToken(userId);
  } catch (error) {
    console.error('[AUTH] Token generation failed:', error.message);
    return res.status(500).json({ error: { code: 'TOKEN_GENERATION_FAILED', message: 'Failed to generate tokens' } });
  }

  // Only delete old token after new tokens are successfully generated
  deleteRefreshToken(refreshToken);

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