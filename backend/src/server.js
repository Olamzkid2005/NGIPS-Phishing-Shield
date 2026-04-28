/**
 * NGIPS Phishing Shield - Express Backend Server
 * Real-time phishing detection API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import { analyzeUrlHandler, getScansHandler, submitFeedbackHandler } from './routes/analyze.js';
import { getStatsHandler } from './routes/stats.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.'
    }
  }
});
app.use('/v1/', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ngips-phishing-shield',
    version: '1.0.0',
    models: {
      status: 'loaded',
      count: 0,
      version: '1.0.0',
      available: ['Heuristic']
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'NGIPS Phishing Shield API',
    version: '1.0.0',
    status: 'operational',
    docs: '/docs'
  });
});

// API Routes
app.post('/v1/analyze', analyzeUrlHandler);
app.get('/v1/scans', getScansHandler);
app.post('/v1/feedback', submitFeedbackHandler);
app.get('/v1/stats', getStatsHandler);

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   NGIPS Phishing Shield API - Started                  ║
║   http://localhost:${PORT}                         ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;