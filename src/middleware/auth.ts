import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebase';
import { User } from '../models/User';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        role: UserRole;
        enterprises: string[];
        trace_id: string;
      };
    }
  }
}

/**
 * Authentication middleware that validates Firebase tokens or dev mode headers
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const trace_id = uuidv4();

  try {
    // Development mode bypass
    if (config.env === 'development' && config.auth.allowNoAuth) {
      const debugRole = req.headers['x-debug-role'] as UserRole;
      
      if (debugRole && ['operator', 'enterprise_admin', 'super_admin'].includes(debugRole)) {
        req.user = {
          uid: 'dev-user',
          email: 'dev@example.com',
          role: debugRole,
          enterprises: ['dev-enterprise'],
          trace_id,
        };
        
        logger.debug(`Development mode: Using debug role ${debugRole}`, { trace_id });
        return next();
      }
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify Firebase token
    const decodedToken = await verifyIdToken(idToken);
    
    // Find user in database
    const user = await User.findOne({ email: decodedToken.email });
    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in system',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update last active timestamp
    user.last_active = new Date();
    await user.save();

    // Set user information in request
    req.user = {
      uid: decodedToken.uid,
      email: user.email,
      role: user.role,
      enterprises: user.enterprises.map(id => id.toString()),
      trace_id,
    };

    logger.debug(`User authenticated: ${user.email} (${user.role})`, { trace_id });
    next();
  } catch (error) {
    logger.error('Authentication failed:', error, { trace_id });
    
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Authorization middleware factory for role-based access control
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();

    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.email} with role ${req.user.role}`, { 
        trace_id,
        required_roles: allowedRoles,
        user_role: req.user.role,
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.debug(`Access granted for user ${req.user.email} with role ${req.user.role}`, { trace_id });
    next();
  };
}

/**
 * Enterprise access validation middleware
 * Ensures user has access to the specified enterprise
 */
export function validateEnterpriseAccess(req: Request, res: Response, next: NextFunction): void {
  const trace_id = req.user?.trace_id || uuidv4();
  const enterpriseId = req.params.enterprise_id;

  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Super admins have access to all enterprises
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Check if user has access to the specified enterprise
  if (!enterpriseId || !req.user.enterprises.includes(enterpriseId)) {
    logger.warn(`Enterprise access denied for user ${req.user.email}`, {
      trace_id,
      requested_enterprise: enterpriseId,
      user_enterprises: req.user.enterprises,
    });

    res.status(403).json({
      error: {
        code: 'ENTERPRISE_ACCESS_DENIED',
        message: 'Access denied to this enterprise',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token is provided
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const trace_id = uuidv4();

  try {
    // Development mode bypass
    if (config.env === 'development' && config.auth.allowNoAuth) {
      const debugRole = req.headers['x-debug-role'] as UserRole;
      
      if (debugRole && ['operator', 'enterprise_admin', 'super_admin'].includes(debugRole)) {
        req.user = {
          uid: 'dev-user',
          email: 'dev@example.com',
          role: debugRole,
          enterprises: ['dev-enterprise'],
          trace_id,
        };
        
        return next();
      }
    }

    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return next();
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await verifyIdToken(idToken);
    
    const user = await User.findOne({ email: decodedToken.email });
    if (user) {
      user.last_active = new Date();
      await user.save();

      req.user = {
        uid: decodedToken.uid,
        email: user.email,
        role: user.role,
        enterprises: user.enterprises.map(id => id.toString()),
        trace_id,
      };
    }

    next();
  } catch (error) {
    // Authentication failed, but continue without user context
    logger.debug('Optional authentication failed, continuing without user context:', error);
    next();
  }
}