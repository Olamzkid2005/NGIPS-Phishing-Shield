/**
 * Simple Logger - Replaces console.log with structured logging
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const logLevelEnv = process.env.LOG_LEVEL || 'info';
if (!(logLevelEnv in LOG_LEVELS)) {
  console.warn(`[LOGGER] Invalid LOG_LEVEL "${logLevelEnv}", falling back to "info"`);
}
const currentLevel = LOG_LEVELS[logLevelEnv in LOG_LEVELS ? logLevelEnv : 'info'];

function shouldLog(level) {
  return LOG_LEVELS[level] >= currentLevel;
}

const REDACT_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey', 'secretKey'];

function redact(obj, depth = 0) {
  if (!obj || depth > 3) return obj;
  if (typeof obj !== 'object') return obj;
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(redacted)) {
    if (REDACT_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redact(redacted[key], depth + 1);
    }
  }
  return redacted;
}

export function debug(message, meta = {}) {
  if (shouldLog('debug')) {
    console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, redact(meta));
  }
}

export function info(message, meta = {}) {
  if (shouldLog('info')) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, redact(meta));
  }
}

export function warn(message, meta = {}) {
  if (shouldLog('warn')) {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, redact(meta));
  }
}

export function error(message, meta = {}) {
  if (shouldLog('error')) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, redact(meta));
  }
}

// Named export for convenience
export const logger = { debug, info, warn, error };

export default { debug, info, warn, error };