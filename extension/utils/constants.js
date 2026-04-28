const API_BASE_URL = 'http://localhost:8000';
const API_ENDPOINTS = {
  ANALYZE: '/analyze',
  HISTORY: '/history',
  STATS: '/stats'
};
const CACHE_TTL_MS = 60 * 60 * 1000;
const API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const DEFAULT_BLOCKED_THRESHOLD = 0.7;
const DEFAULT_SETTINGS = {
  enabled: true,
  blockThreshold: DEFAULT_BLOCKED_THRESHOLD,
  showNotifications: true
};
const DEFAULT_WHITELIST = [];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_BASE_URL,
    API_ENDPOINTS,
    CACHE_TTL_MS,
    API_TIMEOUT_MS,
    MAX_RETRIES,
    DEFAULT_BLOCKED_THRESHOLD,
    DEFAULT_SETTINGS,
    DEFAULT_WHITELIST
  };
}