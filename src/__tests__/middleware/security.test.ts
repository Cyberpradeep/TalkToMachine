import request from 'supertest';
import express from 'express';
import { 
  sanitizeRequest, 
  detectThreats, 
  limitRequestSize, 
  ipFilter, 
  validateHttpMethod,
  requestTimeout 
} from '../../middleware/security';

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('sanitizeRequest', () => {
    it('should sanitize request body', async () => {
      let sanitizedBody: any;
      
      app.use(sanitizeRequest);
      app.post('/test', (req, res) => {
        sanitizedBody = req.body;
        res.json({ success: true });
      });

      await request(app)
        .post('/test')
        .send({
          message: '<script>alert("xss")</script>Hello',
          data: { nested: '../../etc/passwd' }
        });

      expect(sanitizedBody.message).not.toContain('<script>');
      expect(sanitizedBody.message).toContain('&lt;script&gt;');
    });

    it('should sanitize query parameters', async () => {
      let sanitizedQuery: any;
      
      app.use(sanitizeRequest);
      app.get('/test', (req, res) => {
        sanitizedQuery = req.query;
        res.json({ success: true });
      });

      await request(app)
        .get('/test?search=<img src=x onerror=alert(1)>&filter=../../../etc');

      expect(sanitizedQuery.search).not.toContain('<img');
      expect(sanitizedQuery.search).toContain('&lt;img');
    });
  });

  describe('detectThreats', () => {
    it('should detect SQL injection attempts', async () => {
      app.use(detectThreats);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/test')
        .send({ query: "'; DROP TABLE users; --" });

      // Should continue but log the threat
      expect(response.status).toBe(200);
    });

    it('should detect XSS attempts', async () => {
      app.use(detectThreats);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/test')
        .send({ content: '<script>alert("xss")</script>' });

      expect(response.status).toBe(200);
    });
  });

  describe
('limitRequestSize', () => {
    it('should allow requests within size limit', async () => {
      app.use(limitRequestSize(1024)); // 1KB limit
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/test')
        .send({ message: 'small message' });

      expect(response.status).toBe(200);
    });

    it('should reject requests exceeding size limit', async () => {
      const testApp = express();
      testApp.use(limitRequestSize(100)); // 100 bytes limit
      testApp.use(express.json());
      testApp.post('/test', (req, res) => res.json({ success: true }));

      const largeData = 'x'.repeat(200);
      const response = await request(testApp)
        .post('/test')
        .set('Content-Length', '200')
        .send({ message: largeData });

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('REQUEST_TOO_LARGE');
    });
  });

  describe('ipFilter', () => {
    it('should allow requests from whitelisted IPs', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(ipFilter({ whitelist: ['::ffff:127.0.0.1', '127.0.0.1'] }));
      testApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(testApp).get('/test');
      expect(response.status).toBe(200);
    });

    it('should block requests from blacklisted IPs', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(ipFilter({ blacklist: ['::ffff:127.0.0.1', '127.0.0.1'] }));
      testApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(testApp).get('/test');
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('IP_BLOCKED');
    });

    it('should block non-whitelisted IPs when whitelist is configured', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(ipFilter({ whitelist: ['192.168.1.1'] }));
      testApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(testApp).get('/test');
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('IP_NOT_ALLOWED');
    });
  });

  describe('validateHttpMethod', () => {
    it('should allow valid HTTP methods', async () => {
      app.use(validateHttpMethod(['GET', 'POST']));
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    it('should reject invalid HTTP methods', async () => {
      app.use(validateHttpMethod(['GET']));
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).post('/test');
      expect(response.status).toBe(405);
      expect(response.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('requestTimeout', () => {
    it('should timeout long-running requests', async () => {
      app.use(requestTimeout(100)); // 100ms timeout
      app.get('/test', async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(408);
      expect(response.body.error.code).toBe('REQUEST_TIMEOUT');
    });

    it('should not timeout fast requests', async () => {
      app.use(requestTimeout(200)); // 200ms timeout
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });
});