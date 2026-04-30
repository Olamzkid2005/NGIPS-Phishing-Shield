/**
 * Feedback Repository - Handles feedback storage
 * Uses in-memory store with database fallback when Prisma is available
 */

import { v4 as uuidv4 } from 'uuid';
import { ValidationError, NotFoundError } from './errors.js';

// In-memory feedback store
const feedbackStore = new Map();

/**
 * Create new feedback
 */
export async function createFeedback(data) {
  const { scanId, isFalsePositive, userComment } = data;
  
  const feedback = {
    id: `fb_${uuidv4().slice(0, 8)}`,
    scanId,
    isFalsePositive: isFalsePositive || false,
    userComment: userComment || null,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  feedbackStore.set(feedback.id, feedback);
  
  // TODO(tech-debt): When Prisma is available, persist to database:
  // await prisma.feedback.create({ data: feedback });
  
  return feedback;
}

/**
 * Get feedback by ID
 */
export async function getFeedbackById(id) {
  const feedback = feedbackStore.get(id);
  
  if (!feedback) {
    // TODO(tech-debt): Try database when available:
    // const feedback = await prisma.feedback.findUnique({ where: { id } });
    throw new NotFoundError('Feedback not found');
  }
  
  return feedback;
}

/**
 * Get feedback by scan ID
 */
export async function getFeedbackByScanId(scanId) {
  const feedbacks = Array.from(feedbackStore.values())
    .filter(f => f.scanId === scanId);
  
  // TODO(tech-debt): Query database when available:
  // const feedbacks = await prisma.feedback.findMany({ where: { scanId } });
  
  return feedbacks;
}

/**
 * Get all feedback with pagination
 */
export async function getAllFeedback(options = {}) {
  const { page = 1, limit = 50, status } = options;
  
  let feedbacks = Array.from(feedbackStore.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  if (status) {
    feedbacks = feedbacks.filter(f => f.status === status);
  }
  
  const offset = (page - 1) * limit;
  const paginated = feedbacks.slice(offset, offset + limit);
  
  return {
    data: paginated,
    pagination: {
      page,
      limit,
      total: feedbacks.length,
      totalPages: Math.ceil(feedbacks.length / limit)
    }
  };
}

/**
 * Update feedback status
 */
export async function updateFeedbackStatus(id, status) {
  const feedback = feedbackStore.get(id);
  
  if (!feedback) {
    throw new NotFoundError('Feedback not found');
  }
  
  feedback.status = status;
  feedbackStore.set(id, feedback);
  
  // TODO(tech-debt): Update in database when available:
  // await prisma.feedback.update({ where: { id }, data: { status } });
  
  return feedback;
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats() {
  const feedbacks = Array.from(feedbackStore.values());
  const total = feedbacks.length;
  const falsePositives = feedbacks.filter(f => f.isFalsePositive).length;
  const falsePositiveRate = total > 0 ? falsePositives / total : 0;
  
  const byStatus = { pending: 0, reviewed: 0, actioned: 0 };
  for (const feedback of feedbacks) {
    if (feedback.status in byStatus) {
      byStatus[feedback.status]++;
    }
  }
  
  return {
    total,
    falsePositives,
    falsePositiveRate: Math.round(falsePositiveRate * 10000) / 10000,
    byStatus
  };
}

export default {
  createFeedback,
  getFeedbackById,
  getFeedbackByScanId,
  getAllFeedback,
  updateFeedbackStatus,
  getFeedbackStats
};