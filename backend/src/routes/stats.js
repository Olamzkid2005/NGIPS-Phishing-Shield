/**
 * Statistics Route - GET /v1/stats
 * Returns real-time model monitoring statistics
 */

import { monitor } from '../utils/monitoring.js';
import { getMLStatus } from '../utils/mlInference.js';
import { scanHistory } from './analyze.js';
import { getFeedbackStats } from '../utils/feedbackRepository.js';

/**
 * GET /v1/stats - Get aggregate statistics
 */
export async function getStatsHandler(req, res) {
  const monitorStats = monitor.getStats();
  const mlStatus = getMLStatus();

  const scans = Array.from(scanHistory.values());
  const feedbackStats = await getFeedbackStats();

  return res.json({
    totalScans: monitorStats.totalPredictions,
    blockedCount: monitorStats.phishingCount,
    allowedCount: monitorStats.legitimateCount,
    blockRate: monitorStats.phishingRate,
    threatLevelDistribution: {
      low: (monitorStats.confidenceDistribution[0] || 0) + (monitorStats.confidenceDistribution[1] || 0),
      medium: monitorStats.confidenceDistribution[2] || 0,
      high: monitorStats.confidenceDistribution[3] || 0,
      critical: monitorStats.confidenceDistribution[4] || 0
    },
    avgConfidence: monitorStats.avgConfidence,
    mlModelStatus: {
      status: mlStatus.loaded ? 'loaded' : 'unavailable',
      version: '1.0.0',
      available: mlStatus.loaded ? ['Python Subprocess (Ensemble)', 'Heuristic'] : ['Heuristic']
    },
    latencyPercentiles: monitorStats.latency,
    driftStatus: monitorStats.drift,
    recentAlerts: monitorStats.recentAlerts,
    confidenceDistribution: monitorStats.confidenceDistribution,
    recentScansLast24h: scans.filter(s => {
      const ts = new Date(s.timestamp).getTime();
      return Date.now() - ts < 24 * 60 * 60 * 1000;
    }).length,
    totalFeedback: feedbackStats.total,
    falsePositiveReports: feedbackStats.falsePositives,
    falsePositiveRate: feedbackStats.falsePositiveRate,
    timestamp: new Date().toISOString()
  });
}

export default { getStatsHandler };
