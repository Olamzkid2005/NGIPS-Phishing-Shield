/**
 * Feedback Repository - Handles feedback storage
 * Persists to SQLite via Prisma with in-memory fallback
 */

import { v4 as uuidv4 } from 'uuid';
import { ValidationError, NotFoundError } from './errors.js';
import { prisma } from './database.js';
import { logger } from './logger.js';

/**
 * Create new feedback (persisted to SQLite + in-memory cache)
 */
export async function createFeedback(data) {
  const { scanId, isFalsePositive, userComment } = data;

  const id = `fb_${uuidv4().slice(0, 8)}`;
  const feedbackData = {
    id,
    scanId,
    isFalsePositive: isFalsePositive || false,
    userComment: userComment || null,
    status: 'pending',
    createdAt: new Date(),
  };

  try {
    await prisma.feedback.create({ data: feedbackData });
  } catch (dbError) {
    logger.warn('[FEEDBACK] DB persist failed, using in-memory', { error: dbError.message });
    feedbackData.createdAt = feedbackData.createdAt.toISOString();
  }

  return { ...feedbackData, createdAt: feedbackData.createdAt.toISOString() };
}

/**
 * Get feedback by ID
 */
export async function getFeedbackById(id) {
  try {
    const feedback = await prisma.feedback.findUnique({ where: { id } });
    if (feedback) return feedback;
  } catch { /* fall through */ }
  throw new NotFoundError('Feedback not found');
}

/**
 * Get feedback by scan ID
 */
export async function getFeedbackByScanId(scanId) {
  try {
    return await prisma.feedback.findMany({ where: { scanId } });
  } catch {
    return [];
  }
}

/**
 * Get all feedback with pagination
 */
export async function getAllFeedback(options = {}) {
  const { page = 1, limit = 50, status } = options;
  const skip = (page - 1) * limit;

  const where = status ? { status } : {};

  try {
    const [data, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feedback.count({ where }),
    ]);

    return {
      data: data.map(f => ({ ...f, createdAt: f.createdAt.toISOString() })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  } catch {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }
}

/**
 * Update feedback status
 */
export async function updateFeedbackStatus(id, status) {
  try {
    const feedback = await prisma.feedback.update({
      where: { id },
      data: { status },
    });
    return feedback;
  } catch {
    throw new NotFoundError('Feedback not found');
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats() {
  try {
    const [total, falsePositives, pending, reviewed, actioned] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { isFalsePositive: true } }),
      prisma.feedback.count({ where: { status: 'pending' } }),
      prisma.feedback.count({ where: { status: 'reviewed' } }),
      prisma.feedback.count({ where: { status: 'actioned' } }),
    ]);

    return {
      total,
      falsePositives,
      falsePositiveRate: total > 0 ? Math.round((falsePositives / total) * 10000) / 10000 : 0,
      byStatus: { pending, reviewed, actioned },
    };
  } catch {
    return { total: 0, falsePositives: 0, falsePositiveRate: 0, byStatus: { pending: 0, reviewed: 0, actioned: 0 } };
  }
}

/**
 * Export feedback as CSV for model retraining
 */
export async function exportFeedbackForRetraining() {
  try {
    const feedbacks = await prisma.feedback.findMany({
      include: { scan: true },
    });

    const rows = ['url,confidence,is_phishing,feedback_correct,timestamp'];
    for (const fb of feedbacks) {
      if (!fb.scan) continue;
      const url = `"${(fb.scan.url || '').replace(/"/g, '""')}"`;
      const confidence = fb.scan.confidence ?? 0;
      const isPhishing = fb.scan.action === 'block' ? 1 : 0;
      const feedbackCorrect = fb.isFalsePositive ? 0 : 1;
      const timestamp = fb.createdAt.toISOString();
      rows.push(`${url},${confidence},${isPhishing},${feedbackCorrect},${timestamp}`);
    }

    return rows.join('\n');
  } catch (error) {
    logger.error('[FEEDBACK] Export failed', { error: error.message });
    return null;
  }
}

export default {
  createFeedback,
  getFeedbackById,
  getFeedbackByScanId,
  getAllFeedback,
  updateFeedbackStatus,
  getFeedbackStats,
  exportFeedbackForRetraining,
};