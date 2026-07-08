import { validateApiUrl, validateItemId } from './validation.js';

const API_BASE = import.meta.env.VITE_API_BASE;
const APP_ID = import.meta.env.VITE_APP_ID;
const API_VERSION = '1.0.0';
const REQUEST_TIMEOUT = 10000;

class ApiError extends Error {
  constructor(message, status, originalError) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.originalError = originalError;
  }
}

const requestQueue = new Map();
const RATE_LIMIT_DELAY = 500;

function getQueueKey(url) {
  return url.split('?')[0];
}

async function enqueueRequest(url, options = {}) {
  const key = getQueueKey(url);

  if (!requestQueue.has(key)) {
    requestQueue.set(key, { lastTime: 0, queue: [] });
  }

  const queue = requestQueue.get(key);
  const timeSinceLastRequest = Date.now() - queue.lastTime;
  const delayNeeded = Math.max(0, RATE_LIMIT_DELAY - timeSinceLastRequest);

  if (delayNeeded > 0) {
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }

  queue.lastTime = Date.now();
  return fetch(url, options);
}

export async function fetchFromApi(endpoint, params = {}) {
  try {
    const url = validateApiUrl(API_BASE, endpoint, {
      ...params,
      church: APP_ID,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response;
    try {
      response = await enqueueRequest(url, {
        signal: controller.signal,
        headers: {
          'X-API-Version': API_VERSION,
          'Accept': 'application/json',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, response.status);
    }

    const data = await response.json();

    if (data.success === false) {
      throw new ApiError('API returned success: false', 200);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Unknown error', 500, error);
  }
}

export async function fetchFeed() {
  return fetchFromApi('/feed.php', {
    include_live: 'true',
  });
}

export async function fetchEpisodes(seriesId) {
  const validId = validateItemId(seriesId);
  if (validId === null) {
    throw new ApiError('Invalid series ID', 400);
  }
  return fetchFromApi('/episodes.php', {
    series_id: validId,
  });
}

export { ApiError };
