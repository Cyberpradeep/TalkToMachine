import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger';
import { sanitizeApiInput, detectSecurityThreats } from '../utils/sanitization';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced security headers middleware
 */
export function securityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: "same-origin" },
    
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: "cross-origin" },
    
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    
    // Frameguard
    frameguard: { action: 'deny' },
    
    // Hide Powered-By header
    hidePoweredBy: true,
    
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // No Sniff
    noSniff: true,
    
    // Origin Agent Cluster
    originAgentCluster: true,
    
    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: false,
    
    // Referrer Policy
    referrerPolicy: { policy: "no-referrer" },
    
    // X-XSS-Protection
    xssFilter: true,
  });
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  const trace_id = req.user?.trace_id || uuidv4();

  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeApiInput(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeApiInput(req.query);
    }

    // Log sanitization
    logger.debug('Request sanitization completed', {
      trace_id,
      url: req.url,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error('Request sanitization error:', error, { trace_id });
    
    res.status(500).json({
      error: {
        code: 'SANITIZATION_ERROR',
        message: 'Request processing error',
        trace_id,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Security threat detection middleware
 */
export function detectThreats(req: Request, res: Response, next: NextFunction): void {
  const trace_id = req.user?.trace_id || uuidv4();

  try {
    const threats: string[] = [];
    
    // Check request body for threats
    if (req.body) {
      const bodyThreats = checkObjectForThreats(req.body, 'body');
      threats.push(...bodyThreats);
    }

    // Check query parameters for threats
    if (req.query) {
      const queryThreats = checkObjectForThreats(req.query, 'query');
      threats.push(...queryThreats);
    }

    // Check headers for threats (excluding standard headers)
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'user-agent'];
    for (const header of suspiciousHeaders) {
      const value = req.headers[header];
      if (typeof value === 'string') {
        const threatCheck = detectSecurityThreats(value);
        if (!threatCheck.safe) {
          threats.push(`header.${header}`);
        }
      }
    }

    // If threats detected, log and potentially block
    if (threats.length > 0) {
      logger.warn('Security threats detected in request:', {
        trace_id,
        url: req.url,
        method: req.method,
        ip: req.ip,
        threats,
        user_agent: req.headers['user-agent'],
      });

      // For now, just log threats. In production, you might want to block certain types
      // Uncomment the following to block requests with threats:
      /*
      res.status(400).json({
        error: {
          code: 'SECURITY_THREAT_DETECTED',
          message: 'Request contains potentially malicious content',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
      */
    }

    next();
  } catch (error) {
    logger.error('Threat detection error:', error, { trace_id });
    next(); // Continue on error to avoid blocking legitimate requests
  }
}

/**
 * Check object recursively for security threats
 */
function checkObjectForThreats(obj: any, path: string): string[] {
  const threats: string[] = [];

  if (typeof obj === 'string') {
    const threatCheck = detectSecurityThreats(obj);
    if (!threatCheck.safe) {
      threats.push(path);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      threats.push(...checkObjectForThreats(item, `${path}[${index}]`));
    });
  } else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      threats.push(...checkObjectForThreats(value, `${path}.${key}`));
    });
  }

  return threats;
}

/**
 * Request size limiting middleware
 */
export function limitRequestSize(maxSizeBytes: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();
    
    // Check Content-Length header
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      logger.warn('Request size limit exceeded:', {
        trace_id,
        content_length: contentLength,
        max_size: maxSizeBytes,
        url: req.url,
        method: req.method,
      });

      res.status(413).json({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Request size exceeds limit',
          details: {
            max_size_bytes: maxSizeBytes,
            received_size_bytes: parseInt(contentLength),
          },
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * IP whitelist/blacklist middleware
 */
export function ipFilter(options: {
  whitelist?: string[];
  blacklist?: string[];
} = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // Check blacklist first
    if (options.blacklist && options.blacklist.includes(clientIp)) {
      logger.warn('Blocked request from blacklisted IP:', {
        trace_id,
        ip: clientIp,
        url: req.url,
        method: req.method,
      });

      res.status(403).json({
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied from this IP address',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check whitelist if configured
    if (options.whitelist && !options.whitelist.includes(clientIp)) {
      logger.warn('Blocked request from non-whitelisted IP:', {
        trace_id,
        ip: clientIp,
        url: req.url,
        method: req.method,
      });

      res.status(403).json({
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address',
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Request method validation middleware
 */
export function validateHttpMethod(allowedMethods: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();

    if (!allowedMethods.includes(req.method)) {
      logger.warn('Invalid HTTP method:', {
        trace_id,
        method: req.method,
        allowed_methods: allowedMethods,
        url: req.url,
      });

      res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed`,
          details: {
            allowed_methods: allowedMethods,
          },
          trace_id,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();

    // Set request timeout
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout:', {
          trace_id,
          timeout_ms: timeoutMs,
          url: req.url,
          method: req.method,
        });

        res.status(408).json({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout',
            details: {
              timeout_ms: timeoutMs,
            },
            trace_id,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Combined security middleware stack
 */
export function applySecurity() {
  return [
    securityHeaders(),
    limitRequestSize(),
    sanitizeRequest,
    detectThreats,
  ];
}