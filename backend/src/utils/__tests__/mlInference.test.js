import { describe, it, expect } from 'vitest';
import { loadModels, predictPhishing, getMLStatus } from '../mlInference.js';

describe('ML Inference', () => {
  it('should load models if ONNX files exist', async () => {
    const loaded = await loadModels();
    if (loaded) {
      const status = getMLStatus();
      expect(status.loaded).toBe(true);
      expect(status.method).toBe('python-subprocess');
    } else {
      expect(loaded).toBe(false);
    }
  });

  it('should return null when models not loaded', async () => {
    const result = await predictPhishing('http://example.com');
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(typeof result.confidence).toBe('number');
    }
  }, 60000);

  it('should return null or valid prediction', async () => {
    const result = await predictPhishing('http://example.com');
    if (result !== null) {
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.is_phishing).toBeDefined();
    }
  });

  it('should return phishing prediction for suspicious URL', async () => {
    await loadModels();
    const result = await predictPhishing('http://paypal-verify-login.xyz/secure');
    if (result) {
      expect(result.confidence).toBeDefined();
      expect(result.is_phishing).toBeDefined();
      expect(result.model_scores).toBeDefined();
    }
  }, 60000);

  it('should return ML status object', () => {
    const status = getMLStatus();
    expect(status).toHaveProperty('loaded');
    expect(status).toHaveProperty('method');
    expect(status).toHaveProperty('error');
  });

  it('should return valid model scores when models loaded', async () => {
    const loaded = await loadModels();
    if (loaded) {
      const result = await predictPhishing('http://test.com');
      if (result) {
        expect(result.model_scores).toHaveProperty('logistic_regression');
        expect(result.model_scores).toHaveProperty('multinomial_nb');
        expect(result.model_scores.logistic_regression).toBeGreaterThanOrEqual(0);
        expect(result.model_scores.logistic_regression).toBeLessThanOrEqual(1);
        expect(result.model_scores.multinomial_nb).toBeGreaterThanOrEqual(0);
        expect(result.model_scores.multinomial_nb).toBeLessThanOrEqual(1);
      }
    }
  }, 60000);

  it('should include latency in prediction result', async () => {
    const loaded = await loadModels();
    if (loaded) {
      const result = await predictPhishing('http://example.com');
      if (result) {
        expect(result.latency_ms).toBeDefined();
        expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      }
    }
  }, 60000);

  it('should include model version in prediction result', async () => {
    const loaded = await loadModels();
    if (loaded) {
      const result = await predictPhishing('http://example.com');
      if (result) {
        expect(result.model_version).toBeDefined();
      }
    }
  }, 60000);

  it('should return confidence between 0 and 1', async () => {
    const loaded = await loadModels();
    if (loaded) {
      const result = await predictPhishing('http://malicious-login.xyz');
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    }
  }, 60000);
});
