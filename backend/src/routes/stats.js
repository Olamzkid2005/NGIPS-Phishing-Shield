/**
 * Statistics Route - GET /v1/stats
 */

/**
 * GET /v1/stats - Get aggregate statistics
 */
export async function getStatsHandler(req, res) {
  // Stats will be calculated from in-memory store in server.js
  // For now, return empty stats
  return res.json({
    totalScans: 0,
    blockedCount: 0,
    allowedCount: 0,
    blockRate: 0,
    threatLevelDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
    avgConfidence: 0,
    recentScansLast24h: 0,
    totalFeedback: 0,
    falsePositiveReports: 0,
    falsePositiveRate: 0,
    timestamp: new Date().toISOString()
  });
}

export default { getStatsHandler };