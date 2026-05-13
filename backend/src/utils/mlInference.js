/**
 * ML Inference Module - FastAPI HTTP client for phishing detection
 * Calls the ML Service REST API instead of spawning subprocess
 */

import https from 'https';
import http from 'http';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_SERVICE_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT || '30000');

const DANGEROUS_CHARS_PATTERN = /[;&|`$<>]/;

let modelLoadError = null;
let modelsAvailable = false;

function isValidUrlForShell(url) {
  try {
    new URL(url);
    if (DANGEROUS_CHARS_PATTERN.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

function fetchWithTimeout(url, options, timeout) {
  const protocol = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.setTimeout(timeout);
    req.end();
  });
}

/**
 * Check if ML service is available at startup
 */
export async function loadModels() {
  try {
    const { status, data } = await fetchWithTimeout(
      `${ML_SERVICE_URL}/health`,
      { method: 'GET', headers: { 'Accept': 'application/json' } },
      5000
    );

    if (status === 200) {
      const health = JSON.parse(data);
      modelsAvailable = health.models_loaded && health.models_loaded.length > 0;
      if (modelsAvailable) {
        console.log(`[ML] Service healthy at ${ML_SERVICE_URL}, models: ${health.models_loaded.join(', ')}`);
      } else {
        modelLoadError = 'ML service running but no models loaded';
        console.warn('[ML] Service running in degraded mode — no models loaded');
      }
    } else {
      modelLoadError = `ML service returned status ${status}`;
      console.warn(`[ML] Health check failed: ${status}`);
    }
    return modelsAvailable;
  } catch (error) {
    modelLoadError = `ML service unavailable: ${error.message}`;
    console.warn(`[ML] Cannot connect to ${ML_SERVICE_URL}: ${error.message}`);
    return false;
  }
}

/**
 * Run phishing prediction via FastAPI ML service
 * @param {string} url - URL to classify
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function predictPhishing(url) {
  if (!modelsAvailable) {
    return { success: false, error: 'ML models not available' };
  }

  if (!isValidUrlForShell(url)) {
    console.error('[ML] Invalid URL for processing:', url.substring(0, 50));
    return { success: false, error: 'Invalid URL format' };
  }

  try {
    const body = JSON.stringify({ url });
    const { status, data } = await fetchWithTimeout(
      `${ML_SERVICE_URL}/predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      },
      ML_SERVICE_TIMEOUT
    );

    if (status === 200) {
      const result = JSON.parse(data);
      console.log(`[ML] Inference ${result.processing_time_ms}ms | LR=${result.model_scores.logistic_regression} MNB=${result.model_scores.multinomial_nb} → ${result.confidence}`);
      return {
        success: true,
        data: {
          is_phishing: result.is_phishing,
          confidence: result.confidence,
          ml_confidence: result.confidence,
          model_scores: result.model_scores,
          latency_ms: result.processing_time_ms,
          model_version: 'ensemble-1.0.0',
        },
      };
    }

    const errorBody = data ? JSON.parse(data) : {};
    console.error(`[ML] Prediction failed: ${errorBody.detail || `HTTP ${status}`}`);
    return { success: false, error: errorBody.detail || `ML service error (${status})` };
  } catch (error) {
    console.error(`[ML] Prediction error for ${url.substring(0, 50)}: ${error.message}`);
    return { success: false, error: `ML service error: ${error.message}` };
  }
}

/**
 * Get current ML model status
 */
export function getMLStatus() {
  return {
    loaded: modelsAvailable,
    method: 'fastapi-http',
    error: modelLoadError,
  };
}
