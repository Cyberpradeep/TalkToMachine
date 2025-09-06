import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ErrorResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = uuidv4();
  
  // Log the error
  logger.error('Request error:', {
    traceId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Determine error code
  const errorCode = error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // Create error response
  const errorResponse: ErrorResponse = {
    error: {
      code: errorCode,
      message: statusCode === 500 ? 'Internal server error' : error.message,
      details: error.details,
      trace_id: traceId,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
}

export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: Record<string, any>
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}