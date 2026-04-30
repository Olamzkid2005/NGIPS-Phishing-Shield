/**
 * Simple Logger - Replaces console.log with structured logging
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function shouldLog(level) {
  return LOG_LEVELS[level] >= currentLevel;
}

const REDACT_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey', 'secretKey'];

function redact(obj) {
  if (!obj) return obj;
  const redacted = { ...obj };
  for (const field of REDACT_FIELDS) {
    if (redacted[field]) redacted[field] = '[REDACTED]';
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

export default { debug, info, warn, error };