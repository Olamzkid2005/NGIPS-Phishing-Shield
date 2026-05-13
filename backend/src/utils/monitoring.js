/**
 * Model Monitoring - Tracks predictions, latency, and drift detection
 */

import {
  MAX_PREDICTIONS_HISTORY,
  ALERT_CAP,
  DRIFT_PSI_THRESHOLD,
  DRIFT_CHECK_INTERVAL
} from './constants.js';

class ModelMonitor {
  constructor() {
    this.predictions = [];
    this.latencies = [];
    this.baselineDistribution = null;
    this.alerts = [];
    this.maxHistorySize = MAX_PREDICTIONS_HISTORY;
    this.onDriftCallback = null;
  }

  setOnDriftCallback(callback) {
    this.onDriftCallback = callback;
  }

  /**
   * Ensure alerts do not exceed cap - call after any alert addition
   */
  #capAlerts() {
    if (this.alerts.length >= ALERT_CAP) {
      this.alerts = this.alerts.slice(-Math.floor(ALERT_CAP / 2));
    }
  }

  recordPrediction(confidence, isPhishing, latencyMs) {
    this.predictions.push({ confidence, isPhishing, latencyMs, timestamp: Date.now() });
    this.latencies.push(latencyMs);

    if (this.predictions.length > this.maxHistorySize) {
      this.predictions = this.predictions.slice(-this.maxHistorySize);
      this.latencies = this.latencies.slice(-this.maxHistorySize);
    }

    // Auto-check drift every DRIFT_CHECK_INTERVAL predictions
    if (this.baselineDistribution && this.predictions.length % DRIFT_CHECK_INTERVAL === 0) {
      this.checkDrift();
    }
  }

  /**
   * Add an alert with automatic capping to prevent memory leaks
   */
  addAlert(alert) {
    this.alerts.push({ ...alert, timestamp: alert.timestamp || Date.now() });
    this.#capAlerts();
  }

  calculatePSI(expected, actual) {
    let psi = 0;
    for (let i = 0; i < expected.length; i++) {
      const e = Math.max(expected[i], 0.0001);
      const a = Math.max(actual[i], 0.0001);
      psi += (a - e) * Math.log(a / e);
    }
    return psi;
  }

  getConfidenceDistribution() {
    const buckets = [0, 0, 0, 0, 0];
    for (const pred of this.predictions) {
      const bucket = Math.min(4, Math.floor(pred.confidence * 5));
      buckets[bucket]++;
    }
    const total = this.predictions.length || 1;
    return buckets.map(b => b / total);
  }

  calculateDrift() {
    if (!this.baselineDistribution || this.predictions.length < 100) {
      return { drifted: false, psi: 0 };
    }

    const currentDist = this.getConfidenceDistribution();
    const psi = this.calculatePSI(this.baselineDistribution, currentDist);

    if (psi > DRIFT_PSI_THRESHOLD) {
      return { drifted: true, psi };
    }

    return { drifted: false, psi };
  }

  checkDrift() {
    const result = this.calculateDrift();

    if (result.drifted) {
      const lastAlert = this.alerts[this.alerts.length - 1];
    const lastAlertTs = lastAlert ? (typeof lastAlert.timestamp === 'number' ? lastAlert.timestamp : new Date(lastAlert.timestamp).getTime()) : 0;
    if (!lastAlert || lastAlert.type !== 'DRIFT_DETECTED' || Date.now() - lastAlertTs > 300000) {
        this.addAlert({
          type: 'DRIFT_DETECTED',
          psi: result.psi,
          message: `Data drift detected (PSI: ${result.psi.toFixed(3)}). Model retraining recommended.`
        });
        if (this.onDriftCallback) {
          Promise.resolve(this.onDriftCallback(result.psi)).catch(err => {
            if (err instanceof Error) {
              console.error('[MONITOR] Auto-retrain callback failed:', err.message);
            }
          });
        }
      }
    }

    return result;
  }

  getLatencyPercentiles() {
    if (this.latencies.length === 0) return { p50: 0, p95: 0, p99: 0 };

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  getStats() {
    const total = this.predictions.length;
    const phishingCount = this.predictions.filter(p => p.isPhishing).length;
    const drift = this.calculateDrift();
    const latency = this.getLatencyPercentiles();

    return {
      totalPredictions: total,
      phishingCount,
      legitimateCount: total - phishingCount,
      phishingRate: total > 0 ? (phishingCount / total) : 0,
      avgConfidence: total > 0 ? this.predictions.reduce((s, p) => s + p.confidence, 0) / total : 0,
      latency,
      drift,
      recentAlerts: this.alerts.slice(-10),
      confidenceDistribution: this.getConfidenceDistribution()
    };
  }

  setBaseline() {
    this.baselineDistribution = this.getConfidenceDistribution();
  }

  reset() {
    this.predictions = [];
    this.latencies = [];
    this.baselineDistribution = null;
    this.alerts = [];
  }
}

export const monitor = new ModelMonitor();
