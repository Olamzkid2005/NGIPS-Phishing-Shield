/**
 * Analysis Route - URL phishing detection endpoint
 * POST /v1/analyze
 *
 * @module routes/analyze
 * @requires ../utils/featureExtraction
 * @requires ../utils/monitoring
 * @requires ../utils/feedbackRepository
 */

import crypto from 'crypto';
import { analyzeUrlEnsemble } from '../utils/featureExtraction.js';
import { monitor } from '../utils/monitoring.js';
import { createFeedback } from '../utils/feedbackRepository.js';
import { SCAN_HISTORY_LIMIT, MODEL_VERSION } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

// In-memory scan history (replace with database in production)
export const scanHistory = new Map();

// Periodic cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Cleanup old scans to prevent unbounded memory growth
 */
function cleanupOldScans() {
  if (scanHistory.size <= SCAN_HISTORY_LIMIT) return;

  const sorted = [...scanHistory.entries()].sort((a, b) =>
    new Date(a[1].timestamp) - new Date(b[1].timestamp)
  );

  // Remove oldest 20% when limit exceeded
  const removeCount = Math.floor(SCAN_HISTORY_LIMIT * 0.2);
  scanHistory.clear();
  sorted.slice(removeCount).forEach(([k, v]) => scanHistory.set(k, v));

  logger.info(`Removed ${removeCount} old scans, ${scanHistory.size} remaining`, { component: 'cleanup' });
}

// Start periodic cleanup - using atomic operation to prevent race condition
let cleanupTimer = null;
function startPeriodicCleanup() {
  // Use compare-and-swap pattern to prevent race condition
  if (cleanupTimer !== null || process.env.NODE_ENV === 'test') return;

  cleanupTimer = setInterval(() => {
    cleanupOldScans();
  }, CLEANUP_INTERVAL_MS);

  logger.info(`Periodic cleanup scheduled every ${CLEANUP_INTERVAL_MS / 60000} minutes`, { component: 'cleanup' });
}

/**
 * Store scan result
 */
function storeScan(result) {
  const scan = {
    id: result.id || `scan_${crypto.randomUUID().slice(0, 8)}`,
    url: result.url,
    action: result.action,
    confidence: result.confidence,
    threatLevel: result.threatLevel,
    reasons: result.reasons,
    modelVersion: MODEL_VERSION,
    processingTime: result.processingTime,
    timestamp: new Date().toISOString()
  };

  scanHistory.set(scan.id, scan);

  // Trigger cleanup when limit reached (also handled by periodic cleanup)
  if (scanHistory.size > SCAN_HISTORY_LIMIT) {
    cleanupOldScans();
  }

  // Start periodic cleanup on first scan
  startPeriodicCleanup();

  return scan;
}

/**
 * POST /v1/analyze - Analyze URL for phishing
 */
export async function analyzeUrlHandler(req, res) {
  const { url } = req.body;
  
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
    const result = await analyzeUrlEnsemble(url);
    
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
      id: `scan_${crypto.randomUUID().slice(0, 8)}`,
      ...result
    });

    // Record prediction for monitoring
    monitor.recordPrediction(result.confidence, result.action === 'block', result.processingTime);
    
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
      timestamp: scan.timestamp,
      mlConfidence: result.mlConfidence,
      heuristicConfidence: result.heuristicConfidence,
      modelScores: result.modelScores,
      mlAvailable: result.mlAvailable
    });
    
  } catch (error) {
    logger.error('Analysis error:', { error: error.message, stack: error.stack });
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
  
  // Filter by URL contains (sanitized)
  if (url_contains) {
    const sanitized = url_contains.replace(/[<>"'`]/g, '');
    scans = scans.filter(s => s.url.toLowerCase().includes(sanitized.toLowerCase()));
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
 * GET /v1/scans/:id - Get single scan by ID
 */
export async function getScanByIdHandler(req, res) {
  const { id } = req.params;
  const scan = scanHistory.get(id);

  if (!scan) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Scan not found'
      }
    });
  }

  return res.json(scan);
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
  
  const scan = scanHistory.get(scanId);

  if (!scan) {
    return res.status(404).json({
      error: {
        code: 'SCAN_NOT_FOUND',
        message: `Scan with id ${scanId} not found`
      }
    });
  }

  const feedback = await createFeedback({
    scanId,
    isFalsePositive: isFalsePositive || false,
    userComment: userComment || null
  });

  // Persist feedback on the scan
  scan.feedback = feedback;

  scan.feedbackCorrect = isFalsePositive ? 0 : 1;
  monitor.alerts.push({
    type: 'FEEDBACK_RECEIVED',
    scanId,
    isFalsePositive,
    timestamp: Date.now(),
    message: isFalsePositive ? `False positive reported for ${scan.url}` : `Positive feedback for ${scan.url}`
  });

  return res.status(201).json(feedback);
}
