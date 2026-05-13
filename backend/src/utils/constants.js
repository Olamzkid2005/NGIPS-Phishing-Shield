/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers
 */

// URL Configuration
export const URL_MAX_LENGTH = 2048;
export const SCAN_HISTORY_LIMIT = 1000;

// Auth Configuration
export const JWT_EXPIRES_IN = '15m';
export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes in seconds

// ML Configuration
export const BLOCK_CONFIDENCE_THRESHOLD = 0.7;
export const HIGH_CONFIDENCE_THRESHOLD = 0.8;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.4;

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_RATE_LIMIT_MAX = 5;
export const REFRESH_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const REFRESH_RATE_LIMIT_MAX = 10;

// Heuristic Thresholds
export const URL_LENGTH_WARNING = 75;
export const DOMAIN_LENGTH_WARNING = 20;
export const PATH_LENGTH_WARNING = 50;
export const SUBDOMAIN_WARNING = 2;
export const SPECIAL_CHAR_WARNING = 3;
export const DIGIT_WARNING = 5;
export const ENTROPY_WARNING = 4.0;

// Monitoring
export const MAX_PREDICTIONS_HISTORY = 10000;
export const ALERT_CAP = 500;
export const DRIFT_PSI_THRESHOLD = 0.2;
export const DRIFT_CHECK_INTERVAL = 100;

// Extension
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const API_TIMEOUT_MS = 5000;
export const MAX_RETRIES = 3;

// Allowed CORS Origins
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8000',
  'https://localhost:3000',
  'https://localhost:5173',
  'https://localhost:8000'
];

// Model versions
export const MODEL_VERSION = '1.0.0';
export const ML_METHOD_PYTHON = 'FastAPI HTTP (Ensemble)';