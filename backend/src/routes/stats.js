/**
 * Statistics Route - GET /v1/stats
 * Returns real-time model monitoring statistics
 */

import { monitor } from '../utils/monitoring.js';

/**
 * GET /v1/stats - Get aggregate statistics
 */
export async function getStatsHandler(req, res) {
  const monitorStats = monitor.getStats();

  return res.json({
    totalScans: monitorStats.totalPredictions,
    blockedCount: monitorStats.phishingCount,
    allowedCount: monitorStats.legitimateCount,
    blockRate: monitorStats.phishingRate,
    threatLevelDistribution: {
      low: monitorStats.confidenceDistribution[0] + monitorStats.confidenceDistribution[1],
      medium: monitorStats.confidenceDistribution[2],
      high: monitorStats.confidenceDistribution[3],
      critical: monitorStats.confidenceDistribution[4]
    },
    avgConfidence: monitorStats.avgConfidence,
    mlModelStatus: {
      status: 'loaded',
      version: '1.0.0',
      available: ['Heuristic']
    },
    latencyPercentiles: monitorStats.latency,
    driftStatus: monitorStats.drift,
    recentAlerts: monitorStats.recentAlerts,
    confidenceDistribution: monitorStats.confidenceDistribution,
    timestamp: new Date().toISOString()
  });
}

export default { getStatsHandler };
