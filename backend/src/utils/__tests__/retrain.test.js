process.env.NODE_ENV = 'test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerRetrain, evaluateModel } from '../retrain.js';
import { existsSync } from 'fs';
import { monitor } from '../monitoring.js';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn()
  };
});

vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    execFile: vi.fn()
  };
});

describe('Retrain Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    monitor.alerts = [];
  });

  describe('triggerRetrain', () => {
    it('should return error when retrain script not found', async () => {
      existsSync.mockReturnValue(false);

      const scanHistory = new Map();
      const result = await triggerRetrain(scanHistory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Retrain script not found');
      expect(result.timestamp).toBeDefined();
    });

    it('should return success when retrain completes', async () => {
      const { execFile } = await import('child_process');
      existsSync.mockReturnValue(true);
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, 'Training completed', '');
      });

      const scanHistory = new Map([
        ['scan1', { url: 'http://test.com', action: 'block', confidence: 0.9, timestamp: '2024-01-01' }]
      ]);

      const result = await triggerRetrain(scanHistory);

      expect(result.success).toBe(true);
      expect(result.modelPath).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return error when retrain fails', async () => {
      const { execFile } = await import('child_process');
      existsSync.mockReturnValue(true);
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(new Error('Python error'), '', 'Error message');
      });

      const scanHistory = new Map();
      const result = await triggerRetrain(scanHistory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Python error');
    });
  });

  describe('evaluateModel', () => {
    it('should return error when evaluate script not found', async () => {
      existsSync.mockReturnValue(false);

      const result = await evaluateModel('/test/data.csv');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Evaluate script not found');
    });

    it('should return error when test data not found', async () => {
      existsSync.mockImplementation((path) => {
        return path.includes('evaluate.py');
      });

      const result = await evaluateModel('/nonexistent/data.csv');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test data not found');
    });

    it('should return metrics when evaluation succeeds', async () => {
      const { execFile } = await import('child_process');
      existsSync.mockReturnValue(true);
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, '{"accuracy": 0.95, "precision": 0.93, "recall": 0.97, "f1": 0.95}', '');
      });

      const result = await evaluateModel('/test/data.csv');

      expect(result.success).toBe(true);
      expect(result.metrics.accuracy).toBe(0.95);
      expect(result.metrics.precision).toBe(0.93);
      expect(result.metrics.recall).toBe(0.97);
      expect(result.metrics.f1).toBe(0.95);
    });

    it('should handle JSON parse errors', async () => {
      const { execFile } = await import('child_process');
      existsSync.mockReturnValue(true);
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, 'not valid json', '');
      });

      const result = await evaluateModel('/test/data.csv');

      expect(result.success).toBe(false);
      expect(result.error).toContain('parse');
    });
  });
});