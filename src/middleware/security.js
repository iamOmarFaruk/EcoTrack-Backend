/**
 * Security Middleware
 * Essential security measures for the EcoTrack API
 */

/**
 * Sanitize input data to prevent injection attacks
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential script tags
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '');
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
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Basic security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

module.exports = {
  sanitizeInput,
  requestSizeLimit,
  securityHeaders
};