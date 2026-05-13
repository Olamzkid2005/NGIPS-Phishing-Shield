/**
 * E2E API Tests - Critical User Flows
 * Tests the full request/response cycle for key API endpoints
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('E2E API Flows', () => {
  let api;
  let baseURL;

  beforeAll(async () => {
    // Use supertest-like approach via fetch for API testing
    api = {
      async request(method, path, body = null, headers = {}) {
        const url = `${baseURL || BASE_URL}${path}`;
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        };
        if (body) {
          options.body = JSON.stringify(body);
        }
        const res = await fetch(url, options);
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data, ok: res.ok };
      },
      get: (path, headers) => api.request('GET', path, null, headers),
      post: (path, body, headers) => api.request('POST', path, body, headers),
      put: (path, body, headers) => api.request('PUT', path, body, headers),
      patch: (path, body, headers) => api.request('PATCH', path, body, headers),
      delete: (path, headers) => api.request('DELETE', path, null, headers),
    };
  });

  describe('1. URL Analysis Flow', () => {
    it('should analyze a legitimate URL and return allow action', async () => {
      const res = await api.post('/v1/analyze', { url: 'https://www.google.com' });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('id');
      expect(res.data).toHaveProperty('action');
      expect(res.data.action).toBe('allow');
      expect(res.data).toHaveProperty('confidence');
      expect(res.data).toHaveProperty('threatLevel');
      expect(res.data).toHaveProperty('reasons');
      expect(res.data).toHaveProperty('processingTime');
    });

    it('should analyze a phishing URL and return block action', async () => {
      const res = await api.post('/v1/analyze', {
        url: 'http://192.168.1.1/paypal-login-verify-account-secure-update'
      });

      expect(res.status).toBe(200);
      expect(res.data.action).toBe('block');
      expect(['high', 'critical']).toContain(res.data.threatLevel);
    });

    it('should reject invalid URL', async () => {
      const res = await api.post('/v1/analyze', { url: '' });

      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error');
    });

    it('should reject missing URL', async () => {
      const res = await api.post('/v1/analyze', {});

      expect(res.status).toBe(400);
    });

    it('should reject URL exceeding max length', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      const res = await api.post('/v1/analyze', { url: longUrl });

      expect(res.status).toBe(400);
    });
  });

  describe('2. Authentication Flow', () => {
    let accessToken;
    let refreshToken;

    it('should login with valid credentials', async () => {
      const res = await api.post('/v1/auth/login', {
        email: 'demo@example.com',
        password: 'demo123'
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('accessToken');
      expect(res.data).toHaveProperty('refreshToken');
      expect(res.data).toHaveProperty('user');
      expect(res.data.user.email).toBe('demo@example.com');

      accessToken = res.data.accessToken;
      refreshToken = res.data.refreshToken;
    });

    it('should reject login with invalid credentials', async () => {
      const res = await api.post('/v1/auth/login', {
        email: 'demo@example.com',
        password: 'wrongpassword'
      });

      expect(res.status).toBe(401);
      expect(res.data.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const res = await api.post('/v1/auth/login', {});

      expect(res.status).toBe(400);
      expect(res.data.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should get current user info with valid token', async () => {
      const res = await api.get('/v1/auth/me', {
        'Authorization': `Bearer ${accessToken}`
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('email');
      expect(res.data).toHaveProperty('role');
    });

    it('should reject unauthorized request without token', async () => {
      const res = await api.get('/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.data.error.code).toBe('UNAUTHORIZED');
    });

    it('should refresh access token', async () => {
      const res = await api.post('/v1/auth/refresh', {
        refreshToken: refreshToken
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('accessToken');
      expect(res.data).toHaveProperty('refreshToken');
    });

    it('should logout successfully', async () => {
      const res = await api.post('/v1/auth/logout', {
        refreshToken: refreshToken
      });

      expect(res.status).toBe(200);
    });
  });

  describe('3. Scan History Flow', () => {
    let scanId;

    it('should create a scan and retrieve it from history', async () => {
      // Create scan
      const createRes = await api.post('/v1/analyze', {
        url: 'https://example.com/test'
      });

      expect(createRes.status).toBe(200);
      scanId = createRes.data.id;

      // Retrieve scan history
      const historyRes = await api.get('/v1/scans');

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.data.data)).toBe(true);
      expect(historyRes.data.data.length).toBeGreaterThan(0);
    });

    it('should retrieve specific scan by id', async () => {
      const res = await api.get(`/v1/scans/${scanId}`);

      expect(res.status).toBe(200);
      expect(res.data.id).toBe(scanId);
    });

    it('should filter scans by action', async () => {
      // Create a blocked scan
      await api.post('/v1/analyze', {
        url: 'http://phishing.test.com/login'
      });

      const res = await api.get('/v1/scans?action=block');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await api.get('/v1/scans?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.data.pagination).toHaveProperty('page');
      expect(res.data.pagination).toHaveProperty('limit');
    });
  });

  describe('4. Protected Endpoints Flow', () => {
    let token;

    beforeAll(async () => {
      const loginRes = await api.post('/v1/auth/login', {
        email: 'demo@example.com',
        password: 'demo123'
      });
      token = loginRes.data.accessToken;
    });

    it('should access stats with auth', async () => {
      const res = await api.get('/v1/stats', {
        'Authorization': `Bearer ${token}`
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('totalScans');
      expect(res.data).toHaveProperty('blockedCount');
      expect(res.data).toHaveProperty('allowedCount');
    });

    it('should access settings with auth', async () => {
      const res = await api.get('/v1/settings', {
        'Authorization': `Bearer ${token}`
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('autoRefresh');
    });

    it('should update settings with auth', async () => {
      const res = await api.patch('/v1/settings',
        { theme: 'light' },
        { 'Authorization': `Bearer ${token}` }
      );

      expect(res.status).toBe(200);
      expect(res.data.theme).toBe('light');
    });

    it('should reject access to protected endpoints without auth', async () => {
      const protectedEndpoints = [
        '/v1/stats',
        '/v1/settings',
        '/v1/feedback',
        '/v1/analytics/summary'
      ];

      for (const endpoint of protectedEndpoints) {
        const res = await api.get(endpoint);
        expect(res.status).toBe(401);
      }
    });
  });

  describe('5. Feedback Flow', () => {
    let scanId;
    let token;

    beforeAll(async () => {
      const loginRes = await api.post('/v1/auth/login', {
        email: 'demo@example.com',
        password: 'demo123'
      });
      token = loginRes.data.accessToken;

      const scanRes = await api.post('/v1/analyze', {
        url: 'https://example.com'
      });
      scanId = scanRes.data.id;
    });

    it('should submit feedback for a scan', async () => {
      const res = await api.post('/v1/feedback', {
        scanId: scanId,
        isFalsePositive: true,
        userComment: 'This is a legitimate site'
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('id');
    });

    it('should reject feedback without scanId', async () => {
      const res = await api.post('/v1/feedback', {
        isFalsePositive: true
      });

      expect(res.status).toBe(400);
    });

    it('should reject feedback for non-existent scan', async () => {
      const res = await api.post('/v1/feedback', {
        scanId: 'non-existent-id',
        isFalsePositive: true
      });

      expect(res.status).toBe(404);
    });
  });

  describe('6. Health Check', () => {
    it('should return healthy status', async () => {
      const res = await api.get('/health');

      expect(res.status).toBe(200);
      expect(res.data.status).toBe('healthy');
    });
  });
});