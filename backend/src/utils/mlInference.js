/**
 * ML Inference Module - ONNX Runtime integration
 * Loads ONNX models + vocabulary, runs inference directly in Node.js
 */

import { loadModels, predictPhishing, getMLStatus } from './onnxInference.js';
import { loadAllVectorizers } from './vectorizer.js';

export { predictPhishing, getMLStatus };

export async function loadModelsAndVectorizers() {
  const modelsOk = await loadModels();
  const vecOk = loadAllVectorizers();
  return modelsOk && vecOk;
}
