import DOMPurify from 'dompurify';
import { validateEmbedUrl } from './validation.js';

const ALLOWED_TAGS = ['iframe', 'div', 'p', 'br', 'span'];
const ALLOWED_ATTRIBUTES = {
  iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'title'],
  '*': ['style'],
};

// Deliberately excludes "allow-same-origin": combined with "allow-scripts"
// it lets an embedded document strip its own sandbox restrictions from the
// inside, defeating the sandbox entirely. This value is always injected by
// this module — it is never taken from (or overridable by) the source HTML.
const IFRAME_SANDBOX_ATTRIBUTES = 'allow-scripts allow-popups allow-presentation';

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allow', 'title', 'style'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: false,
};

export function sanitizeEmbed(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let cleaned = html
    .replace(/allowfullscreen(="")?/gi, '')
    .replace(/webkitallowfullscreen(="")?/gi, '')
    .replace(/mozallowfullscreen(="")?/gi, '')
    // Strip any sandbox attribute from the source — it must never be
    // attacker/backend-controlled. A fixed, safe value is injected below.
    .replace(/\ssandbox(="[^"]*")?/gi, '')
    .replace(/allow="([^"]*)"/gi, (match, p1) => {
      const newAllow = p1.replace(/fullscreen/gi, '').replace(/;{2,}/g, ';').trim();
      return newAllow ? `allow="${newAllow}"` : '';
    });

  cleaned = DOMPurify.sanitize(cleaned, CONFIG);

  const iframeRegex = /<iframe([^>]*)src="([^"]*)"([^>]*)>/gi;
  cleaned = cleaned.replace(iframeRegex, (match, before, src, after) => {
    if (!validateEmbedUrl(src)) {
      return '';
    }
    return `<iframe${before}src="${src}"${after} sandbox="${IFRAME_SANDBOX_ATTRIBUTES}">`;
  });

  return cleaned;
}

export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

export function isValidEmbedHtml(html) {
  if (!html || typeof html !== 'string') return false;

  // Reject any embed containing inline scripts — no exceptions
  if (html.includes('<script')) return false;

  const hasIframe = html.includes('<iframe');
  if (!hasIframe) return false;

  const iframeRegex = /src=["']([^"']*)["']/g;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    if (!validateEmbedUrl(match[1])) {
      return false;
    }
  }

  return true;
}
