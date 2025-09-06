import { authenticate, authorize, validateEnterpriseAccess } from '../../middleware/auth';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../types';

// Mock dependencies
jest.mock('../../config/firebase');
jest.mock('../../models/User');
jest.mock('../../config/environment', () => ({
  config: {
    env: 'development',
    auth: { allowNoAuth: true },
    logging: { level: 'info' },
  },
}));
jest.mock('../../utils/logger');

describe('Authentication Integration Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      params: {},
      user: undefined,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow', () => {
    it('should handle complete auth flow for super admin', async () => {
      // Set debug role header
      req.headers!['x-debug-role'] = 'super_admin';
      req.params!.enterprise_id = 'test-enterprise';

      // Run authentication
      await authenticate(req as Request, res as Response, next);
      expect(req.user).toBeDefined();
      expect(req.user!.role).toBe('super_admin');
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run authorization for super admin
      const authMiddleware = authorize(['super_admin']);
      authMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run enterprise access validation (should pass for super admin)
      validateEnterpriseAccess(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle complete auth flow for enterprise admin with access', async () => {
      // Set debug role header
      req.headers!['x-debug-role'] = 'enterprise_admin';
      req.params!.enterprise_id = 'dev-enterprise'; // This matches the default dev enterprise

      // Run authentication
      await authenticate(req as Request, res as Response, next);
      expect(req.user).toBeDefined();
      expect(req.user!.role).toBe('enterprise_admin');
      expect(req.user!.enterprises).toContain('dev-enterprise');
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run authorization for enterprise admin
      const authMiddleware = authorize(['enterprise_admin', 'super_admin']);
      authMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run enterprise access validation (should pass for matching enterprise)
      validateEnterpriseAccess(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should block operator from admin endpoints', async () => {
      // Set debug role header
      req.headers!['x-debug-role'] = 'operator';

      // Run authentication
      await authenticate(req as Request, res as Response, next);
      expect(req.user).toBeDefined();
      expect(req.user!.role).toBe('operator');
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run authorization for admin-only endpoint (should fail)
      const authMiddleware = authorize(['enterprise_admin', 'super_admin']);
      authMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INSUFFICIENT_PERMISSIONS',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should block access to wrong enterprise', async () => {
      // Set debug role header
      req.headers!['x-debug-role'] = 'enterprise_admin';
      req.params!.enterprise_id = 'wrong-enterprise'; // Different from dev-enterprise

      // Run authentication
      await authenticate(req as Request, res as Response, next);
      expect(req.user).toBeDefined();
      expect(req.user!.role).toBe('enterprise_admin');
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run authorization (should pass)
      const authMiddleware = authorize(['enterprise_admin']);
      authMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Reset next mock
      (next as jest.Mock).mockClear();

      // Run enterprise access validation (should fail for wrong enterprise)
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

  describe('Role Hierarchy Tests', () => {
    const roles: UserRole[] = ['operator', 'enterprise_admin', 'super_admin'];

    roles.forEach(role => {
      it(`should properly authenticate ${role} role`, async () => {
        req.headers!['x-debug-role'] = role;

        await authenticate(req as Request, res as Response, next);
        
        expect(req.user).toBeDefined();
        expect(req.user!.role).toBe(role);
        expect(req.user!.uid).toBe('dev-user');
        expect(req.user!.email).toBe('dev@example.com');
        expect(req.user!.enterprises).toEqual(['dev-enterprise']);
        expect(req.user!.trace_id).toBeDefined();
        expect(next).toHaveBeenCalledTimes(1);
      });
    });
  });
});