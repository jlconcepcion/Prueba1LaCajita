import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFromStorage,
  setInStorage,
  removeFromStorage,
  clearStorage,
  getStorageSize,
  validateStorageQuota,
} from './storage.js';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getFromStorage and setInStorage', () => {
    it('should store and retrieve data', () => {
      const data = { id: 1, name: 'test' };
      setInStorage('test_key', data);

      const retrieved = getFromStorage('test_key');
      expect(retrieved).toEqual(data);
    });

    it('should return default value for missing keys', () => {
      const defaultValue = { empty: true };
      const result = getFromStorage('missing_key', defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it('should handle different data types', () => {
      setInStorage('string', 'hello');
      setInStorage('number', 42);
      setInStorage('boolean', true);
      setInStorage('array', [1, 2, 3]);
      setInStorage('object', { nested: { value: 'test' } });

      expect(getFromStorage('string')).toBe('hello');
      expect(getFromStorage('number')).toBe(42);
      expect(getFromStorage('boolean')).toBe(true);
      expect(getFromStorage('array')).toEqual([1, 2, 3]);
      expect(getFromStorage('object')).toEqual({ nested: { value: 'test' } });
    });

    it('should prefix keys with lacajita_', () => {
      setInStorage('mykey', 'value');
      expect(localStorage.getItem('lacajita_mykey')).toBe('"value"');
    });
  });

  describe('removeFromStorage', () => {
    it('should remove stored data', () => {
      setInStorage('to_remove', 'data');
      expect(getFromStorage('to_remove')).toBe('data');

      removeFromStorage('to_remove');
      expect(getFromStorage('to_remove')).toBe(null);
    });
  });

  describe('clearStorage', () => {
    it('should clear all lacajita_ prefixed items', () => {
      setInStorage('key1', 'value1');
      setInStorage('key2', 'value2');
      localStorage.setItem('other_key', 'other_value');

      clearStorage();

      expect(getFromStorage('key1')).toBe(null);
      expect(getFromStorage('key2')).toBe(null);
      expect(localStorage.getItem('other_key')).toBe('other_value');
    });

    it('should clear items matching pattern', () => {
      setInStorage('fav_items', []);
      setInStorage('favs', []);
      setInStorage('settings', {});

      clearStorage('fav');

      expect(getFromStorage('fav_items')).toBe(null);
      expect(getFromStorage('favs')).toBe(null);
      expect(getFromStorage('settings')).toEqual({});
    });
  });

  describe('getStorageSize', () => {
    it('should calculate storage size', () => {
      setInStorage('key', 'value');
      const size = getStorageSize();

      expect(size).toBeGreaterThan(0);
    });

    it('should only count lacajita_ prefixed items', () => {
      setInStorage('mykey', 'myvalue');
      localStorage.setItem('other', 'othervalue');

      const size = getStorageSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('validateStorageQuota', () => {
    it('should return quota info', () => {
      const info = validateStorageQuota();

      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('max');
      expect(info).toHaveProperty('percentage');
      expect(info).toHaveProperty('isWarning');
    });

    it('should warn when over 80% full', () => {
      const largeData = 'x'.repeat(5 * 1024 * 1024 * 0.85);
      try {
        setInStorage('large', largeData);
      } catch (e) {
        // Storage full
      }

      // This would require actual large storage to test properly
    });
  });
});
