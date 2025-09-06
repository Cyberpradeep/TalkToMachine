import request from 'supertest';
import express from 'express';
import Joi from 'joi';
import { validateRequest, validateFileUpload, schemas } from '../../middleware/validation';

// Extend Express Request interface for file uploads
declare global {
  namespace Express {
    interface Request {
      files?: any[];
    }
  }
}

describe('Validation Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('validateRequest', () => {
    it('should validate request body successfully', async () => {
      const schema = {
        body: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().min(0).required(),
        }),
      };

      app.post('/test', validateRequest(schema), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ name: 'John', age: 25 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return validation errors for invalid body', async () => {
      const schema = {
        body: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().min(0).required(),
        }),
      };

      app.post('/test', validateRequest(schema), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ name: '', age: -1 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.validation_errors).toHaveLength(2);
    });

    it('should validate query parameters', async () => {
      const schema = {
        query: Joi.object({
          page: Joi.number().min(1).required(),
          limit: Joi.number().min(1).max(100).required(),
        }),
      };

      app.get('/test', validateRequest(schema), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test?page=1&limit=20');

      expect(response.status).toBe(200);
    });

    it('should validate path parameters', async () => {
      const schema = {
        params: Joi.object({
          id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        }),
      };

      app.get('/test/:id', validateRequest(schema), (req, res) => {
        res.json({ success: true });
      });

      const validId = '507f1f77bcf86cd799439011';
      const response = await request(app).get(`/test/${validId}`);

      expect(response.status).toBe(200);
    });

    it('should validate headers', async () => {
      const schema = {
        headers: Joi.object({
          'x-api-key': Joi.string().required(),
        }).unknown(true), // Allow other headers
      };

      app.get('/test', validateRequest(schema), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('X-API-Key', 'test-key');

      expect(response.status).toBe(200);
    });

    it('should handle multiple validation errors', async () => {
      const schema = {
        body: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().min(8).required(),
          age: Joi.number().min(18).required(),
        }),
      };

      app.post('/test', validateRequest(schema), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: '123',
          age: 16,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.details.validation_errors).toHaveLength(3);
    });
  });

  describe('validateFileUpload', () => {
    it('should pass when no files and not required', async () => {
      app.post('/upload', validateFileUpload({ required: false }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(200);
    });

    it('should fail when no files and required', async () => {
      app.post('/upload', validateFileUpload({ required: true }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_REQUIRED');
    });

    it('should validate file size', async () => {
      const mockFiles = [
        {
          originalname: 'large-file.pdf',
          size: 20 * 1024 * 1024, // 20MB
          mimetype: 'application/pdf',
        },
      ];

      app.use((req: any, res, next) => {
        req.files = mockFiles;
        next();
      });

      app.post('/upload', validateFileUpload({ maxFileSize: 10 * 1024 * 1024 }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('should validate MIME type', async () => {
      const mockFiles = [
        {
          originalname: 'script.js',
          size: 1024,
          mimetype: 'application/javascript',
        },
      ];

      app.use((req: any, res, next) => {
        req.files = mockFiles;
        next();
      });

      app.post('/upload', validateFileUpload({
        allowedMimeTypes: ['application/pdf', 'application/msword'],
      }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('should validate maximum number of files', async () => {
      const mockFiles = [
        { originalname: 'file1.pdf', size: 1024, mimetype: 'application/pdf' },
        { originalname: 'file2.pdf', size: 1024, mimetype: 'application/pdf' },
        { originalname: 'file3.pdf', size: 1024, mimetype: 'application/pdf' },
      ];

      app.use((req: any, res, next) => {
        req.files = mockFiles;
        next();
      });

      app.post('/upload', validateFileUpload({ maxFiles: 2 }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('TOO_MANY_FILES');
    });

    it('should reject empty files', async () => {
      const mockFiles = [
        {
          originalname: 'empty.pdf',
          size: 0,
          mimetype: 'application/pdf',
        },
      ];

      app.use((req: any, res, next) => {
        req.files = mockFiles;
        next();
      });

      app.post('/upload', validateFileUpload(), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('EMPTY_FILE');
    });

    it('should pass valid file upload', async () => {
      const mockFiles = [
        {
          originalname: 'document.pdf',
          size: 1024 * 1024, // 1MB
          mimetype: 'application/pdf',
        },
      ];

      app.use((req: any, res, next) => {
        req.files = mockFiles;
        next();
      });

      app.post('/upload', validateFileUpload(), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/upload');
      expect(response.status).toBe(200);
    });
  });

  describe('Predefined Schemas', () => {
    describe('enterpriseId schema', () => {
      it('should validate valid MongoDB ObjectId', () => {
        const validId = '507f1f77bcf86cd799439011';
        const { error } = schemas.enterpriseId.validate({ enterprise_id: validId });
        expect(error).toBeUndefined();
      });

      it('should reject invalid ObjectId', () => {
        const invalidId = 'invalid-id';
        const { error } = schemas.enterpriseId.validate({ enterprise_id: invalidId });
        expect(error).toBeDefined();
      });
    });

    describe('pagination schema', () => {
      it('should validate pagination parameters', () => {
        const { error, value } = schemas.pagination.validate({
          page: '2',
          limit: '50',
          sort: '-created_at',
        });

        expect(error).toBeUndefined();
        expect(value.page).toBe(2);
        expect(value.limit).toBe(50);
      });

      it('should apply defaults', () => {
        const { error, value } = schemas.pagination.validate({});
        
        expect(error).toBeUndefined();
        expect(value.page).toBe(1);
        expect(value.limit).toBe(20);
        expect(value.sort).toBe('-created_at');
      });

      it('should enforce limits', () => {
        const { error } = schemas.pagination.validate({
          page: 0,
          limit: 200,
        });

        expect(error).toBeDefined();
      });
    });

    describe('queryRequest schema', () => {
      it('should validate text query', () => {
        const { error } = schemas.queryRequest.validate({
          enterprise_id: '507f1f77bcf86cd799439011',
          operator_id: '507f1f77bcf86cd799439012',
          input_text: 'Hello, how are you?',
        });

        expect(error).toBeUndefined();
      });

      it('should validate audio query', () => {
        const { error } = schemas.queryRequest.validate({
          enterprise_id: '507f1f77bcf86cd799439011',
          operator_id: '507f1f77bcf86cd799439012',
          audio_base64: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
        });

        expect(error).toBeUndefined();
      });

      it('should require either text or audio', () => {
        const { error } = schemas.queryRequest.validate({
          enterprise_id: '507f1f77bcf86cd799439011',
          operator_id: '507f1f77bcf86cd799439012',
        });

        expect(error).toBeDefined();
      });

      it('should allow both text and audio (either/or validation)', () => {
        const { error } = schemas.queryRequest.validate({
          enterprise_id: '507f1f77bcf86cd799439011',
          operator_id: '507f1f77bcf86cd799439012',
          input_text: 'Hello',
          audio_base64: 'SGVsbG8=',
        });

        // The schema uses .or() which means either field is acceptable
        expect(error).toBeUndefined();
      });
    });

    describe('createEnterprise schema', () => {
      it('should validate enterprise creation', () => {
        const { error } = schemas.createEnterprise.validate({
          name: 'Test Enterprise',
          settings: {
            risk_threshold: 'medium',
            allowed_languages: ['en', 'ta'],
            max_query_length: 1000,
          },
        });

        expect(error).toBeUndefined();
      });

      it('should apply defaults', () => {
        const { error, value } = schemas.createEnterprise.validate({
          name: 'Test Enterprise',
        });

        expect(error).toBeUndefined();
        expect(value.settings).toBeUndefined(); // Optional field
      });
    });
  });
});