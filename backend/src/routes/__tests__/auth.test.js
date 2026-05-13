process.env.NODE_ENV = 'test';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('Auth API', () => {
  describe('POST /v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'demo@example.com', password: 'demo123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('demo@example.com');
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ password: 'demo123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'demo@example.com' });

      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'demo@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const res = await request(app)
        .post('/v1/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return 401 for invalid refresh token', async () => {
      const res = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/v1/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return 401 for no token', async () => {
      const res = await request(app).get('/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return user info with valid token', async () => {
      // First login to get a token
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'demo@example.com', password: 'demo123' });

      const token = loginRes.body.accessToken;

      const res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('role');
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});