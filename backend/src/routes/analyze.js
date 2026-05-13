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
import { prisma } from '../utils/database.js';

// Database-backed scan history
export const scanHistory = {
  async getAll() {
    return prisma.scan.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async getById(id) {
    return prisma.scan.findUnique({ where: { id } });
  },
  async create(data) {
    return prisma.scan.create({
      data: {
        id: data.id,
        url: data.url,
        action: data.action,
        confidence: data.confidence,
        threatLevel: data.threatLevel,
        reasons: JSON.stringify(data.reasons),
        modelVersion: data.modelVersion || MODEL_VERSION,
        processingTime: data.processingTime
      }
    });
  },
  async getCount() {
    return prisma.scan.count();
  },
  async getRecent(limit) {
    return prisma.scan.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }
};

// Periodic cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Cleanup old scans to prevent unbounded database growth
 */
async function cleanupOldScans() {
  const count = await prisma.scan.count();
  if (count <= SCAN_HISTORY_LIMIT) return;

  // Get IDs of oldest 20% of records to delete
  const toDelete = await prisma.scan.findMany({
    take: Math.floor(SCAN_HISTORY_LIMIT * 0.2),
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  if (toDelete.length > 0) {
    await prisma.scan.deleteMany({
      where: { id: { in: toDelete.map(r => r.id) } }
    });
    logger.info(`Removed ${toDelete.length} old scans from database`, { component: 'cleanup' });
  }
}

// Start periodic cleanup - using atomic operation to prevent race condition
let cleanupTimer = null;
function startPeriodicCleanup() {
  if (cleanupTimer !== null || process.env.NODE_ENV === 'test') return;

  cleanupTimer = setInterval(() => {
    cleanupOldScans().catch(err => logger.error('Cleanup error:', { error: err.message }));
  }, CLEANUP_INTERVAL_MS);

  logger.info(`Periodic cleanup scheduled every ${CLEANUP_INTERVAL_MS / 60000} minutes`, { component: 'cleanup' });
}

/**
 * Store scan result in database
 */
async function storeScan(result) {
  const scan = await scanHistory.create({
    id: result.id || `scan_${crypto.randomUUID().slice(0, 8)}`,
    url: result.url,
    action: result.action,
    confidence: result.confidence,
    threatLevel: result.threatLevel,
    reasons: result.reasons,
    modelVersion: MODEL_VERSION,
    processingTime: result.processingTime
  });

  // Trigger cleanup when limit reached
  const count = await prisma.scan.count();
  if (count > SCAN_HISTORY_LIMIT) {
    cleanupOldScans().catch(err => logger.error('Cleanup error:', { error: err.message }));
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
    
    // Store scan in database
    const scan = await storeScan({
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
      reasons: typeof scan.reasons === 'string' ? JSON.parse(scan.reasons) : scan.reasons,
      modelVersion: scan.modelVersion,
      processingTime: scan.processingTime,
      timestamp: scan.createdAt.toISOString(),
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
 * GET /v1/scans - Get scan history from database
 */
export async function getScansHandler(req, res) {
  const { page = 1, limit = 50, action, url_contains } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where = {};
  if (action) {
    where.action = action;
  }
  if (url_contains) {
    const sanitized = url_contains.replace(/[<>"'`]/g, '');
    where.url = { contains: sanitized };
  }

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      skip: offset,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.scan.count({ where })
  ]);

  const data = scans.map(scan => ({
    ...scan,
    reasons: typeof scan.reasons === 'string' ? JSON.parse(scan.reasons) : scan.reasons,
    timestamp: scan.createdAt.toISOString()
  }));

  return res.json({
    data,
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
  const scan = await prisma.scan.findUnique({ where: { id } });

  if (!scan) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Scan not found'
      }
    });
  }

  return res.json({
    ...scan,
    reasons: typeof scan.reasons === 'string' ? JSON.parse(scan.reasons) : scan.reasons,
    timestamp: scan.createdAt.toISOString()
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
  
  const scan = await scanHistory.getById(scanId);

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

  monitor.addAlert({
    type: 'FEEDBACK_RECEIVED',
    scanId,
    isFalsePositive,
    message: isFalsePositive ? `False positive reported for ${scan.url}` : `Positive feedback for ${scan.url}`
  });

  return res.status(201).json(feedback);
}
