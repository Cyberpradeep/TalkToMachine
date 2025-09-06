import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, validateEnterpriseAccess, optionalAuth } from '../../middleware/auth';
import { verifyIdToken } from '../../config/firebase';
import { User } from '../../models/User';
import { config } from '../../config/environment';
import { UserRole } from '../../types';

// Mock dependencies
jest.mock('../../config/firebase');
jest.mock('../../models/User');
jest.mock('../../config/environment');
jest.mock('../../utils/logger');

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;
const mockUserFindOne = User.findOne as jest.MockedFunction<typeof User.findOne>;

describe('Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      user: undefined,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    
    // Default config mock
    (config as any) = {
      env: 'production',
      auth: {
        allowNoAuth: false,
      },
    };
  });

  describe('authenticate', () => {
    it('should authenticate user with valid Firebase token', async () => {
      const mockUser = {
        email: 'test@example.com',
        role: 'operator' as UserRole,
        enterprises: ['enterprise1'],
        last_active: new Date(),
        save: jest.fn(),
      };

      req.headers!.authorization = 'Bearer valid-token';
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-uid',
        email: 'test@example.com',
      } as any);
      mockUserFindOne.mockResolvedValue(mockUser as any);

      await authenticate(req as Request, res as Response, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(mockUserFindOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUser.save).toHaveBeenCalled();
      expect(req.user).toMatchObject({
        uid: 'firebase-uid',
        email: 'test@example.com',
        role: 'operator',
        enterprises: ['enterprise1'],
      });
      expect(next).toHaveBeenCalled();
    });

    it('should use debug role in development mode with ALLOW_NO_AUTH', async () => {
      (config as any).env = 'development';
      (config as any).auth.allowNoAuth = true;
      req.headers!['x-debug-role'] = 'enterprise_admin';

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toMatchObject({
        uid: 'dev-user',
        email: 'dev@example.com',
        role: 'enterprise_admin',
        enterprises: ['dev-enterprise'],
      });
      expect(next).toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authenticate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      req.headers!.authorization = 'Invalid token';

      await authenticate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'MISSING_TOKEN',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request when user not found in database', async () => {
      req.headers!.authorization = 'Bearer valid-token';
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-uid',
        email: 'test@example.com',
      } as any);
      mockUserFindOne.mockResolvedValue(null);

      await authenticate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'USER_NOT_FOUND',
            message: 'User not found in system',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle Firebase token verification failure', async () => {
      req.headers!.authorization = 'Bearer invalid-token';
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await authenticate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should allow access for user with correct role', () => {
      req.user = {
        uid: 'test-uid',
        email: 'test@example.com',
        role: 'enterprise_admin',
        enterprises: ['enterprise1'],
        trace_id: 'trace-123',
      };

      const middleware = authorize(['enterprise_admin', 'super_admin']);
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for user with incorrect role', () => {
      req.user = {
        uid: 'test-uid',
        email: 'test@example.com',
        role: 'operator',
        enterprises: ['enterprise1'],
        trace_id: 'trace-123',
      };

      const middleware = authorize(['enterprise_admin', 'super_admin']);
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Access denied. Required roles: enterprise_admin, super_admin',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      const middleware = authorize(['operator']);
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateEnterpriseAccess', () => {
    beforeEach(() => {
      req.params = { enterprise_id: 'enterprise1' };
    });

    it('should allow access for super admin to any enterprise', () => {
      req.user = {
        uid: 'test-uid',
        email: 'admin@example.com',
        role: 'super_admin',
        enterprises: ['enterprise2'],
        trace_id: 'trace-123',
      };

      validateEnterpriseAccess(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for user with enterprise access', () => {
      req.user = {
        uid: 'test-uid',
        email: 'user@example.com',
        role: 'enterprise_admin',
        enterprises: ['enterprise1', 'enterprise2'],
        trace_id: 'trace-123',
      };

      validateEnterpriseAccess(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for user without enterprise access', () => {
      req.user = {
        uid: 'test-uid',
        email: 'user@example.com',
        role: 'enterprise_admin',
        enterprises: ['enterprise2'],
        trace_id: 'trace-123',
      };

      validateEnterpriseAccess(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'ENTERPRISE_ACCESS_DENIED',
            message: 'Access denied to this enterprise',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      validateEnterpriseAccess(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when enterprise_id is missing', () => {
      req.params = {};
      req.user = {
        uid: 'test-uid',
        email: 'user@example.com',
        role: 'enterprise_admin',
        enterprises: ['enterprise1'],
        trace_id: 'trace-123',
      };

      validateEnterpriseAccess(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'ENTERPRISE_ACCESS_DENIED',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate user when valid token is provided', async () => {
      const mockUser = {
        email: 'test@example.com',
        role: 'operator' as UserRole,
        enterprises: ['enterprise1'],
        last_active: new Date(),
        save: jest.fn(),
      };

      req.headers!.authorization = 'Bearer valid-token';
      mockVerifyIdToken.mockResolvedValue({
        uid: 'firebase-uid',
        email: 'test@example.com',
      } as any);
      mockUserFindOne.mockResolvedValue(mockUser as any);

      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toMatchObject({
        uid: 'firebase-uid',
        email: 'test@example.com',
        role: 'operator',
        enterprises: ['enterprise1'],
      });
      expect(next).toHaveBeenCalled();
    });

    it('should continue without authentication when no token is provided', async () => {
      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when token verification fails', async () => {
      req.headers!.authorization = 'Bearer invalid-token';
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use debug role in development mode', async () => {
      (config as any).env = 'development';
      (config as any).auth.allowNoAuth = true;
      req.headers!['x-debug-role'] = 'operator';

      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toMatchObject({
        uid: 'dev-user',
        email: 'dev@example.com',
        role: 'operator',
        enterprises: ['dev-enterprise'],
      });
      expect(next).toHaveBeenCalled();
    });
  });
});