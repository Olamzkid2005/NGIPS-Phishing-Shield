/**
 * Analytics Routes - GET /v1/analytics/*
 */

import { scanHistory } from './analyze.js';

/**
 * GET /v1/analytics/trends - Returns chart data for analytics page
 */
export async function getTrendsHandler(req, res) {
  const scans = Array.from(scanHistory.values());
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;
  
  const dailyData = [];
  const weeklyData = [];
  
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayEnd = dayStart + dayMs;
    const dayScans = scans.filter(s => {
      const ts = new Date(s.timestamp).getTime();
      return ts >= dayStart && ts < dayEnd;
    });
    
    dailyData.push({
      date: new Date(dayStart).toISOString().split('T')[0],
      total: dayScans.length,
      blocked: dayScans.filter(s => s.action === 'block').length
    });
  }
  
  for (let i = 3; i >= 0; i--) {
    const weekStart = now - i * weekMs;
    const weekEnd = weekStart + weekMs;
    const weekScans = scans.filter(s => {
      const ts = new Date(s.timestamp).getTime();
      return ts >= weekStart && ts < weekEnd;
    });
    
    weeklyData.push({
      date: `Week ${4 - i}`,
      total: weekScans.length,
      blocked: weekScans.filter(s => s.action === 'block').length
    });
  }
  
  return res.json({ dailyData, weeklyData });
}

/**
 * GET /v1/analytics/top-domains - Returns top blocked domains
 */
export async function getTopDomainsHandler(req, res) {
  const scans = Array.from(scanHistory.values())
    .filter(s => s.action === 'block');
  
  const domainCounts = {};
  for (const scan of scans) {
    try {
      const url = new URL(scan.url);
      const domain = url.hostname;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch {
      continue;
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
  const scans = Array.from(scanHistory.values());
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
      const reasons = JSON.parse(scan.reasons || '[]');
      const reasonStr = reasons.join(' ').toLowerCase();
      
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

export default {
  getTrendsHandler,
  getTopDomainsHandler,
  getThreatClassificationHandler
};