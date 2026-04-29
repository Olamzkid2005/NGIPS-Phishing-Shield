/**
 * Retraining Pipeline - Collects feedback data and triggers model retraining
 */

import { execFile } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { monitor } from './monitoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../../data');
const RETRAIN_SCRIPT = join(__dirname, '../../../ml-service/retrain.py');
const EVALUATE_SCRIPT = join(__dirname, '../../../ml-service/evaluate.py');
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

/**
 * Collect scan history with feedback and export to CSV
 */
async function exportTrainingData(scanHistory) {
  await mkdir(DATA_DIR, { recursive: true });

  const rows = [];
  rows.push('url,confidence,is_phishing,feedback_correct,timestamp');

  for (const scan of scanHistory.values()) {
    const url = `"${(scan.url || '').replace(/"/g, '""')}"`;
    const confidence = scan.confidence ?? 0;
    const isPhishing = scan.action === 'block' ? 1 : 0;
    const feedbackCorrect = scan.feedbackCorrect ?? '';
    const timestamp = scan.timestamp || '';
    rows.push(`${url},${confidence},${isPhishing},${feedbackCorrect},${timestamp}`);
  }

  const csvPath = join(DATA_DIR, 'training_data.csv');
  await writeFile(csvPath, rows.join('\n'), 'utf-8');
  return csvPath;
}

/**
 * Trigger model retraining via Python script
 */
export async function triggerRetrain(scanHistory) {
  try {
    if (!existsSync(RETRAIN_SCRIPT)) {
      return {
        success: false,
        error: `Retrain script not found at: ${RETRAIN_SCRIPT}. Create ml-service/retrain.py to enable retraining.`,
        timestamp: new Date().toISOString()
      };
    }

    const csvPath = await exportTrainingData(scanHistory);

    return new Promise((resolve) => {
      execFile(PYTHON_CMD, [RETRAIN_SCRIPT, '--data', csvPath, '--output', join(DATA_DIR, 'model.onnx')], {
        timeout: 300000,
        cwd: join(__dirname, '../..')
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            stderr: stderr?.toString(),
            timestamp: new Date().toISOString()
          });
          return;
        }

        monitor.alerts.push({
          type: 'RETRAIN_COMPLETED',
          timestamp: Date.now(),
          message: 'Model retraining completed successfully.'
        });

        resolve({
          success: true,
          output: stdout?.toString(),
          modelPath: join(DATA_DIR, 'model.onnx'),
          timestamp: new Date().toISOString()
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Evaluate model against test dataset
 */
export async function evaluateModel(testDataPath) {
  if (!existsSync(EVALUATE_SCRIPT)) {
    return {
      success: false,
      error: `Evaluate script not found at: ${EVALUATE_SCRIPT}. Create ml-service/evaluate.py to enable evaluation.`,
      timestamp: new Date().toISOString()
    };
  }

  const defaultDataPath = join(__dirname, '../../../Dataset/phishing_site_urls Combined.csv');
  const dataPath = testDataPath || defaultDataPath;

  if (!existsSync(dataPath)) {
    return {
      success: false,
      error: `Test data not found at: ${dataPath}`,
      timestamp: new Date().toISOString()
    };
  }

  return new Promise((resolve) => {
    execFile(PYTHON_CMD, [EVALUATE_SCRIPT, '--data', dataPath, '--model', join(DATA_DIR, 'model.onnx')], {
      timeout: 120000,
      cwd: join(__dirname, '../..')
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          stderr: stderr?.toString(),
          timestamp: new Date().toISOString()
        });
        return;
      }

      try {
        const metrics = JSON.parse(stdout?.toString() || '{}');
        resolve({
          success: true,
          metrics: {
            accuracy: metrics.accuracy ?? 0,
            precision: metrics.precision ?? 0,
            recall: metrics.recall ?? 0,
            f1: metrics.f1 ?? 0
          },
          timestamp: new Date().toISOString()
        });
      } catch {
        resolve({
          success: false,
          error: 'Failed to parse evaluation output',
          raw: stdout?.toString(),
          timestamp: new Date().toISOString()
        });
      }
    });
  });
}
