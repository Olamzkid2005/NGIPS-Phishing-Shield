/**
 * Test Helper Utilities
 * Common utilities for generating test data and tokens
 * Uses the project's own JWT implementation
 */

import { generateAccessToken, verifyAccessToken } from '../../src/utils/auth.js';

/**
 * Generate a valid JWT token for testing
 * @param {object} payload - Token payload
 * @returns {string} Valid JWT token
 */
export function generateTestToken(payload = { userId: 'test-user-123', email: 'test@example.com', role: 'user' }) {
  return generateAccessToken(payload);
}

/**
 * Generate an expired JWT token for testing
 * @param {object} payload - Token payload
 * @returns {string} Expired JWT token (will fail verification)
 */
export function generateExpiredToken(payload = { userId: 'test-user-123', exp: 0 }) {
  // Create a token with expired timestamp
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000) - 3600, // issued 1 hour ago
    exp: Math.floor(Date.now() / 1000) - 1800   // expired 30 min ago
  })).toString('base64url');
  
  // This token will fail verification due to expired timestamp
  return `${header}.${payloadEncoded}.invalid-signature`;
}

/**
 * Generate a test user object
 * @param {object} overrides - Override default values
 * @returns {object} Test user object
 */
export function generateTestUser(overrides = {}) {
  return {
    id: 'test-user-' + Math.random().toString(36).substr(2, 9),
    email: 'test@example.com',
    password: 'testpassword123',
    role: 'user',
    ...overrides
  };
}

/**
 * Generate test scan data
 * @param {object} overrides - Override default values
 * @returns {object} Test scan object
 */
export function generateTestScan(overrides = {}) {
  return {
    id: 'scan_' + Math.random().toString(36).substr(2, 9),
    url: 'https://example.com',
    action: 'allow',
    confidence: 0.95,
    reasons: [],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Generate test URL variants
 * @returns {string[]} Array of test URLs
 */
export function getTestUrls() {
  return {
    phishing: [
      'https://secure-bank-login.com/verify?email=user@example.com',
      'https://paypal-verify.net/account/update',
      'https://amazon-order-confirm.com/giftcard',
      'http://192.168.1.100/login',
      'https://short.url/redirect?target=evil.com'
    ],
    legitimate: [
      'https://www.google.com',
      'https://github.com',
      'https://stackoverflow.com',
      'https://www.microsoft.com/en-us',
      'https://www.apple.com'
    ],
    suspicious: [
      'https://example.com/login.php',
      'https://sub.domain.biz/page',
      'http://test-site.org/admin'
    ]
  };
}