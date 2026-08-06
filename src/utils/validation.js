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
    // url.host includes the port (e.g. "localhost:5173"); url.hostname does not
    const host     = url.host;      // "localhost:5173"
    const hostname = url.hostname;  // "localhost"
    return ALLOWED_ORIGINS.some(origin =>
      hostname === origin || host === origin || hostname.endsWith('.' + origin)
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

// Blocks embeds pointing at the device's own local network (loopback,
// RFC1918 private ranges, link-local/cloud-metadata addresses). Embed
// content is JS-capable (see sanitize.js), so a compromised/MITM'd backend
// shouldn't be able to point it at internal-only endpoints.
function isPrivateOrLocalHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1') return true;

  // IPv4
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 127) return true;                          // loopback
    if (a === 10) return true;                            // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16
    if (a === 169 && b === 254) return true;               // link-local / cloud metadata
    if (a === 0) return true;                              // 0.0.0.0/8
    return false;
  }

  // IPv6 unique-local / link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;

  return false;
}

export function validateEmbedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!isValidUrl(url)) return false;
  const lowercased = url.toLowerCase();
  if (lowercased.includes('javascript:') || lowercased.includes('data:text/html')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (isPrivateOrLocalHost(parsed.hostname)) return false;
  } catch {
    return false;
  }
  return true;
}

export function validateApiUrl(baseUrl, endpoint, params = {}) {
  if (!isValidApiOrigin(baseUrl)) {
    throw new Error('Invalid API origin');
  }

  // Preserve the base path (e.g. /API/V1/embed) and append the endpoint
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = new URL(`${cleanBase}/${cleanEndpoint}`);

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
