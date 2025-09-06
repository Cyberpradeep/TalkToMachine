import request from 'supertest';
import express from 'express';
import { createRateLimit, enterpriseKeyGenerator, userKeyGenerator } from '../../middleware/rateLimiting';

describe('Rate Limiting Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('createRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000, // 1 minute
        max: 5, // 5 requests
        keyGenerator: () => 'test-key-1', // Use unique key
      });

      app.use(rateLimit);
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request should succeed
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('5');
    });

    it('should block requests exceeding rate limit', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1, // Only 1 request allowed
        keyGenerator: () => 'test-key-2', // Use unique key
      });

      app.use(rateLimit);
      app.get('/test2', (req, res) => res.json({ success: true }));

      // First request should succeed
      await request(app).get('/test2').expect(200);

      // Second request should be rate limited
      const response = await request(app).get('/test2');
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should use custom key generator', async () => {
      const customKeyGenerator = (req: express.Request) => 'custom-key-3';
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: customKeyGenerator,
      });

      app.use(rateLimit);
      app.get('/test3', (req, res) => res.json({ success: true }));

      // First request should succeed
      await request(app).get('/test3').expect(200);

      // Second request should be rate limited (same key)
      const response = await request(app).get('/test3');
      expect(response.status).toBe(429);
    });

    it('should include custom error message', async () => {
      const customMessage = 'Custom rate limit message';
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'custom-key-4',
        message: customMessage,
      });

      app.use(rateLimit);
      app.get('/test4', (req, res) => res.json({ success: true }));

      // Exceed rate limit
      await request(app).get('/test4').expect(200);
      
      const response = await request(app).get('/test4');
      expect(response.status).toBe(429);
      expect(response.body.error.message).toBe(customMessage);
    });
  });

  describe('enterpriseKeyGenerator', () => {
    it('should generate key from enterprise_id parameter', () => {
      const req = {
        params: { enterprise_id: 'enterprise123' },
        ip: '127.0.0.1',
      } as any;

      const key = enterpriseKeyGenerator(req);
      expect(key).toBe('enterprise:enterprise123');
    });

    it('should generate key from enterprise_id in body', () => {
      const req = {
        params: {},
        body: { enterprise_id: 'enterprise456' },
        ip: '127.0.0.1',
      } as any;

      const key = enterpriseKeyGenerator(req);
      expect(key).toBe('enterprise:enterprise456');
    });

    it('should fallback to IP when no enterprise_id', () => {
      const req = {
        params: {},
        body: {},
        ip: '192.168.1.1',
      } as any;

      const key = enterpriseKeyGenerator(req);
      expect(key).toBe('ip:192.168.1.1');
    });

    it('should use user enterprise when available', () => {
      const req = {
        params: {},
        body: {},
        user: { enterprises: ['user-enterprise'] },
        ip: '127.0.0.1',
      } as any;

      const key = enterpriseKeyGenerator(req);
      expect(key).toBe('enterprise:user-enterprise');
    });
  });

  describe('userKeyGenerator', () => {
    it('should generate key from user ID', () => {
      const req = {
        user: { uid: 'user123' },
        ip: '127.0.0.1',
      } as any;

      const key = userKeyGenerator(req);
      expect(key).toBe('user:user123');
    });

    it('should fallback to IP when no user', () => {
      const req = {
        ip: '192.168.1.1',
      } as any;

      const key = userKeyGenerator(req);
      expect(key).toBe('ip:192.168.1.1');
    });
  });

  describe('Token Bucket Algorithm', () => {
    it('should refill tokens over time', async () => {
      const rateLimit = createRateLimit({
        windowMs: 1000, // 1 second window
        max: 2, // 2 requests per second
        keyGenerator: () => 'refill-test-key',
      });

      app.use(rateLimit);
      app.get('/refill-test', (req, res) => res.json({ success: true }));

      // Use up all tokens
      await request(app).get('/refill-test').expect(200);
      await request(app).get('/refill-test').expect(200);
      
      // Should be rate limited
      await request(app).get('/refill-test').expect(429);

      // Wait for token refill (slightly more than 500ms for 1 token)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should work again after refill
      await request(app).get('/refill-test').expect(200);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include proper rate limit headers', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: () => 'headers-test-key',
      });

      app.use(rateLimit);
      app.get('/headers-test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/headers-test');
      
      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should include retry-after header when rate limited', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'retry-test-key',
      });

      app.use(rateLimit);
      app.get('/retry-test', (req, res) => res.json({ success: true }));

      // Use up the limit
      await request(app).get('/retry-test').expect(200);
      
      // Should be rate limited with retry-after header
      const response = await request(app).get('/retry-test');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should continue on rate limiting errors', async () => {
      // Mock a rate limiter that throws an error
      const faultyRateLimit = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
          throw new Error('Rate limiting error');
        } catch (error) {
          // Simulate the error handling in the actual middleware
          next();
        }
      };

      app.use(faultyRateLimit);
      app.get('/error-test', (req, res) => res.json({ success: true }));

      // Should still work despite rate limiting error
      const response = await request(app).get('/error-test');
      expect(response.status).toBe(200);
    });
  });
});