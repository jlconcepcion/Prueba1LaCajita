import DOMPurify from 'dompurify';
import { validateEmbedUrl } from './validation.js';

const ALLOWED_TAGS = ['iframe', 'script', 'div', 'p', 'br', 'span'];
const ALLOWED_ATTRIBUTES = {
  iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'title'],
  script: ['src', 'type'],
  '*': ['style'],
};

const IFRAME_SANDBOX_ATTRIBUTES = 'allow-scripts allow-same-origin allow-popups allow-presentation';

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allow', 'title', 'type', 'style'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

export function sanitizeEmbed(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let cleaned = html
    .replace(/allowfullscreen(="")?/gi, '')
    .replace(/webkitallowfullscreen(="")?/gi, '')
    .replace(/mozallowfullscreen(="")?/gi, '')
    .replace(/allow="([^"]*)"/gi, (match, p1) => {
      const newAllow = p1.replace(/fullscreen/gi, '').replace(/;{2,}/g, ';').trim();
      return newAllow ? `allow="${newAllow}"` : '';
    });

  cleaned = DOMPurify.sanitize(cleaned, CONFIG);

  const iframeRegex = /<iframe[^>]*src="([^"]*)"[^>]*>/gi;
  cleaned = cleaned.replace(iframeRegex, (match, src) => {
    if (!validateEmbedUrl(src)) {
      return '';
    }
    return match;
  });

  return cleaned;
}

export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

export function isValidEmbedHtml(html) {
  if (!html || typeof html !== 'string') return false;

  const hasIframe = html.includes('<iframe');
  const hasScript = html.includes('<script');

  if (!hasIframe && !hasScript) return false;

  const iframeRegex = /src=["']([^"']*)["']/g;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    if (!validateEmbedUrl(match[1])) {
      return false;
    }
  }

  return true;
}
