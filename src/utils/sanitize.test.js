import { describe, it, expect } from 'vitest';
import { sanitizeEmbed, sanitizeText, isValidEmbedHtml } from './sanitize.js';

describe('sanitize utilities', () => {
  describe('sanitizeEmbed', () => {
    it('should remove fullscreen attributes', () => {
      const html = '<iframe src="https://example.com" allowfullscreen></iframe>';
      const result = sanitizeEmbed(html);
      expect(result).not.toContain('allowfullscreen');
      expect(result).toContain('iframe');
      expect(result).toContain('src="https://example.com"');
    });

    it('should preserve valid iframe tags', () => {
      const html = '<iframe src="https://example.com" width="100%" height="100%"></iframe>';
      const result = sanitizeEmbed(html);
      expect(result).toContain('iframe');
      expect(result).toContain('src=');
    });

    it('should reject invalid embed URLs', () => {
      const html = '<iframe src="javascript:alert(\'xss\')"></iframe>';
      const result = sanitizeEmbed(html);
      expect(result).not.toContain('javascript:');
    });

    it('should handle empty input', () => {
      expect(sanitizeEmbed('')).toBe('');
      expect(sanitizeEmbed(null)).toBe('');
    });

    it('should remove allow="fullscreen" directives', () => {
      const html = '<iframe allow="fullscreen"></iframe>';
      const result = sanitizeEmbed(html);
      expect(result).not.toContain('fullscreen');
    });
  });

  describe('sanitizeText', () => {
    it('should remove all HTML tags', () => {
      const text = '<script>alert("xss")</script>Hello';
      const result = sanitizeText(text);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('Hello');
    });

    it('should handle plain text', () => {
      const text = 'Hello World';
      const result = sanitizeText(text);
      expect(result).toBe('Hello World');
    });


    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
    });
  });

  describe('isValidEmbedHtml', () => {
    it('should accept valid iframe HTML', () => {
      const html = '<iframe src="https://example.com"></iframe>';
      expect(isValidEmbedHtml(html)).toBe(true);
    });

    it('should reject iframe with invalid URLs', () => {
      const html = '<iframe src="javascript:alert(\'xss\')"></iframe>';
      expect(isValidEmbedHtml(html)).toBe(false);
    });

    it('should reject script tags even from valid origins (security hardening)', () => {
      // Script tags are never allowed in embed HTML regardless of src origin
      const html = '<script src="https://example.com/script.js"></script>';
      expect(isValidEmbedHtml(html)).toBe(false);
    });

    it('should reject empty or non-embed HTML', () => {
      expect(isValidEmbedHtml('')).toBe(false);
      expect(isValidEmbedHtml('<div>Hello</div>')).toBe(false);
      expect(isValidEmbedHtml(null)).toBe(false);
    });
  });
});
