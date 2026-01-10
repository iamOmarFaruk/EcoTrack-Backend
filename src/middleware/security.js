/**
 * Security Middleware
 * Essential security measures for the EcoTrack API
 */

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize input data to prevent XSS and injection attacks
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') {
        // Use DOMPurify for HTML sanitization
        return DOMPurify.sanitize(obj, {
          ALLOWED_TAGS: [], // Strip all HTML tags
          ALLOWED_ATTR: []
        });
      }
      return obj;
    }

    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = DOMPurify.sanitize(obj[key], {
          ALLOWED_TAGS: [], // No HTML allowed in API inputs
          ALLOWED_ATTR: []
        });
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

/**
 * Validate request size to prevent DoS attacks
 */
const requestSizeLimit = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        message: 'Request too large',
        code: 'REQUEST_TOO_LARGE'
      }
    });
  }
  
  next();
};

/**
 * Enhanced security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');

  // Security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

module.exports = {
  sanitizeInput,
  requestSizeLimit,
  securityHeaders
};