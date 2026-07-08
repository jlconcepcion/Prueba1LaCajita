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
      expect(sanitizeString('Hello <b>World</b>')).toBe('Hello World');
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
