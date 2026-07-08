# Development Guide - LaCajitaTV

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Android SDK (for Android development)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

## Development

### Running Development Server

```bash
npm run dev
```

Access the app at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Security Best Practices

### Development

1. **Never commit `.env` files** - Use `.env.example` for reference
2. **Validate all user input** - Use validation utilities from `src/utils/validation.js`
3. **Sanitize HTML content** - Use `sanitizeEmbed()` from `src/utils/sanitize.js`
4. **Use centralized API client** - Import from `src/utils/api.js`
5. **Log errors properly** - Use `logger` from `src/utils/logger.js`

### Code Review Checklist

- [ ] No hardcoded API keys or credentials
- [ ] All user inputs validated
- [ ] HTML content sanitized before rendering
- [ ] API calls use centralized client
- [ ] Error handling with proper logging
- [ ] Tests added for security-sensitive code
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] CORS headers properly configured

## File Structure

```
src/
├── components/           # React components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
│   ├── api.js           # Centralized API client
│   ├── validation.js    # Input validation
│   ├── sanitize.js      # HTML/text sanitization
│   ├── logger.js        # Error logging
│   ├── storage.js       # Secure localStorage wrapper
│   └── *.test.js        # Tests for utilities
├── App.jsx              # Root component
└── App.css              # Global styles
```

## API Integration

### Using the API Client

```javascript
import { fetchFromApi, fetchFeed, fetchEpisodes } from '../utils/api.js';

// Fetch main feed
const data = await fetchFeed();

// Fetch episodes for a series
const episodes = await fetchEpisodes(seriesId);

// Custom API endpoint
const response = await fetchFromApi('/custom.php', {
  param1: 'value1',
  param2: 'value2',
});
```

### Features
- Automatic request validation
- Rate limiting (500ms per endpoint)
- Timeout handling (10s default)
- API version headers
- Centralized error handling

## Handling Embeds

### Safe Embed Rendering

```javascript
import { sanitizeEmbed, isValidEmbedHtml } from '../utils/sanitize.js';

if (isValidEmbedHtml(embedHtml)) {
  const cleanEmbed = sanitizeEmbed(embedHtml);
  return (
    <div dangerouslySetInnerHTML={{ __html: cleanEmbed }} />
  );
}
```

## Storage

### Using Secure Storage

```javascript
import { getFromStorage, setInStorage } from '../utils/storage.js';

// Save data
setInStorage('my_key', { data: 'value' });

// Retrieve data
const data = getFromStorage('my_key', { default: 'value' });

// Remove data
removeFromStorage('my_key');
```

All data is automatically prefixed with `lacajita_` for safety.

## Error Handling

### Logging Errors

```javascript
import { logger, captureError } from '../utils/logger.js';

try {
  // Do something
} catch (error) {
  captureError(error, 'in my function');
  logger.warn('Something went wrong', error);
}
```

### API Errors

```javascript
import { fetchFeed, ApiError } from '../utils/api.js';

try {
  const data = await fetchFeed();
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.status}: ${error.message}`);
  }
}
```

## Android Development

### Building APK

```bash
cd android
./gradlew assembleDebug
# APK will be in app/build/outputs/apk/debug/
```

### WebView Security

The app configures WebView security in `MainActivity.java`:
- Disables cleartext traffic
- Enforces HTTPS
- Validates SSL certificates
- Disables file access
- Configures content security policy

## Environment Variables

### Public Variables (visible in bundle)
- `VITE_APP_ID` - Application ID

### Configuration Variables
- `VITE_API_BASE` - API base URL
- `VITE_API_VERSION` - API version
- `VITE_API_TIMEOUT` - Request timeout in ms

**Note**: For production, use a backend proxy to hide API endpoints.

## Testing

### Test Organization

- `src/utils/*.test.js` - Unit tests for utilities
- Focus on security-sensitive code
- 70%+ coverage of utilities

### Writing Tests

```javascript
import { describe, it, expect } from 'vitest';

describe('my utility', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

## Performance Monitoring

### Key Metrics

1. **Bundle Size**
   - React vendor: ~40KB
   - HLS.js: ~100KB
   - Main bundle: <150KB

2. **API Performance**
   - Feed load: <2s
   - Episodes load: <1s
   - Rate limiting: 500ms minimum

3. **Memory**
   - Episode cache: ~10MB max
   - Storage quota: 5MB max

## Troubleshooting

### Common Issues

**"API endpoint not found"**
- Check `VITE_API_BASE` in .env
- Verify API server is running
- Check network security policy (Android)

**"XSS prevention blocks content"**
- Verify embed URLs are valid
- Check CSP headers in index.html
- Review sanitized content

**"Storage quota exceeded"**
- Clear old data with `clearStorage(pattern)`
- Monitor with `validateStorageQuota()`

## Related Documentation

- [Security Guide](./SECURITY.md) - Detailed security improvements
- [Component Structure](./src/components/README.md) - Component documentation

## Support

For issues or questions:
1. Check this documentation
2. Review relevant test files
3. Check utility function JSDoc comments
4. Create an issue with details

---

**Last Updated**: 2026-07-08
