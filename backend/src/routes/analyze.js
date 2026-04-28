/**
 * Analysis Route - URL phishing detection endpoint
 * POST /v1/analyze
 */

import { v4 as uuidv4 } from 'uuid';
import { analyzeUrl } from '../utils/featureExtraction.js';

// In-memory scan history (replace with database in production)
const scanHistory = new Map();

/**
 * Store scan result
 */
function storeScan(result) {
  const scan = {
    id: result.id || `scan_${uuidv4().slice(0, 8)}`,
    url: result.url,
    action: result.action,
    confidence: result.confidence,
    threatLevel: result.threatLevel,
    reasons: result.reasons,
    modelVersion: '1.0.0',
    processingTime: result.processingTime,
    timestamp: new Date().toISOString()
  };
  
  scanHistory.set(scan.id, scan);
  
  // Keep only last 1000 scans in memory
  if (scanHistory.size > 1000) {
    const firstKey = scanHistory.keys().next().value;
    scanHistory.delete(firstKey);
  }
  
  return scan;
}

/**
 * POST /v1/analyze - Analyze URL for phishing
 */
export async function analyzeUrlHandler(req, res) {
  const { url, timestamp, extensionVersion } = req.body;
  
  // Validate URL
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_URL',
        message: 'URL is required'
      }
    });
  }
  
  if (url.length > 2048) {
    return res.status(400).json({
      error: {
        code: 'URL_TOO_LONG',
        message: 'URL must be less than 2048 characters'
      }
    });
  }
  
  try {
    const result = analyzeUrl(url);
    
    if (!result.isValid) {
      return res.status(400).json({
        error: {
          code: 'INVALID_URL_FORMAT',
          message: 'Invalid URL format'
        }
      });
    }
    
    // Store scan
    const scan = storeScan({
      id: `scan_${uuidv4().slice(0, 8)}`,
      ...result
    });
    
    // Return response
    return res.json({
      id: scan.id,
      url: scan.url,
      action: scan.action,
      confidence: scan.confidence,
      threatLevel: scan.threatLevel,
      reasons: scan.reasons,
      modelVersion: scan.modelVersion,
      processingTime: scan.processingTime,
      timestamp: scan.timestamp
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: {
        code: 'ANALYSIS_ERROR',
        message: 'Failed to analyze URL'
      }
    });
  }
}

/**
 * GET /v1/scans - Get scan history
 */
export async function getScansHandler(req, res) {
  const { page = 1, limit = 50, action, url_contains } = req.query;
  
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offset = (pageNum - 1) * limitNum;
  
  let scans = Array.from(scanHistory.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Filter by action
  if (action) {
    scans = scans.filter(s => s.action === action);
  }
  
  // Filter by URL contains
  if (url_contains) {
    scans = scans.filter(s => s.url.toLowerCase().includes(url_contains.toLowerCase()));
  }
  
  const total = scans.length;
  const paginatedScans = scans.slice(offset, offset + limitNum);
  
  return res.json({
    data: paginatedScans,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  });
}

/**
 * POST /v1/feedback - Submit feedback on scan
 */
export async function submitFeedbackHandler(req, res) {
  const { scanId, isFalsePositive, userComment } = req.body;
  
  if (!scanId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_SCAN_ID',
        message: 'scanId is required'
      }
    });
  }
  
  // For now, just acknowledge (would store in database)
  const feedback = {
    id: `fb_${uuidv4().slice(0, 8)}`,
    scanId,
    isFalsePositive: isFalsePositive || false,
    userComment: userComment || null,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  
  return res.status(201).json(feedback);
}

export default {
  analyzeUrlHandler,
  getScansHandler,
  submitFeedbackHandler
};