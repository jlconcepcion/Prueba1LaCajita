import { describe, it, expect } from 'vitest';
import {
  isValidUrl,
  isValidApiOrigin,
  sanitizeString,
  validateEmbedUrl,
  validateApiUrl,
  validateItemId,
} from './validation.js';

describe('validation utilities', () => {
  describe('isValidUrl', () => {
    it('should accept valid https URLs', () => {
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://tvappbuilder.com')).toBe(true);
    });

    it('should accept valid http URLs', () => {
      expect(isValidUrl('http://localhost:5173')).toBe(true);
    });

    it('should reject javascript: URLs', () => {
      expect(isValidUrl('javascript:alert("xss")')).toBe(false);
    });

    it('should reject data: URLs', () => {
      expect(isValidUrl('data:text/html,<script>alert("xss")</script>')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidApiOrigin', () => {
    it('should accept allowed origins', () => {
      expect(isValidApiOrigin('https://tvappbuilder.com/api')).toBe(true);
      expect(isValidApiOrigin('https://localhost:5173/api')).toBe(true);
    });

    it('should accept subdomains of allowed origins', () => {
      expect(isValidApiOrigin('https://api.tvappbuilder.com/endpoint')).toBe(true);
    });

    it('should reject unknown origins', () => {
      expect(isValidApiOrigin('https://evil.com/api')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove html tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      // sanitizeString only strips < and > chars, leaving tag names as text
      expect(sanitizeString('Hello <b>World</b>')).toBe('Hello bWorld/b');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should handle non-strings', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('validateEmbedUrl', () => {
    it('should accept valid embed URLs', () => {
      expect(validateEmbedUrl('https://example.com/embed')).toBe(true);
    });

    it('should reject javascript: URLs', () => {
      expect(validateEmbedUrl('javascript:alert("xss")')).toBe(false);
    });

    it('should reject data: URLs with HTML', () => {
      expect(validateEmbedUrl('data:text/html,<script>alert("xss")</script>')).toBe(false);
    });

    it('should reject empty or invalid inputs', () => {
      expect(validateEmbedUrl('')).toBe(false);
      expect(validateEmbedUrl(null)).toBe(false);
    });

    it('should reject embeds pointing at internal/private hosts (SSRF)', () => {
      expect(validateEmbedUrl('http://localhost/admin')).toBe(false);
      expect(validateEmbedUrl('http://127.0.0.1:8080')).toBe(false);
      expect(validateEmbedUrl('http://192.168.1.1/')).toBe(false);
      expect(validateEmbedUrl('http://10.0.0.5/')).toBe(false);
      expect(validateEmbedUrl('http://172.16.0.1/')).toBe(false);
      expect(validateEmbedUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    });
  });

  describe('validateItemId', () => {
    it('should accept numeric IDs', () => {
      expect(validateItemId(123)).toBe(123);
    });

    it('should accept string numeric IDs', () => {
      expect(validateItemId('456')).toBe(456);
    });

    it('should reject non-numeric IDs', () => {
      expect(validateItemId('abc')).toBe(null);
      expect(validateItemId('12a34')).toBe(null);
    });

    it('should reject invalid inputs', () => {
      expect(validateItemId(null)).toBe(null);
      expect(validateItemId(undefined)).toBe(null);
    });
  });
});
