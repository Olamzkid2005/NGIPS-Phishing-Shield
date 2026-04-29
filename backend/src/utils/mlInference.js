/**
 * ML Inference Module - Python subprocess integration for phishing detection
 * Calls Python script that loads .pkl pipelines for exact tokenization match
 */

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ML_SERVICE_DIR = path.join(__dirname, '../../../ml-service');
const PREDICT_SCRIPT = path.join(ML_SERVICE_DIR, 'predict.py');

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
      execFile(PYTHON_CMD, ['--version'], (error, stdout) => {
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
 * @returns {object|null} - Prediction result or null if unavailable
 */
export async function predictPhishing(url) {
  if (!modelsAvailable) {
    return null;
  }

  return new Promise((resolve) => {
    const env = { ...process.env, PYTHONUNBUFFERED: '1' };

    execFile(PYTHON_CMD, [PREDICT_SCRIPT, url], { timeout: 30000, env }, (error, stdout, stderr) => {
      if (stdout && stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());

          if (result.success) {
            console.log(`[ML] Inference ${result.latency_ms}ms | LR=${result.model_scores.logistic_regression} MNB=${result.model_scores.multinomial_nb} → ${result.confidence}`);
            resolve({
              is_phishing: result.is_phishing,
              confidence: result.confidence,
              ml_confidence: result.ml_confidence,
              model_scores: result.model_scores,
              latency_ms: result.latency_ms,
              model_version: result.model_version
            });
            return;
          } else {
            console.error('[ML] Prediction failed:', result.error);
            resolve(null);
            return;
          }
        } catch (parseError) {
          console.error('[ML] Failed to parse Python output:', stdout.substring(0, 200));
        }
      }

      if (error) {
        console.error('[ML] Prediction error:', error.message);
        if (stderr) {
          console.error('[ML] stderr:', stderr.substring(0, 500));
        }
        resolve(null);
        return;
      }

      resolve(null);
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
