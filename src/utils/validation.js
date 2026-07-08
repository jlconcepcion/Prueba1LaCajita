const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const ALLOWED_ORIGINS = [
  'tvappbuilder.com',
  'localhost:5173',
  'localhost:8000',
];

export function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isValidApiOrigin(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    return ALLOWED_ORIGINS.some(origin =>
      hostname === origin || hostname.endsWith('.' + origin)
    );
  } catch {
    return false;
  }
}

export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .trim();
}

export function validateEmbedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!isValidUrl(url)) return false;
  const lowercased = url.toLowerCase();
  return !lowercased.includes('javascript:') &&
         !lowercased.includes('data:text/html');
}

export function validateApiUrl(baseUrl, endpoint, params = {}) {
  if (!isValidApiOrigin(baseUrl)) {
    throw new Error('Invalid API origin');
  }

  const url = new URL(baseUrl);
  url.pathname = endpoint;

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
}

export function validateItemId(id) {
  if (typeof id === 'number') return id;
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10);
  return null;
}

export function sanitizeHtmlContent(html) {
  if (typeof html !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
