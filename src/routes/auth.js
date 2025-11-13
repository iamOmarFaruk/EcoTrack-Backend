// Firebase Authentication Routes
const express = require('express');
const router = express.Router();
const { verifyIdToken, getUserByUid, setCustomUserClaims, listUsers } = require('../config/firebase');
const { authenticateFirebaseToken, requireAdmin } = require('../middleware/firebaseAuth');

/**
 * @route POST /api/auth/verify-token
 * @desc Verify Firebase ID token and return user info
 * @access Public (but requires valid Firebase token)
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'ID token is required' }
      });
    }

    const decodedToken = await verifyIdToken(idToken);
    
    res.json({
      success: true,
      data: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        customClaims: decodedToken.customClaims || {}
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @route GET /api/auth/user
 * @desc Get current authenticated user information
 * @access Private (requires Firebase authentication)
 */
router.get('/user', authenticateFirebaseToken, async (req, res) => {
  try {
    const userRecord = await getUserByUid(req.user.uid);
    
    res.json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        createdAt: userRecord.metadata.creationTime,
        lastSignIn: userRecord.metadata.lastSignInTime,
        customClaims: userRecord.customClaims || {}
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @route POST /api/auth/set-claims
 * @desc Set custom claims for a user (admin only)
 * @access Private (requires admin role)
 */
router.post('/set-claims', authenticateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { uid, customClaims } = req.body;
    
    if (!uid || !customClaims) {
      return res.status(400).json({
        success: false,
        error: { message: 'User ID and custom claims are required' }
      });
    }

    await setCustomUserClaims(uid, customClaims);
    
    res.json({
      success: true,
      message: `Custom claims set for user ${uid}`,
      data: { uid, customClaims }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @route GET /api/auth/users
 * @desc List all users (admin only)
 * @access Private (requires admin role)
 */
router.get('/users', authenticateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const maxResults = parseInt(req.query.limit) || 1000;
    const users = await listUsers(maxResults);
    
    const formattedUsers = users.map(user => ({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      photoURL: user.photoURL,
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
      customClaims: user.customClaims || {}
    }));
    
    res.json({
      success: true,
      data: formattedUsers,
      count: formattedUsers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @route GET /api/auth/protected
 * @desc Test protected route
 * @access Private (requires Firebase authentication)
 */
router.get('/protected', authenticateFirebaseToken, (req, res) => {
  res.json({
    success: true,
    message: 'You have accessed a protected route!',
    user: {
      uid: req.user.uid,
      email: req.user.email
    }
  });
});

/**
 * @route GET /api/auth/admin
 * @desc Test admin-only route
 * @access Private (requires admin role)
 */
router.get('/admin', authenticateFirebaseToken, requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'You have admin access!',
    user: {
      uid: req.user.uid,
      email: req.user.email,
      customClaims: req.user.customClaims
    }
  });
});

module.exports = router;