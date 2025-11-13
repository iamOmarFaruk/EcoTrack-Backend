// Firebase Authentication Middleware
const { verifyIdToken, getUserByUid } = require('../config/firebase');

/**
 * Middleware to authenticate Firebase ID tokens
 * Adds user info to req.user if token is valid
 */
const authenticateFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authorization header with Bearer token is required' }
      });
    }
    
    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Get full user record to access profile information
    const userRecord = await getUserByUid(decodedToken.uid);
    
    // Add user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      displayName: userRecord.displayName || decodedToken.name || 'Anonymous User',
      photoURL: userRecord.photoURL || decodedToken.picture || null,
      customClaims: decodedToken.customClaims || {}
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired Firebase token' }
    });
  }
};

/**
 * Optional Firebase authentication - doesn't fail if no token provided
 * Useful for endpoints that can work with or without authentication
 */
const optionalFirebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }
    
    const idToken = authHeader.substring(7);
    const decodedToken = await verifyIdToken(idToken);
    
    // Get full user record to access profile information
    const userRecord = await getUserByUid(decodedToken.uid);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      displayName: userRecord.displayName || decodedToken.name || 'Anonymous User',
      photoURL: userRecord.photoURL || decodedToken.picture || null,
      customClaims: decodedToken.customClaims || {}
    };
    
    next();
  } catch (error) {
    // Token provided but invalid, continue without authentication
    req.user = null;
    next();
  }
};

/**
 * Middleware to require admin role
 * Must be used after authenticateFirebaseToken
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required' }
    });
  }
  
  if (!req.user.customClaims || !req.user.customClaims.admin) {
    return res.status(403).json({
      success: false,
      error: { message: 'Admin access required' }
    });
  }
  
  next();
};

/**
 * Middleware to require specific custom claims
 * Must be used after authenticateFirebaseToken
 */
const requireClaims = (requiredClaims) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
    }
    
    const userClaims = req.user.customClaims || {};
    
    // Check if user has all required claims
    for (const [claim, value] of Object.entries(requiredClaims)) {
      if (userClaims[claim] !== value) {
        return res.status(403).json({
          success: false,
          error: { 
            message: `Required claim '${claim}' with value '${value}' not found`,
            required: requiredClaims,
            userClaims: userClaims
          }
        });
      }
    }
    
    next();
  };
};

/**
 * Middleware to check if user's email is verified
 * Must be used after authenticateFirebaseToken
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required' }
    });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: { message: 'Email verification required' }
    });
  }
  
  next();
};

module.exports = {
  authenticateFirebaseToken,
  optionalFirebaseAuth,
  requireAdmin,
  requireClaims,
  requireEmailVerified
};