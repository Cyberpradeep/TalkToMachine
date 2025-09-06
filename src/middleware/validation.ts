import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { v4 as uuidv4 } from 'uuid';

// Validation error interface
interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Request validation middleware factory
export function validateRequest(schema: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();
    const errors: ValidationError[] = [];

    try {
      // Validate request body
      if (schema.body) {
        const { error } = schema.body.validate(req.body, { abortEarly: false });
        if (error) {
          errors.push(...formatJoiErrors(error, 'body'));
        }
      }

      // Validate request parameters
      if (schema.params) {
        const { error } = schema.params.validate(req.params, { abortEarly: false });
        if (error) {
          errors.push(...formatJoiErrors(error, 'params'));
        }
      }

      // Validate query parameters
      if (schema.query) {
        const { error } = schema.query.validate(req.query, { abortEarly: false });
        if (error) {
          errors.push(...formatJoiErrors(error, 'query'));
        }
      }

      // Validate headers
      if (schema.headers) {
        const { error } = schema.headers.validate(req.headers, { abortEarly: false });
        if (error) {
          errors.push(...formatJoiErrors(error, 'headers'));
        }
      }

      // If validation errors exist, return 400
      if (errors.length > 0) {
        logger.warn('Request validation failed:', {
          trace_id,
          url: req.url,
          method: req.method,
          errors,
        });

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: {
              validation_errors: errors,
            },
            trace_id,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error:', error, { trace_id });
      
      res.status(500).json({
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Internal validation error',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Format Joi validation errors
function formatJoiErrors(joiError: Joi.ValidationError, section: string): ValidationError[] {
  return joiError.details.map(detail => ({
    field: `${section}.${detail.path.join('.')}`,
    message: detail.message,
    value: detail.context?.value,
  }));
}

// File upload validation middleware
export function validateFileUpload(options: {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  maxFiles?: number;
  required?: boolean;
} = {}) {
  const maxFileSize = options.maxFileSize || config.upload.maxFileSize;
  const allowedMimeTypes = options.allowedMimeTypes || config.upload.allowedMimeTypes;
  const maxFiles = options.maxFiles || 1;
  const required = options.required !== false;

  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();

    try {
      // Check if files are present
      const files = req.files as any[] | undefined;
      
      if (required && (!files || files.length === 0)) {
        res.status(400).json({
          error: {
            code: 'FILE_REQUIRED',
            message: 'At least one file is required',
            trace_id,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (files && files.length > 0) {
        // Validate number of files
        if (files.length > maxFiles) {
          res.status(400).json({
            error: {
              code: 'TOO_MANY_FILES',
              message: `Maximum ${maxFiles} files allowed`,
              details: {
                max_files: maxFiles,
                received_files: files.length,
              },
              trace_id,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Validate each file
        for (const file of files) {
          // Check file size
          if (file.size > maxFileSize) {
            res.status(400).json({
              error: {
                code: 'FILE_TOO_LARGE',
                message: `File "${file.originalname}" exceeds maximum size limit`,
                details: {
                  filename: file.originalname,
                  file_size: file.size,
                  max_size: maxFileSize,
                },
                trace_id,
              },
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // Check MIME type
          if (!allowedMimeTypes.includes(file.mimetype)) {
            res.status(400).json({
              error: {
                code: 'INVALID_FILE_TYPE',
                message: `File "${file.originalname}" has unsupported type`,
                details: {
                  filename: file.originalname,
                  mime_type: file.mimetype,
                  allowed_types: allowedMimeTypes,
                },
                trace_id,
              },
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // Check for empty files
          if (file.size === 0) {
            res.status(400).json({
              error: {
                code: 'EMPTY_FILE',
                message: `File "${file.originalname}" is empty`,
                details: {
                  filename: file.originalname,
                },
                trace_id,
              },
              timestamp: new Date().toISOString(),
            });
            return;
          }
        }

        logger.debug('File upload validation passed:', {
          trace_id,
          file_count: files.length,
          files: files.map(f => ({
            name: f.originalname,
            size: f.size,
            type: f.mimetype,
          })),
        });
      }

      next();
    } catch (error) {
      logger.error('File validation error:', error, { trace_id });
      
      res.status(500).json({
        error: {
          code: 'FILE_VALIDATION_ERROR',
          message: 'Internal file validation error',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Common validation schemas
export const schemas = {
  // Enterprise ID parameter validation
  enterpriseId: Joi.object({
    enterprise_id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Enterprise ID must be a valid MongoDB ObjectId',
      }),
  }),

  // Query ID parameter validation
  queryId: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Query ID must be a valid MongoDB ObjectId',
      }),
  }),

  // Pagination query validation
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),
    sort: Joi.string()
      .valid('created_at', '-created_at', 'risk', '-risk')
      .default('-created_at'),
  }),

  // Query request validation
  queryRequest: Joi.object({
    enterprise_id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    operator_id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    input_text: Joi.string()
      .max(5000)
      .optional(),
    audio_base64: Joi.string()
      .base64()
      .max(50 * 1024 * 1024) // 50MB base64 limit
      .optional(),
    language: Joi.string()
      .valid('en', 'ta', 'tanglish', 'auto')
      .default('auto'),
  }).or('input_text', 'audio_base64'),

  // Enterprise creation validation
  createEnterprise: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required(),
    settings: Joi.object({
      risk_threshold: Joi.string()
        .valid('low', 'medium', 'high', 'critical')
        .default('medium'),
      allowed_languages: Joi.array()
        .items(Joi.string().valid('en', 'ta', 'tanglish'))
        .default(['en', 'ta', 'tanglish']),
      max_query_length: Joi.number()
        .integer()
        .min(100)
        .max(10000)
        .default(5000),
    }).optional(),
  }),

  // User assignment validation
  assignAdmin: Joi.object({
    email: Joi.string()
      .email()
      .required(),
    enterprise_id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
  }),

  // FCM token registration
  registerFCMToken: Joi.object({
    fcm_token: Joi.string()
      .required()
      .min(10),
  }),
};

// Predefined validation middleware for common use cases
export const validateEnterpriseId = validateRequest({
  params: schemas.enterpriseId,
});

export const validateQueryId = validateRequest({
  params: schemas.queryId,
});

export const validatePagination = validateRequest({
  query: schemas.pagination,
});

export const validateQueryRequest = validateRequest({
  body: schemas.queryRequest,
});

export const validateCreateEnterprise = validateRequest({
  body: schemas.createEnterprise,
});

export const validateAssignAdmin = validateRequest({
  body: schemas.assignAdmin,
});

export const validateFCMToken = validateRequest({
  body: schemas.registerFCMToken,
});