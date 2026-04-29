import { describe, it, expect, beforeEach } from 'vitest';
import { monitor } from '../monitoring.js';

describe('ModelMonitor', () => {
  beforeEach(() => {
    monitor.reset();
    monitor.baselineDistribution = null;
    monitor.maxHistorySize = 10000;
  });

  it('should record predictions', () => {
    monitor.recordPrediction(0.8, true, 5);
    monitor.recordPrediction(0.2, false, 3);

    const stats = monitor.getStats();
    expect(stats.totalPredictions).toBe(2);
    expect(stats.phishingCount).toBe(1);
    expect(stats.legitimateCount).toBe(1);
  });

  it('should calculate phishing rate', () => {
    monitor.recordPrediction(0.9, true, 5);
    monitor.recordPrediction(0.9, true, 5);
    monitor.recordPrediction(0.1, false, 3);
    monitor.recordPrediction(0.1, false, 3);

    const stats = monitor.getStats();
    expect(stats.phishingRate).toBeCloseTo(0.5, 2);
  });

  it('should calculate average confidence', () => {
    monitor.recordPrediction(0.8, true, 5);
    monitor.recordPrediction(0.2, false, 5);

    const stats = monitor.getStats();
    expect(stats.avgConfidence).toBeCloseTo(0.5, 2);
  });

  it('should calculate latency percentiles', () => {
    for (let i = 0; i < 100; i++) {
      monitor.recordPrediction(0.5, false, Math.random() * 10);
    }

    const stats = monitor.getStats();
    expect(stats.latency.p50).toBeGreaterThan(0);
    expect(stats.latency.p95).toBeGreaterThanOrEqual(stats.latency.p50);
    expect(stats.latency.p99).toBeGreaterThanOrEqual(stats.latency.p95);
  });

  it('should return zero latency when no predictions', () => {
    const latency = monitor.getLatencyPercentiles();
    expect(latency.p50).toBe(0);
    expect(latency.p95).toBe(0);
    expect(latency.p99).toBe(0);
  });

  it('should detect drift when PSI > 0.2', () => {
    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }
    monitor.setBaseline();

    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.95, true, 5);
    }

    const drift = monitor.checkDrift();
    expect(drift.drifted).toBe(true);
    expect(drift.psi).toBeGreaterThan(0.2);
  });

  it('should not detect drift when PSI <= 0.2', () => {
    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }
    monitor.setBaseline();

    for (let i = 0; i < 100; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }

    const drift = monitor.checkDrift();
    expect(drift.drifted).toBe(false);
  });

  it('should not detect drift without baseline', () => {
    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.95, true, 5);
    }

    const drift = monitor.checkDrift();
    expect(drift.drifted).toBe(false);
    expect(drift.psi).toBe(0);
  });

  it('should not detect drift with fewer than 100 predictions', () => {
    for (let i = 0; i < 40; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }
    monitor.setBaseline();

    for (let i = 0; i < 40; i++) {
      monitor.recordPrediction(0.95, true, 5);
    }

    const drift = monitor.checkDrift();
    expect(drift.drifted).toBe(false);
  });

  it('should calculate confidence distribution', () => {
    monitor.recordPrediction(0.1, false, 5);
    monitor.recordPrediction(0.9, true, 5);

    const dist = monitor.getConfidenceDistribution();
    expect(dist.length).toBe(5);
    expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('should reset all data', () => {
    monitor.recordPrediction(0.8, true, 5);
    monitor.recordPrediction(0.2, false, 3);
    monitor.reset();

    const stats = monitor.getStats();
    expect(stats.totalPredictions).toBe(0);
    expect(stats.phishingCount).toBe(0);
  });

  it('should respect maxHistorySize', () => {
    monitor.maxHistorySize = 5;
    for (let i = 0; i < 10; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }

    const stats = monitor.getStats();
    expect(stats.totalPredictions).toBe(5);
  });

  it('should include recent alerts in stats', () => {
    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }
    monitor.setBaseline();
    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.95, true, 5);
    }

    monitor.checkDrift();
    const stats = monitor.getStats();
    expect(stats.drift.drifted).toBe(true);
    expect(stats.recentAlerts.length).toBeGreaterThan(0);
    expect(stats.recentAlerts[0].type).toBe('DRIFT_DETECTED');
  });

  it('should include confidence distribution in stats', () => {
    monitor.recordPrediction(0.5, false, 5);
    const stats = monitor.getStats();
    expect(stats.confidenceDistribution).toBeDefined();
    expect(stats.confidenceDistribution.length).toBe(5);
  });

  it('should clear baselineDistribution on reset', () => {
    monitor.recordPrediction(0.5, false, 5);
    monitor.setBaseline();
    expect(monitor.baselineDistribution).not.toBeNull();
    monitor.reset();
    expect(monitor.baselineDistribution).toBeNull();
  });

  it('should not create duplicate drift alerts on repeated getStats calls', () => {
    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.5, false, 5);
    }
    monitor.setBaseline();

    for (let i = 0; i < 1000; i++) {
      monitor.recordPrediction(0.95, true, 5);
    }

    monitor.checkDrift();
    monitor.checkDrift();
    monitor.checkDrift();

    const stats = monitor.getStats();
    const driftAlerts = stats.recentAlerts.filter(a => a.type === 'DRIFT_DETECTED');
    // After fix, should have at most 1 alert per drift event
    expect(driftAlerts.length).toBeLessThanOrEqual(1);
  });
});
