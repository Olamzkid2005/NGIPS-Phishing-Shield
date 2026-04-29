/**
 * Feedback Admin Routes - GET/PATCH /v1/feedback (admin)
 */

import { getAllFeedback, updateFeedbackStatus } from '../utils/feedbackRepository.js';

/**
 * GET /v1/feedback - Returns all feedback (admin)
 */
export async function getAllFeedbackHandler(req, res) {
  const { page = 1, limit = 50, status } = req.query;
  
  const result = await getAllFeedback({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    status
  });
  
  return res.json({
    data: result.data.map(f => ({
      ...f,
      timestamp: f.createdAt || f.timestamp
    })),
    pagination: result.pagination
  });
}

/**
 * PATCH /v1/feedback/:id - Update feedback status
 */
export async function updateFeedbackHandler(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['reviewed', 'actioned'].includes(status)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Status must be "reviewed" or "actioned"'
      }
    });
  }
  
  const feedback = await updateFeedbackStatus(id, status);
  
  return res.json({
    id: feedback.id,
    scanId: feedback.scanId,
    isFalsePositive: feedback.isFalsePositive,
    userComment: feedback.userComment,
    status: feedback.status,
    timestamp: feedback.createdAt
  });
}

export default {
  getAllFeedbackHandler,
  updateFeedbackHandler
};