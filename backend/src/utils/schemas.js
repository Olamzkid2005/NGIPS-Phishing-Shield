/**
 * Request Validation Schemas using Zod
 */

import { z } from 'zod';

/**
 * URL Analysis Request
 * POST /v1/analyze
 */
export const AnalyzeSchema = z.object({
  url: z.string()
    .min(1, { message: 'URL is required' })
    .max(2048, { message: 'URL must be less than 2048 characters' })
    .refine(
      (val) => {
        try {
          if (!val.startsWith('http://') && !val.startsWith('https://')) {
            val = 'http://' + val;
          }
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid URL format' }
    ),
  timestamp: z.string().datetime().optional(),
  extensionVersion: z.string().max(20).optional()
});

/**
 * Feedback Request
 * POST /v1/feedback
 */
export const FeedbackSchema = z.object({
  scanId: z.string()
    .min(1, { message: 'scanId is required' })
    .max(50, { message: 'scanId must be less than 50 characters' }),
  isFalsePositive: z.boolean().optional(),
  userComment: z.string()
    .max(500, { message: 'Comment must be less than 500 characters' })
    .optional()
});

/**
 * Pagination Query Parameters
 * GET /v1/scans
 */
export const PaginationSchema = z.object({
  page: z.union([z.string().regex(/^\d+$/).transform(Number), z.number().int().min(1)])
    .optional()
    .default(1),
  limit: z.union([z.string().regex(/^\d+$/).transform(Number), z.number().int().min(1).max(100)])
    .optional()
    .default(50),
  action: z.enum(['block', 'allow']).optional(),
  url_contains: z.string().max(100).optional()
});

/**
 * Stats Query Parameters
 * GET /v1/stats
 */
export const StatsQuerySchema = z.object({
  period: z.enum(['1h', '24h', '7d', '30d', 'all']).optional()
});

/**
 * Settings Update Request
 * PUT /v1/settings
 */
export const SettingsSchema = z.object({
  autoRefresh: z.boolean().optional(),
  refreshInterval: z.number().int().min(5).max(300).optional(),
  notifications: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional()
});

/**
 * Feedback Status Update Request
 * PATCH /v1/feedback/:id
 */
export const FeedbackStatusSchema = z.object({
  status: z.enum(['reviewed', 'actioned'])
});

/**
 * Validate request body
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
    req.validated = result.data;
    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

export default {
  AnalyzeSchema,
  FeedbackSchema,
  PaginationSchema,
  StatsQuerySchema,
  SettingsSchema,
  FeedbackStatusSchema,
  validateBody,
  validateQuery
};