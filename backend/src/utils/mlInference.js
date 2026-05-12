/**
 * ML Inference Module - Python subprocess integration for phishing detection
 * Calls Python script that loads .pkl pipelines for exact tokenization match
 */

import { execFile, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ML_SERVICE_DIR = path.join(__dirname, '../../../ml-service');
const PREDICT_SCRIPT = path.join(ML_SERVICE_DIR, 'predict.py');

// Compiled regex patterns for performance
const URL_SAFE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:.\/\-_]+$/;
const DANGEROUS_CHARS_PATTERN = /[;&|`$<>]/;
const IP_ADDRESS_PATTERN = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

/**
 * Validate URL for shell execution (security check)
 * Uses URL constructor for primary validation, regex as fallback
 */
function isValidUrlForShell(url) {
  // First try URL constructor for robust validation
  try {
    new URL(url);
    // If valid URL, check for dangerous characters
    if (DANGEROUS_CHARS_PATTERN.test(url)) {
      return false;
    }
    return true;
  } catch {
    // Fallback to regex for non-URL strings that might be paths
    return URL_SAFE_PATTERN.test(url);
  }
}

let modelLoadError = null;
let modelsAvailable = false;

const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

/**
 * Check if ML models and Python are available at startup
 */
export async function loadModels() {
  try {
    if (!fs.existsSync(PREDICT_SCRIPT)) {
      modelLoadError = 'predict.py not found';
      console.warn('[ML] predict.py not found at:', PREDICT_SCRIPT);
      return false;
    }

    const modelsDir = path.join(ML_SERVICE_DIR, 'models');
    const lrExists = fs.existsSync(path.join(modelsDir, 'logistic_regression_pipeline.pkl'));
    const mnbExists = fs.existsSync(path.join(modelsDir, 'multinomial_nb_pipeline.pkl'));

    if (!lrExists && !mnbExists) {
      modelLoadError = 'No .pkl model files found';
      console.warn('[ML] No .pkl model files found in:', modelsDir);
      return false;
    }

    return new Promise((resolve) => {
      execFile(PYTHON_CMD, ['--version'], { timeout: 5000 }, (error, stdout) => {
        if (error) {
          modelLoadError = 'Python not available';
          console.warn('[ML] Python not available:', error.message);
          resolve(false);
        } else {
          console.log('[ML] Python available:', stdout.trim());
          modelsAvailable = true;
          console.log(`[ML] Models: LR=${lrExists}, MNB=${mnbExists}`);
          modelLoadError = null;
          resolve(true);
        }
      });
    });
  } catch (error) {
    modelLoadError = error.message;
    console.warn('[ML] Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Run phishing prediction using Python subprocess
 * @param {string} url - URL to classify
 * @returns {Promise<{success: boolean, data?: object, error?: string}>} - Structured result
 */
export async function predictPhishing(url) {
  if (!modelsAvailable) {
    return { success: false, error: 'ML models not available' };
  }

  if (!isValidUrlForShell(url)) {
    console.error('[ML] Invalid URL for processing:', url.substring(0, 50));
    return { success: false, error: 'Invalid URL format' };
  }

  return new Promise((resolve) => {
    const env = { ...process.env, PYTHONUNBUFFERED: '1' };

    const proc = spawn(PYTHON_CMD, [PREDICT_SCRIPT, url], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        console.error(`[ML] Prediction error for URL: ${url.substring(0, 50)}... - ${error.message}`);
        resolve({ success: false, error: `Process error: ${error.message}` });
      }
    });

    const timeout = setTimeout(() => {
      // Force kill on both Windows and Unix - SIGKILL cannot be caught
      proc.kill('SIGKILL');
      if (!resolved) {
        resolved = true;
        console.error('[ML] Prediction timed out for URL:', url);
        resolve({ success: false, error: 'Prediction timeout (30s)' });
      }
    }, 30000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (resolved) return;
      resolved = true;

      if (stdout && stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());

          if (result.success) {
            console.log(`[ML] Inference ${result.latency_ms}ms | LR=${result.model_scores.logistic_regression} MNB=${result.model_scores.multinomial_nb} → ${result.confidence}`);
            resolve({
              success: true,
              data: {
                is_phishing: result.is_phishing,
                confidence: result.confidence,
                ml_confidence: result.ml_confidence,
                model_scores: result.model_scores,
                latency_ms: result.latency_ms,
                model_version: result.model_version
              }
            });
            return;
          } else {
            console.error('[ML] Prediction failed:', result.error);
            resolve({ success: false, error: result.error });
            return;
          }
        } catch (parseError) {
          console.error('[ML] Failed to parse Python output:', stdout.substring(0, 200));
          resolve({ success: false, error: 'Failed to parse ML response' });
        }
      }

      if (code !== 0) {
        console.error('[ML] Prediction process exited with code:', code);
        if (stderr) {
          console.error('[ML] stderr:', stderr.substring(0, 500));
        }
      }

      resolve({ success: false, error: `Process exited with code ${code}` });
    });
  });
}

/**
 * Get current ML model status
 */
export function getMLStatus() {
  return {
    loaded: modelsAvailable,
    method: 'python-subprocess',
    error: modelLoadError
  };
}
