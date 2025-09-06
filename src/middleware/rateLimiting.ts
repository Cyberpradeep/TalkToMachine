import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { v4 as uuidv4 } from 'uuid';

// Token bucket implementation for rate limiting
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  // Attempt to consume tokens, returns true if successful
  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  // Refill tokens based on elapsed time
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  // Get current token count
  getTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  // Get time until next token is available (in seconds)
  getTimeUntilRefill(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return (1 - this.tokens) / this.refillRate;
  }
}

// Rate limiting store using in-memory buckets
class RateLimitStore {
  private buckets: Map<string, TokenBucket> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  getBucket(key: string, capacity: number, refillRate: number): TokenBucket {
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = new TokenBucket(capacity, refillRate);
      this.buckets.set(key, bucket);
    }
    
    return bucket;
  }

  // Remove buckets that haven't been used recently
  private cleanup(): void {
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    
    for (const [key, bucket] of this.buckets.entries()) {
      // If bucket is full and hasn't been used recently, remove it
      if (bucket.getTokens() === bucket['capacity'] && bucket['lastRefill'] < cutoff) {
        this.buckets.delete(key);
      }
    }
    
    logger.debug(`Rate limit cleanup: ${this.buckets.size} buckets remaining`);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

// Rate limiting configuration types
interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

// Create rate limiting middleware
export function createRateLimit(config: RateLimitConfig) {
  const refillRate = config.max / (config.windowMs / 1000); // tokens per second
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace_id = req.user?.trace_id || uuidv4();
    
    try {
      // Generate rate limit key
      const key = config.keyGenerator ? config.keyGenerator(req) : getDefaultKey(req);
      
      // Get or create token bucket
      const bucket = rateLimitStore.getBucket(key, config.max, refillRate);
      
      // Try to consume a token
      if (bucket.consume()) {
        // Request allowed
        const remaining = bucket.getTokens();
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
        });
        
        logger.debug(`Rate limit check passed for key: ${key}`, {
          trace_id,
          remaining,
          limit: config.max,
        });
        
        next();
      } else {
        // Rate limit exceeded
        const retryAfter = Math.ceil(bucket.getTimeUntilRefill());
        
        res.set({
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
          'Retry-After': retryAfter.toString(),
        });
        
        logger.warn(`Rate limit exceeded for key: ${key}`, {
          trace_id,
          limit: config.max,
          window_ms: config.windowMs,
          retry_after: retryAfter,
        });
        
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: config.message || 'Too many requests, please try again later',
            details: {
              limit: config.max,
              window_ms: config.windowMs,
              retry_after_seconds: retryAfter,
            },
            trace_id,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Rate limiting error:', error, { trace_id });
      // On error, allow the request to proceed
      next();
    }
  };
}

// Default key generator (IP address)
function getDefaultKey(req: Request): string {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

// Enterprise-based key generator
export function enterpriseKeyGenerator(req: Request): string {
  const enterpriseId = req.params.enterprise_id || req.body.enterprise_id || req.user?.enterprises?.[0];
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return enterpriseId ? `enterprise:${enterpriseId}` : `ip:${ip}`;
}

// User-based key generator
export function userKeyGenerator(req: Request): string {
  const userId = req.user?.uid;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return userId ? `user:${userId}` : `ip:${ip}`;
}

// Predefined rate limiters for different endpoint categories
export const queryRateLimit = createRateLimit({
  windowMs: config.rateLimits.query.windowMs,
  max: config.rateLimits.query.max,
  keyGenerator: enterpriseKeyGenerator,
  message: 'Too many queries from this enterprise, please try again later',
});

export const uploadRateLimit = createRateLimit({
  windowMs: config.rateLimits.upload.windowMs,
  max: config.rateLimits.upload.max,
  keyGenerator: enterpriseKeyGenerator,
  message: 'Too many uploads from this enterprise, please try again later',
});

export const generalRateLimit = createRateLimit({
  windowMs: config.rateLimits.general.windowMs,
  max: config.rateLimits.general.max,
  keyGenerator: getDefaultKey,
  message: 'Too many requests from this IP, please try again later',
});

// Admin endpoints rate limiter (more permissive)
export const adminRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: userKeyGenerator,
  message: 'Too many admin requests, please try again later',
});

// Health check rate limiter (very permissive)
export const healthRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  keyGenerator: getDefaultKey,
  message: 'Too many health check requests, please try again later',
});

// Cleanup function for graceful shutdown
export function cleanupRateLimiting(): void {
  rateLimitStore.destroy();
}

// Handle process shutdown
process.on('SIGTERM', cleanupRateLimiting);
process.on('SIGINT', cleanupRateLimiting);