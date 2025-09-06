// Mock dependencies first
jest.mock('../../models/User');
jest.mock('../../models/Enterprise');
jest.mock('../../config/firebase');
jest.mock('../../utils/logger');

// Mock middleware functions with proper implementations
jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req: any, res: any, next: any) => {
    req.user = {
      uid: 'test-uid',
      email: 'test@example.com',
      role: 'super_admin',
      enterprises: ['enterprise1'],
      trace_id: 'trace-123',
    };
    next();
  }),
  authorize: jest.fn(() => (req: any, res: any, next: any) => next()),
  validateEnterpriseAccess: jest.fn((req: any, res: any, next: any) => next()),
  optionalAuth: jest.fn((req: any, res: any, next: any) => next()),
}));

import request from 'supertest';
import express from 'express';
import { authRouter } from '../../routes/auth';
import { User } from '../../models/User';
import { Enterprise } from '../../models/Enterprise';
import { sendFCMNotification } from '../../config/firebase';
import { authenticate, authorize } from '../../middleware/auth';

const mockUser = User as jest.Mocked<typeof User>;
const mockEnterprise = Enterprise as jest.Mocked<typeof Enterprise>;
const mockSendFCMNotification = sendFCMNotification as jest.MockedFunction<typeof sendFCMNotification>;
const mockAuthenticate = authenticate as jest.MockedFunction<typeof authenticate>;
const mockAuthorize = authorize as jest.MockedFunction<typeof authorize>;

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create test app
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        role: 'operator',
        enterprise_ids: ['enterprise1'],
      };

      const mockNewUser = {
        _id: 'user123',
        email: userData.email,
        role: userData.role,
        enterprises: ['enterprise1'],
        created_at: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockUser.findOne.mockResolvedValue(null); // User doesn't exist
      mockEnterprise.find.mockResolvedValue([{ _id: 'enterprise1', name: 'Test Enterprise' }] as any);
      
      // Mock User constructor
      mockUser.prototype.constructor = jest.fn().mockImplementation(() => mockNewUser);
      (mockUser as any).mockImplementation(() => mockNewUser);

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe(userData.role);
    });

    it('should return error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        role: 'operator',
      };

      mockUser.findOne.mockResolvedValue({ email: userData.email } as any);

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error.code).toBe('USER_EXISTS');
      expect(response.body.error.message).toBe('User with this email already exists');
    });

    it('should validate request body', async () => {
      const invalidData = {
        email: 'invalid-email',
        role: 'invalid-role',
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate enterprise IDs', async () => {
      const userData = {
        email: 'test@example.com',
        role: 'operator',
        enterprise_ids: ['invalid-enterprise'],
      };

      mockUser.findOne.mockResolvedValue(null);
      mockEnterprise.find.mockResolvedValue([]); // No enterprises found

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_ENTERPRISES');
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile', async () => {
      const mockUserProfile = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'operator',
        enterprises: [{ _id: 'enterprise1', name: 'Test Enterprise' }],
        created_at: new Date(),
        last_active: new Date(),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockUserProfile),
      };

      mockUser.findOne.mockReturnValue(mockQuery as any);

      const response = await request(app)
        .get('/auth/profile')
        .expect(200);

      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.role).toBe('operator');
    });

    it('should return error if user not found', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(null),
      };

      mockUser.findOne.mockReturnValue(mockQuery as any);

      const response = await request(app)
        .get('/auth/profile')
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /auth/fcm-token', () => {
    it('should add FCM token successfully', async () => {
      const mockUserWithTokens = {
        email: 'test@example.com',
        fcm_tokens: [],
        save: jest.fn(),
      };

      mockUser.findOne.mockResolvedValue(mockUserWithTokens as any);

      const response = await request(app)
        .post('/auth/fcm-token')
        .send({
          fcm_token: 'new-fcm-token',
          action: 'add',
        })
        .expect(200);

      expect(response.body.message).toBe('FCM token added successfully');
      expect(mockUserWithTokens.fcm_tokens).toContain('new-fcm-token');
      expect(mockUserWithTokens.save).toHaveBeenCalled();
    });

    it('should remove FCM token successfully', async () => {
      const mockUserWithTokens = {
        email: 'test@example.com',
        fcm_tokens: ['existing-token', 'token-to-remove'],
        save: jest.fn(),
      };

      mockUser.findOne.mockResolvedValue(mockUserWithTokens as any);

      const response = await request(app)
        .post('/auth/fcm-token')
        .send({
          fcm_token: 'token-to-remove',
          action: 'remove',
        })
        .expect(200);

      expect(response.body.message).toBe('FCM token removed successfully');
      expect(mockUserWithTokens.fcm_tokens).not.toContain('token-to-remove');
      expect(mockUserWithTokens.fcm_tokens).toContain('existing-token');
      expect(mockUserWithTokens.save).toHaveBeenCalled();
    });

    it('should not add duplicate FCM tokens', async () => {
      const mockUserWithTokens = {
        email: 'test@example.com',
        fcm_tokens: ['existing-token'],
        save: jest.fn(),
      };

      mockUser.findOne.mockResolvedValue(mockUserWithTokens as any);

      await request(app)
        .post('/auth/fcm-token')
        .send({
          fcm_token: 'existing-token',
          action: 'add',
        })
        .expect(200);

      expect(mockUserWithTokens.fcm_tokens.length).toBe(1);
      expect(mockUserWithTokens.save).toHaveBeenCalled();
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/auth/fcm-token')
        .send({
          fcm_token: '', // Invalid empty token
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/test-notification', () => {
    it('should send test notification successfully', async () => {
      const mockUserWithTokens = {
        email: 'test@example.com',
        fcm_tokens: ['token1', 'token2'],
      };

      mockUser.findOne.mockResolvedValue(mockUserWithTokens as any);
      mockSendFCMNotification.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
      } as any);

      const response = await request(app)
        .post('/auth/test-notification')
        .send({
          title: 'Test Title',
          body: 'Test Body',
          data: { key: 'value' },
        })
        .expect(200);

      expect(response.body.message).toBe('Test notification sent');
      expect(response.body.results.success_count).toBe(2);
      expect(response.body.results.failure_count).toBe(0);
      expect(mockSendFCMNotification).toHaveBeenCalledWith(
        ['token1', 'token2'],
        'Test Title',
        'Test Body',
        { key: 'value' }
      );
    });

    it('should return error if user has no FCM tokens', async () => {
      const mockUserWithoutTokens = {
        email: 'test@example.com',
        fcm_tokens: [],
      };

      mockUser.findOne.mockResolvedValue(mockUserWithoutTokens as any);

      const response = await request(app)
        .post('/auth/test-notification')
        .send({
          title: 'Test Title',
          body: 'Test Body',
        })
        .expect(400);

      expect(response.body.error.code).toBe('NO_FCM_TOKENS');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/auth/test-notification')
        .send({
          title: '', // Invalid empty title
          body: 'Test Body',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /auth/assign-enterprise', () => {
    it('should assign user to enterprise successfully', async () => {
      const mockTargetUser = {
        email: 'target@example.com',
        enterprises: [],
        save: jest.fn(),
      };

      const mockEnterpriseDoc = {
        _id: 'enterprise1',
        name: 'Test Enterprise',
      };

      mockUser.findOne.mockResolvedValue(mockTargetUser as any);
      mockEnterprise.findById.mockResolvedValue(mockEnterpriseDoc as any);

      const response = await request(app)
        .put('/auth/assign-enterprise')
        .send({
          user_email: 'target@example.com',
          enterprise_id: 'enterprise1',
          action: 'add',
        })
        .expect(200);

      expect(response.body.message).toBe('User assigned to enterprise successfully');
      expect(mockTargetUser.enterprises).toContain('enterprise1');
      expect(mockTargetUser.save).toHaveBeenCalled();
    });

    it('should remove user from enterprise successfully', async () => {
      const mockTargetUser = {
        email: 'target@example.com',
        enterprises: ['enterprise1', 'enterprise2'],
        save: jest.fn(),
      };

      const mockEnterpriseDoc = {
        _id: 'enterprise1',
        name: 'Test Enterprise',
      };

      mockUser.findOne.mockResolvedValue(mockTargetUser as any);
      mockEnterprise.findById.mockResolvedValue(mockEnterpriseDoc as any);

      const response = await request(app)
        .put('/auth/assign-enterprise')
        .send({
          user_email: 'target@example.com',
          enterprise_id: 'enterprise1',
          action: 'remove',
        })
        .expect(200);

      expect(response.body.message).toBe('User removed from enterprise successfully');
      expect(mockTargetUser.enterprises).not.toContain('enterprise1');
      expect(mockTargetUser.enterprises).toContain('enterprise2');
      expect(mockTargetUser.save).toHaveBeenCalled();
    });

    it('should return error if user not found', async () => {
      mockUser.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put('/auth/assign-enterprise')
        .send({
          user_email: 'nonexistent@example.com',
          enterprise_id: 'enterprise1',
          action: 'add',
        })
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return error if enterprise not found', async () => {
      const mockTargetUser = {
        email: 'target@example.com',
        enterprises: [],
      };

      mockUser.findOne.mockResolvedValue(mockTargetUser as any);
      mockEnterprise.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/auth/assign-enterprise')
        .send({
          user_email: 'target@example.com',
          enterprise_id: 'nonexistent-enterprise',
          action: 'add',
        })
        .expect(404);

      expect(response.body.error.code).toBe('ENTERPRISE_NOT_FOUND');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .put('/auth/assign-enterprise')
        .send({
          user_email: 'invalid-email', // Invalid email format
          enterprise_id: 'enterprise1',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});