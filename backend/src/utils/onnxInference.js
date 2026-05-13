/**
 * ONNX Inference Engine - Runs ML models directly in Node.js
 * Replaces FastAPI ML service entirely.
 * 
 * Uses onnxruntime-node to load and execute .onnx model files.
 * Ensemble scoring: 60% Logistic Regression + 40% Multinomial Naive Bayes.
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { vectorize } from './vectorizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '../../../ml-service/models');

let ort = null;
let models = {};
let modelLoadError = null;
let modelsAvailable = false;

// Model version info
const MODEL_VERSIONS = {
  logistic_regression: { version: '1.0.0', hash: null },
  multinomial_nb: { version: '1.0.0', hash: null },
};

const ENSEMBLE_WEIGHTS = {
  logistic_regression: 0.6,
  multinomial_nb: 0.4,
};

// ---------- Model Registry (for A/B testing and canary) ----------

const modelRegistry = {
  active: { logistic_regression: 'logistic_regression', multinomial_nb: 'multinomial_nb' },
  candidates: {},
  trafficSplit: 0.05, // 5% canary traffic
};

export function setActiveModel(name, modelName) {
  modelRegistry.active[name] = modelName;
}

export function setTrafficSplit(ratio) {
  modelRegistry.trafficSplit = Math.max(0, Math.min(1, ratio));
}

function selectModel(name) {
  const active = modelRegistry.active[name];
  const candidate = modelRegistry.candidates[name];
  if (!candidate) return active;
  if (Math.random() < modelRegistry.trafficSplit) return candidate;
  return active;
}

// ---------- Model Loading ----------

export async function loadModels() {
  try {
    ort = await import('onnxruntime-node');
  } catch (e) {
    modelLoadError = `onnxruntime-node not installed: ${e.message}. Run: npm install onnxruntime-node`;
    console.warn(`[ML] ${modelLoadError}`);
    return false;
  }

  const modelNames = ['logistic_regression', 'multinomial_nb'];
  let anyLoaded = false;

  for (const name of modelNames) {
    const path = join(MODELS_DIR, `${name}.onnx`);
    if (!existsSync(path)) {
      console.warn(`[ML] ONNX model not found: ${path}`);
      continue;
    }
    try {
      const session = await ort.InferenceSession.create(path);
      if (models[name]) {
        try { await models[name].release(); } catch {}
      }
      models[name] = session;
      anyLoaded = true;
      console.log(`[ML] Loaded ONNX model: ${name} from ${path}`);
    } catch (e) {
      console.warn(`[ML] Failed to load ONNX model ${name}: ${e.message}`);
    }
  }

  modelsAvailable = anyLoaded;
  if (!anyLoaded) {
    modelLoadError = 'No ONNX models loaded';
  }
  return anyLoaded;
}

// ---------- Inference ----------

function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

async function runModel(modelNameKey, floatsNdarray) {
  const session = models[modelNameKey];
  if (!session) throw new Error(`Model ${modelNameKey} not loaded`);

  const feeds = {};
  const [inputName] = session.inputNames;
  const [outputName] = session.outputNames;

  feeds[inputName] = new ort.Tensor('float32', floatsNdarray, [1, floatsNdarray.length]);

  const results = await session.run(feeds);
  const output = results[outputName];
  return output.data;
}

function getPhishingProbability(outputData, _modelName) {
  // ONNX classifier output varies by model type.
  // For LogisticRegression (ONNX LinearClassifier): [label, score]
  // For MultinomialNB: raw probabilities
  // The classifier-only ONNX export typically outputs 2 scores.
  if (outputData.length >= 2) {
    const probas = softmax(Array.from(outputData));
    return probas[1]; // index 1 = phishing class
  }
  // Single output = sigmoid
  return sigmoid(outputData[0]);
}

async function predictSingle(url, modelName, vectorizer) {
  const floatsNdarray = vectorizer(url, modelName);
  const outputData = await runModel(modelName, floatsNdarray);
  return getPhishingProbability(outputData, modelName);
}

export async function predictPhishing(url) {
  if (!modelsAvailable) {
    return { success: false, error: modelLoadError || 'ML models not available' };
  }

  const start = Date.now();

  try {
    const modelScores = {};
    let anySuccess = false;

    for (const [name, weight] of Object.entries(ENSEMBLE_WEIGHTS)) {
      const selectedModel = selectModel(name);
      const sessionKey = models[selectedModel] ? selectedModel : name;
      try {
        const prob = await predictSingle(url, sessionKey, vectorize);
        modelScores[name] = prob;
        anySuccess = true;
      } catch (e) {
        console.error(`[ML] Model ${name} failed: ${e.message}`);
        modelScores[name] = null;
      }
    }

    const validScores = Object.entries(modelScores)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([name, score]) => ({ name, score, weight: ENSEMBLE_WEIGHTS[name] ?? 0 }))
      .filter(x => x.weight > 0);

    if (validScores.length === 0) {
      return { success: false, error: 'All models failed or zero weight' };
    }

    const totalWeight = validScores.reduce((s, x) => s + x.weight, 0);
    if (totalWeight === 0) return { success: false, error: 'Zero total weight' };
    const ensembleScore = validScores.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;

    const latency = Date.now() - start;

    return {
      success: true,
      data: {
        is_phishing: ensembleScore >= 0.5,
        confidence: ensembleScore >= 0.5 ? ensembleScore : 1 - ensembleScore,
        ml_confidence: ensembleScore,
        model_scores: modelScores,
        latency_ms: latency,
        model_version: 'onnx-ensemble-1.0.0',
      },
    };
  } catch (error) {
    console.error(`[ML] Prediction error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ---------- Canary Deployment ----------

export async function deployCandidate(candidateModel, modelName) {
  if (!ort) throw new Error('ONNX Runtime not initialized. Call loadModels() first.');
  const path = join(MODELS_DIR, candidateModel);
  if (!existsSync(path)) {
    throw new Error(`Candidate model not found: ${path}`);
  }
  const session = await ort.InferenceSession.create(path);
  models[candidateModel] = session;
  modelRegistry.candidates[modelName] = candidateModel;
  console.log(`[ML] Deployed candidate: ${modelName} -> ${candidateModel}`);
  return { modelName, candidate: candidateModel, trafficSplit: modelRegistry.trafficSplit };
}

export async function promoteCandidate(modelName) {
  const candidate = modelRegistry.candidates[modelName];
  if (!candidate) throw new Error(`No candidate for ${modelName}`);
  modelRegistry.active[modelName] = candidate;
  delete modelRegistry.candidates[modelName];
  console.log(`[ML] Promoted candidate to active: ${modelName} -> ${candidate}`);
  return { modelName, active: candidate };
}

export async function rollbackModel(modelName) {
  const defaults = ['logistic_regression', 'multinomial_nb'];
  if (!defaults.includes(modelName)) {
    throw new Error(`Cannot rollback unknown model: ${modelName}`);
  }
  modelRegistry.active[modelName] = modelName;
  delete modelRegistry.candidates[modelName];
  console.log(`[ML] Rolled back ${modelName} to default`);
}

// ---------- Status ----------

export function getMLStatus() {
  return {
    loaded: modelsAvailable,
    method: 'onnx-nodejs',
    error: modelLoadError,
    activeModels: { ...modelRegistry.active },
    candidates: Object.keys(modelRegistry.candidates).length > 0 ? { ...modelRegistry.candidates } : null,
    trafficSplit: modelRegistry.trafficSplit,
  };
}

export default { loadModels, predictPhishing, deployCandidate, promoteCandidate, rollbackModel, getMLStatus, setTrafficSplit };
