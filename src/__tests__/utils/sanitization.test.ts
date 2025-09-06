import {
  sanitizeText,
  escapeHtml,
  sanitizeFilename,
  sanitizeEmail,
  sanitizeObjectId,
  detectSecurityThreats,
  sanitizeRequestData,
  sanitizeBase64,
  sanitizeUrl,
  removeControlCharacters,
  sanitizeApiInput,
} from '../../utils/sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeText', () => {
    it('should escape HTML by default', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeText(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('should allow HTML when specified', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeText(input, { allowHtml: true });
      expect(result).toBe(input);
    });

    it('should trim whitespace by default', () => {
      const input = '  hello world  ';
      const result = sanitizeText(input);
      expect(result).toBe('hello world');
    });

    it('should strip newlines when requested', () => {
      const input = 'line1\nline2\rline3';
      const result = sanitizeText(input, { stripNewlines: true });
      expect(result).toBe('line1 line2 line3');
    });

    it('should truncate to max length', () => {
      const input = 'hello world';
      const result = sanitizeText(input, { maxLength: 5 });
      expect(result).toBe('hello');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<>&"\'\/';
      const result = escapeHtml(input);
      expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;');
    });

    it('should not modify safe text', () => {
      const input = 'Hello World 123';
      const result = escapeHtml(input);
      expect(result).toBe(input);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      const input = 'file<>:"/\\|?*.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('file_________.txt');
    });

    it('should remove leading/trailing dots and spaces', () => {
      const input = '  ..filename..  ';
      const result = sanitizeFilename(input);
      expect(result).toBe('filename');
    });

    it('should handle empty filename', () => {
      const input = '';
      const result = sanitizeFilename(input);
      expect(result).toBe('file');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate and normalize email', () => {
      const input = '  TEST@EXAMPLE.COM  ';
      const result = sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      const inputs = ['invalid', '@example.com', 'test@', 'test..test@example.com'];
      inputs.forEach(input => {
        expect(sanitizeEmail(input)).toBeNull();
      });
    });

    it('should handle non-string input', () => {
      expect(sanitizeEmail(null as any)).toBeNull();
      expect(sanitizeEmail(123 as any)).toBeNull();
    });
  });

  describe('sanitizeObjectId', () => {
    it('should validate MongoDB ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011';
      const result = sanitizeObjectId(validId);
      expect(result).toBe(validId);
    });

    it('should reject invalid ObjectIds', () => {
      const invalidIds = ['invalid', '507f1f77bcf86cd79943901', '507f1f77bcf86cd799439011x'];
      invalidIds.forEach(id => {
        expect(sanitizeObjectId(id)).toBeNull();
      });
    });

    it('should handle non-string input', () => {
      expect(sanitizeObjectId(null as any)).toBeNull();
      expect(sanitizeObjectId(123 as any)).toBeNull();
    });
  });
});

  describe
('detectSecurityThreats', () => {
    it('should detect SQL injection', () => {
      const threats = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM passwords",
      ];

      threats.forEach(threat => {
        const result = detectSecurityThreats(threat);
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('sql_injection');
      });
    });

    it('should detect XSS attempts', () => {
      const threats = [
        '<script>alert("xss")</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<img src=x onerror=alert(1)>',
      ];

      threats.forEach(threat => {
        const result = detectSecurityThreats(threat);
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('xss');
      });
    });

    it('should detect path traversal', () => {
      const threats = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '%2e%2e%2f',
      ];

      threats.forEach(threat => {
        const result = detectSecurityThreats(threat);
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('path_traversal');
      });
    });

    it('should detect NoSQL injection', () => {
      const threats = [
        '{"$where": "this.password == this.username"}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
      ];

      threats.forEach(threat => {
        const result = detectSecurityThreats(threat);
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('nosql_injection');
      });
    });

    it('should mark safe content as safe', () => {
      const safeInputs = [
        'Hello world',
        'user@example.com',
        'Normal text with numbers 123',
      ];

      safeInputs.forEach(input => {
        const result = detectSecurityThreats(input);
        expect(result.safe).toBe(true);
        expect(result.threats).toHaveLength(0);
      });
    });
  });

  describe('sanitizeRequestData', () => {
    it('should sanitize nested objects', () => {
      const input = {
        message: '<script>alert(1)</script>',
        user: {
          name: '<img src=x onerror=alert(1)>',
          data: ['<iframe></iframe>', 'safe text'],
        },
      };

      const result = sanitizeRequestData(input);
      expect(result.message).not.toContain('<script>');
      expect(result.user.name).not.toContain('<img');
      expect(result.user.data[0]).not.toContain('<iframe>');
      expect(result.user.data[1]).toBe('safe text');
    });

    it('should handle arrays', () => {
      const input = ['<script>', 'safe', '<img>'];
      const result = sanitizeRequestData(input);
      
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe');
      expect(result[2]).not.toContain('<img>');
    });
  });

  describe('sanitizeBase64', () => {
    it('should validate base64 format', () => {
      const validBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World"
      const result = sanitizeBase64(validBase64);
      expect(result).toBe(validBase64);
    });

    it('should reject invalid base64', () => {
      const invalidBase64 = 'not-base64!@#';
      const result = sanitizeBase64(invalidBase64);
      expect(result).toBeNull();
    });

    it('should check size limits', () => {
      const largeBase64 = 'A'.repeat(1000);
      const result = sanitizeBase64(largeBase64, 100);
      expect(result).toBeNull();
    });
  });

  describe('sanitizeUrl', () => {
    it('should validate safe URLs', () => {
      const safeUrls = [
        'https://example.com',
        'http://localhost:3000',
      ];

      safeUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBe(url);
      });
    });

    it('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'ftp://example.com',
      ];

      dangerousUrls.forEach(url => {
        const result = sanitizeUrl(url);
        expect(result).toBeNull();
      });
    });

    it('should check allowed domains', () => {
      const url = 'https://evil.com';
      const result = sanitizeUrl(url, ['example.com']);
      expect(result).toBeNull();
    });
  });

  describe('removeControlCharacters', () => {
    it('should remove null bytes and control characters', () => {
      const input = 'hello\x00world\x01test\x1f';
      const result = removeControlCharacters(input);
      expect(result).toBe('helloworldtest');
    });

    it('should preserve tabs and newlines', () => {
      const input = 'hello\tworld\ntest\r';
      const result = removeControlCharacters(input);
      expect(result).toBe(input);
    });
  });

  describe('sanitizeApiInput', () => {
    it('should apply comprehensive sanitization', () => {
      const input = {
        message: '<script>alert(1)</script>',
        file: '../../../etc/passwd',
        query: "'; DROP TABLE users; --",
      };

      const result = sanitizeApiInput(input);
      
      expect(result.message).not.toContain('<script>');
      expect(result.file).not.toContain('../');
      expect(result.query).not.toContain('DROP TABLE');
    });
  });
});