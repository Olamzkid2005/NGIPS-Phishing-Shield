/**
 * Statistics Route - GET /v1/stats
 * Returns real-time model monitoring statistics
 *
 * @module routes/stats
 * @requires ../utils/monitoring
 * @requires ../utils/mlInference
 * @requires ./analyze
 * @requires ../utils/feedbackRepository
 */

import { monitor } from '../utils/monitoring.js';
import { getMLStatus } from '../utils/mlInference.js';
import { scanHistory } from './analyze.js';
import { getFeedbackStats } from '../utils/feedbackRepository.js';
import { prisma } from '../utils/database.js';

/**
 * GET /v1/stats - Get aggregate statistics from database
 */
export async function getStatsHandler(req, res) {
  const monitorStats = monitor.getStats();
  const mlStatus = getMLStatus();

  // Get stats from database
  const [
    totalScansDb,
    blockedCountDb,
    recentScansLast24h,
    feedbackStats
  ] = await Promise.all([
    prisma.scan.count(),
    prisma.scan.count({ where: { action: 'block' } }),
    prisma.scan.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),
    getFeedbackStats()
  ]);

  return res.json({
    totalScans: totalScansDb,
    blockedCount: blockedCountDb,
    allowedCount: totalScansDb - blockedCountDb,
    blockRate: totalScansDb > 0 ? blockedCountDb / totalScansDb : 0,
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
    recentScansLast24h,
    totalFeedback: feedbackStats.total,
    falsePositiveReports: feedbackStats.falsePositives,
    falsePositiveRate: feedbackStats.falsePositiveRate,
    timestamp: new Date().toISOString()
  });
}
