import express from 'express';
import Joi from 'joi';
import { User } from '../models/User';
import { Enterprise } from '../models/Enterprise';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { UserRole } from '../types';
import { sendFCMNotification } from '../config/firebase';

const router = express.Router();

// Validation schemas
const registerUserSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('operator', 'enterprise_admin', 'super_admin').required(),
  enterprise_ids: Joi.array().items(Joi.string()).optional(),
});

const updateFCMTokenSchema = Joi.object({
  fcm_token: Joi.string().required(),
  action: Joi.string().valid('add', 'remove').default('add'),
});

const testNotificationSchema = Joi.object({
  title: Joi.string().required(),
  body: Joi.string().required(),
  data: Joi.object().optional(),
});

/**
 * POST /auth/register
 * Register a new user (super admin only)
 */
router.post('/register', authenticate, authorize(['super_admin']), async (req, res): Promise<void> => {
  const trace_id = req.user?.trace_id;

  try {
    // Validate request body
    const { error, value } = registerUserSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { email, role, enterprise_ids = [] } = value;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate enterprise IDs if provided
    const enterprises = [];
    if (enterprise_ids.length > 0) {
      const foundEnterprises = await Enterprise.find({ _id: { $in: enterprise_ids } });
      if (foundEnterprises.length !== enterprise_ids.length) {
        res.status(400).json({
          error: {
            code: 'INVALID_ENTERPRISES',
            message: 'One or more enterprise IDs are invalid',
            trace_id,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      enterprises.push(...foundEnterprises.map(e => e._id));
    }

    // Create new user
    const user = new User({
      email,
      role,
      enterprises,
      fcm_tokens: [],
    });

    await user.save();

    logger.info(`User registered: ${email} with role ${role}`, {
      trace_id,
      user_id: user._id,
      enterprises: enterprise_ids,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        enterprises: user.enterprises,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    logger.error('User registration failed:', error, { trace_id });
    res.status(500).json({
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to register user',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, async (req, res): Promise<void> => {
  const trace_id = req.user?.trace_id;

  try {
    const user = await User.findOne({ email: req.user!.email })
      .populate('enterprises', 'name')
      .select('-fcm_tokens'); // Don't expose FCM tokens

    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        enterprises: user.enterprises,
        created_at: user.created_at,
        last_active: user.last_active,
      },
    });
  } catch (error) {
    logger.error('Failed to get user profile:', error, { trace_id });
    res.status(500).json({
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch user profile',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /auth/fcm-token
 * Add or remove FCM token for push notifications
 */
router.post('/fcm-token', authenticate, async (req, res): Promise<void> => {
  const trace_id = req.user?.trace_id;

  try {
    // Validate request body
    const { error, value } = updateFCMTokenSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { fcm_token, action } = value;

    // Find user
    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update FCM tokens
    if (action === 'add') {
      if (!user.fcm_tokens.includes(fcm_token)) {
        user.fcm_tokens.push(fcm_token);
        logger.info(`FCM token added for user ${user.email}`, { trace_id });
      }
    } else if (action === 'remove') {
      user.fcm_tokens = user.fcm_tokens.filter(token => token !== fcm_token);
      logger.info(`FCM token removed for user ${user.email}`, { trace_id });
    }

    await user.save();

    res.json({
      message: `FCM token ${action === 'add' ? 'added' : 'removed'} successfully`,
      token_count: user.fcm_tokens.length,
    });
  } catch (error) {
    logger.error('FCM token update failed:', error, { trace_id });
    res.status(500).json({
      error: {
        code: 'FCM_TOKEN_UPDATE_FAILED',
        message: 'Failed to update FCM token',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /auth/test-notification
 * Send test push notification (admin only)
 */
router.post('/test-notification', authenticate, authorize(['enterprise_admin', 'super_admin']), async (req, res): Promise<void> => {
  const trace_id = req.user?.trace_id;

  try {
    // Validate request body
    const { error, value } = testNotificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { title, body, data } = value;

    // Find current user to get FCM tokens
    const user = await User.findOne({ email: req.user!.email });
    if (!user || user.fcm_tokens.length === 0) {
      res.status(400).json({
        error: {
          code: 'NO_FCM_TOKENS',
          message: 'No FCM tokens found for user',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Send test notification
    const response = await sendFCMNotification(user.fcm_tokens, title, body, data);

    logger.info(`Test notification sent to user ${user.email}`, {
      trace_id,
      success_count: response.successCount,
      failure_count: response.failureCount,
    });

    res.json({
      message: 'Test notification sent',
      results: {
        success_count: response.successCount,
        failure_count: response.failureCount,
        total_tokens: user.fcm_tokens.length,
      },
    });
  } catch (error) {
    logger.error('Test notification failed:', error, { trace_id });
    res.status(500).json({
      error: {
        code: 'NOTIFICATION_FAILED',
        message: 'Failed to send test notification',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /auth/assign-enterprise
 * Assign user to enterprise (super admin only)
 */
router.put('/assign-enterprise', authenticate, authorize(['super_admin']), async (req, res): Promise<void> => {
  const trace_id = req.user?.trace_id;

  try {
    const schema = Joi.object({
      user_email: Joi.string().email().required(),
      enterprise_id: Joi.string().required(),
      action: Joi.string().valid('add', 'remove').default('add'),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { user_email, enterprise_id, action } = value;

    // Find user
    const user = await User.findOne({ email: user_email });
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate enterprise exists
    const enterprise = await Enterprise.findById(enterprise_id);
    if (!enterprise) {
      res.status(404).json({
        error: {
          code: 'ENTERPRISE_NOT_FOUND',
          message: 'Enterprise not found',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update user enterprises
    if (action === 'add') {
      if (!user.enterprises.includes(enterprise_id)) {
        user.enterprises.push(enterprise_id);
        logger.info(`User ${user_email} assigned to enterprise ${enterprise.name}`, { trace_id });
      }
    } else if (action === 'remove') {
      user.enterprises = user.enterprises.filter(id => id.toString() !== enterprise_id);
      logger.info(`User ${user_email} removed from enterprise ${enterprise.name}`, { trace_id });
    }

    await user.save();

    res.json({
      message: `User ${action === 'add' ? 'assigned to' : 'removed from'} enterprise successfully`,
      user: {
        email: user.email,
        enterprises: user.enterprises,
      },
    });
  } catch (error) {
    logger.error('Enterprise assignment failed:', error, { trace_id });
    res.status(500).json({
      error: {
        code: 'ASSIGNMENT_FAILED',
        message: 'Failed to update enterprise assignment',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as authRouter };