/**
 * Analytics Routes - GET /v1/analytics/*
 * Provides analytics data for the dashboard
 *
 * @module routes/analytics
 * @requires ./analyze
 */

import { prisma } from '../utils/database.js';

/**
 * Safely extract domain from URL
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Safely parse timestamp
 */
function parseTimestamp(scan) {
  try {
    return new Date(scan.createdAt).getTime();
  } catch {
    return 0;
  }
}

/**
 * Get daily aggregated data from scans
 * Optimized: O(n) instead of O(n²)
 */
function getDailyData(filteredScans, days, dayMs, now) {
  const dailyData = [];
  const scansByDay = new Map();

  // Single pass: group scans by day (O(n))
  for (const scan of filteredScans) {
    const ts = parseTimestamp(scan);
    const dayStart = Math.floor(ts / dayMs) * dayMs;
    const existing = scansByDay.get(dayStart) || { total: 0, blocked: 0 };
    existing.total++;
    if (scan.action === 'block') existing.blocked++;
    scansByDay.set(dayStart, existing);
  }

  // Build daily data (O(days))
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayData = scansByDay.get(dayStart) || { total: 0, blocked: 0 };

    dailyData.push({
      date: new Date(dayStart).toISOString().split('T')[0],
      total: dayData.total,
      blocked: dayData.blocked
    });
  }

  return dailyData;
}

/**
 * Get weekly aggregated data from scans
 * Optimized: O(n) instead of O(n²)
 */
function getWeeklyData(filteredScans, days, weekMs, now) {
  const weeksToShow = Math.ceil(days / 7);
  const weeklyData = [];
  const scansByWeek = new Map();

  // Single pass: group scans by week (O(n))
  const dayMs = 24 * 60 * 60 * 1000;
  for (const scan of filteredScans) {
    const ts = parseTimestamp(scan);
    const weekStart = Math.floor(ts / weekMs) * weekMs;
    const existing = scansByWeek.get(weekStart) || { total: 0, blocked: 0 };
    existing.total++;
    if (scan.action === 'block') existing.blocked++;
    scansByWeek.set(weekStart, existing);
  }

  // Build weekly data (O(weeks))
  for (let i = weeksToShow - 1; i >= 0; i--) {
    const weekStart = now - i * weekMs;
    const weekData = scansByWeek.get(weekStart) || { total: 0, blocked: 0 };

    weeklyData.push({
      date: `Week ${weeksToShow - i}`,
      total: weekData.total,
      blocked: weekData.blocked
    });
  }

  return weeklyData;
}

/**
 * GET /v1/analytics/trends - Returns chart data for analytics page
 */
export async function getTrendsHandler(req, res) {
  const period = req.query.period || '7d';

  let days = 7;
  if (period === '24h') days = 1;
  else if (period === '30d') days = 30;
  else if (period === 'all') days = 365;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  const scans = await prisma.scan.findMany({
    where: {
      createdAt: {
        gte: new Date(now - days * dayMs)
      }
    }
  });

  const dailyData = getDailyData(scans, days, dayMs, now);
  const weeklyData = getWeeklyData(scans, days, weekMs, now);

  return res.json({ dailyData, weeklyData });
}

/**
 * GET /v1/analytics/top-domains - Returns top blocked domains
 */
export async function getTopDomainsHandler(req, res) {
  const scans = await prisma.scan.findMany({
    where: { action: 'block' }
  });

  const domainCounts = {};
  for (const scan of scans) {
    const domain = extractDomain(scan.url);
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  }

  const domains = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return res.json({ domains });
}

/**
 * GET /v1/analytics/threat-classification - Returns threat classification data
 */
export async function getThreatClassificationHandler(req, res) {
  const scans = await prisma.scan.findMany();
  const total = scans.length;

  if (total === 0) {
    return res.json({
      classification: [
        { type: 'phishing', percentage: 0 },
        { type: 'malware', percentage: 0 },
        { type: 'spam', percentage: 0 },
        { type: 'suspicious', percentage: 0 },
        { type: 'clean', percentage: 0 }
      ]
    });
  }

  const typeCounts = { phishing: 0, malware: 0, spam: 0, suspicious: 0, clean: 0 };

  for (const scan of scans) {
    if (scan.action === 'block') {
      const reasons = typeof scan.reasons === 'string' ? JSON.parse(scan.reasons) : [];
      const reasonStr = Array.isArray(reasons) ? reasons.join(' ').toLowerCase() : '';

      if (reasonStr.includes('phishing')) typeCounts.phishing++;
      else if (reasonStr.includes('malware') || reasonStr.includes('malicious')) typeCounts.malware++;
      else if (reasonStr.includes('spam')) typeCounts.spam++;
      else typeCounts.suspicious++;
    } else {
      typeCounts.clean++;
    }
  }

  const classification = Object.entries(typeCounts).map(([type, count]) => ({
    type,
    percentage: Math.round((count / total) * 10000) / 100
  }));

  return res.json({ classification });
}