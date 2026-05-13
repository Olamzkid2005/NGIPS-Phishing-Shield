process.env.NODE_ENV = 'test';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { prisma } from '../../utils/database.js';

describe('Analyze API', () => {
  beforeEach(async () => {
    await prisma.scan.deleteMany();
    await prisma.feedback.deleteMany();
  });

  describe('POST /v1/analyze', () => {
    it('should analyze a URL', async () => {
      const res = await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://www.google.com' })
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.url).toBe('https://www.google.com');
      expect(res.body.action).toBeDefined();
      expect(res.body.confidence).toBeDefined();
      expect(res.body.threatLevel).toBeDefined();
    });

    it('should return 400 for missing URL', async () => {
      await request(app)
        .post('/v1/analyze')
        .send({})
        .expect(400);
    });

    it('should return 400 for empty URL', async () => {
      await request(app)
        .post('/v1/analyze')
        .send({ url: '' })
        .expect(400);
    });

    it('should block phishing URLs', async () => {
      const res = await request(app)
        .post('/v1/analyze')
        .send({ url: 'http://192.168.1.1/paypal-login-verify-account-secure-update' })
        .expect(200);

      expect(res.body.action).toBe('block');
      expect(['high', 'critical']).toContain(res.body.threatLevel);
    });

    it('should allow legitimate URLs', async () => {
      const res = await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://www.google.com' })
        .expect(200);

      expect(res.body.action).toBe('allow');
    });

    it('should include processing time', async () => {
      const res = await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://example.com' })
        .expect(200);

      expect(res.body.processingTime).toBeDefined();
      expect(res.body.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should include reasons array', async () => {
      const res = await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://example.com' })
        .expect(200);

      expect(Array.isArray(res.body.reasons)).toBe(true);
    });

    it('should return 400 for URL exceeding max length', async () => {
      await request(app)
        .post('/v1/analyze')
        .send({ url: 'http://example.com/' + 'a'.repeat(2100) })
        .expect(400);
    });
  });

  describe('GET /v1/scans', () => {
    it('should return scan history', async () => {
      await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://www.google.com' });

      const res = await request(app)
        .get('/v1/scans')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/v1/scans?page=1&limit=10')
        .expect(200);

      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });

    it('should filter by action', async () => {
      await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://www.google.com' });

      const res = await request(app)
        .get('/v1/scans?action=allow')
        .expect(200);

      expect(res.body.data).toBeDefined();
      res.body.data.forEach(scan => {
        expect(scan.action).toBe('allow');
      });
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
      expect(res.body.models).toBeDefined();
    });
  });

  describe('POST /v1/feedback', () => {
    it('should submit feedback', async () => {
      const analyzeRes = await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://example.com' });

      const res = await request(app)
        .post('/v1/feedback')
        .send({
          scanId: analyzeRes.body.id,
          isFalsePositive: false,
          userComment: 'Looks correct'
        })
        .expect(201);

      expect(res.body.scanId).toBe(analyzeRes.body.id);
      expect(res.body.isFalsePositive).toBe(false);
    });

    it('should return 400 for missing scanId', async () => {
      await request(app)
        .post('/v1/feedback')
        .send({ isFalsePositive: true })
        .expect(400);
    });

    it('should return 404 for non-existent scanId', async () => {
      await request(app)
        .post('/v1/feedback')
        .send({
          scanId: 'non-existent-id-12345',
          isFalsePositive: false,
          userComment: 'Test'
        })
        .expect(404);
    });
  });

  describe('GET /v1/scans/:id', () => {
    it('should return a specific scan by id', async () => {
      const analyzeRes = await request(app)
        .post('/v1/analyze')
        .send({ url: 'https://example.com' });

      const res = await request(app)
        .get(`/v1/scans/${analyzeRes.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(analyzeRes.body.id);
      expect(res.body.url).toBe('https://example.com');
    });

    it('should return 404 for non-existent scan id', async () => {
      await request(app)
        .get('/v1/scans/non-existent-id-12345')
        .expect(404);
    });
  });
});
