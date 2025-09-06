import { logger } from './logger';

// HTML entity encoding map
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

// SQL injection patterns to detect
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
  /(;|\-\-|\/\*|\*\/)/,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /('|(\\')|(;)|(\-\-)|(\s+(OR|AND)\s+))/i,
];

// XSS patterns to detect
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e%5c/gi,
  /\.\.%2f/gi,
  /\.\.%5c/gi,
];

// NoSQL injection patterns
const NOSQL_INJECTION_PATTERNS = [
  /\$where/gi,
  /\$ne/gi,
  /\$gt/gi,
  /\$lt/gi,
  /\$regex/gi,
  /\$or/gi,
  /\$and/gi,
];

/**
 * Sanitize text input by removing/encoding potentially dangerous characters
 */
export function sanitizeText(input: string, options: {
  maxLength?: number;
  allowHtml?: boolean;
  stripNewlines?: boolean;
  trimWhitespace?: boolean;
} = {}): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Trim whitespace if requested
  if (options.trimWhitespace !== false) {
    sanitized = sanitized.trim();
  }

  // Strip newlines if requested
  if (options.stripNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, ' ');
  }

  // Encode HTML entities if HTML is not allowed
  if (!options.allowHtml) {
    sanitized = escapeHtml(sanitized);
  }

  // Truncate to maximum length
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  return sanitized;
}

/**
 * Escape HTML entities in a string
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'\/]/g, (match) => HTML_ENTITIES[match] || match);
}

/**
 * Sanitize filename by removing dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return 'unknown';
  }

  // Remove path traversal attempts
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
  
  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = 'file';
  }
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 255 - ext.length);
    sanitized = name + ext;
  }

  return sanitized;
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  const sanitized = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitize MongoDB ObjectId
 */
export function sanitizeObjectId(id: string): string | null {
  if (typeof id !== 'string') {
    return null;
  }

  const sanitized = id.trim();
  
  // Validate ObjectId format (24 hex characters)
  if (!/^[0-9a-fA-F]{24}$/.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Detect potential security threats in input
 */
export function detectSecurityThreats(input: string): {
  threats: string[];
  safe: boolean;
} {
  const threats: string[] = [];

  if (typeof input !== 'string') {
    return { threats: [], safe: true };
  }

  // Check for SQL injection
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('sql_injection');
      break;
    }
  }

  // Check for XSS
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('xss');
      break;
    }
  }

  // Check for path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('path_traversal');
      break;
    }
  }

  // Check for NoSQL injection
  for (const pattern of NOSQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('nosql_injection');
      break;
    }
  }

  return {
    threats,
    safe: threats.length === 0,
  };
}

/**
 * Sanitization middleware for request data
 */
export function sanitizeRequestData(data: any, options: {
  maxStringLength?: number;
  allowHtml?: boolean;
  logThreats?: boolean;
} = {}): any {
  const maxLength = options.maxStringLength || 10000;
  const allowHtml = options.allowHtml || false;
  const logThreats = options.logThreats !== false;

  function sanitizeValue(value: any, path: string = ''): any {
    if (typeof value === 'string') {
      // Detect security threats
      const threatCheck = detectSecurityThreats(value);
      
      if (!threatCheck.safe && logThreats) {
        logger.warn('Security threat detected in request data:', {
          path,
          threats: threatCheck.threats,
          value: value.substring(0, 100) + (value.length > 100 ? '...' : ''),
        });
      }

      // Sanitize the string
      return sanitizeText(value, {
        maxLength,
        allowHtml,
        trimWhitespace: true,
      });
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => 
        sanitizeValue(item, `${path}[${index}]`)
      );
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedKey = sanitizeText(key, { maxLength: 100 });
        sanitized[sanitizedKey] = sanitizeValue(val, path ? `${path}.${key}` : key);
      }
      return sanitized;
    }

    return value;
  }

  return sanitizeValue(data);
}

/**
 * Validate and sanitize base64 data
 */
export function sanitizeBase64(input: string, maxSizeBytes?: number): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  // Remove whitespace and validate base64 format
  const sanitized = input.replace(/\s/g, '');
  
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(sanitized)) {
    return null;
  }

  // Check size if specified
  if (maxSizeBytes) {
    const sizeBytes = (sanitized.length * 3) / 4;
    if (sizeBytes > maxSizeBytes) {
      return null;
    }
  }

  return sanitized;
}

/**
 * Sanitize URL to prevent open redirect attacks
 */
export function sanitizeUrl(url: string, allowedDomains?: string[]): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Check allowed domains if specified
    if (allowedDomains && !allowedDomains.includes(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Remove null bytes and control characters
 */
export function removeControlCharacters(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and most control characters, but keep tabs, newlines, and carriage returns
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Comprehensive input sanitization for API requests
 */
export function sanitizeApiInput(input: any): any {
  return sanitizeRequestData(input, {
    maxStringLength: 5000,
    allowHtml: false,
    logThreats: true,
  });
}