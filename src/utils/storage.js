import { logger } from './logger.js';

const STORAGE_PREFIX = 'lacajita_';
const STORAGE_NAMESPACE = 'app';

function getStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

export function getFromStorage(key, defaultValue = null) {
  try {
    const fullKey = getStorageKey(key);
    const item = localStorage.getItem(fullKey);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    logger.warn(`Failed to read from storage: ${key}`, error);
    return defaultValue;
  }
}

export function setInStorage(key, value) {
  try {
    const fullKey = getStorageKey(key);
    localStorage.setItem(fullKey, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`Failed to write to storage: ${key}`, error);
    return false;
  }
}

export function removeFromStorage(key) {
  try {
    const fullKey = getStorageKey(key);
    localStorage.removeItem(fullKey);
    return true;
  } catch (error) {
    logger.error(`Failed to remove from storage: ${key}`, error);
    return false;
  }
}

export function clearStorage(pattern = null) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        if (!pattern || key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      }
    });
    return true;
  } catch (error) {
    logger.error('Failed to clear storage', error);
    return false;
  }
}

export function getStorageSize() {
  try {
    let total = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        total += localStorage.getItem(key).length;
      }
    });
    return total;
  } catch {
    return 0;
  }
}

export function validateStorageQuota() {
  const maxSize = 5 * 1024 * 1024;
  const currentSize = getStorageSize();
  return {
    used: currentSize,
    max: maxSize,
    percentage: (currentSize / maxSize) * 100,
    isWarning: (currentSize / maxSize) > 0.8,
  };
}
