// Firebase Authentication Routes
const express = require('express');
const router = express.Router();
const { verifyIdToken, getUserByUid } = require('../config/firebase');
const { authenticateFirebaseToken } = require('../middleware/firebaseAuth');
const { userDb } = require('../models/userModel');
const { validate } = require('../middleware/validation');

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
 * @route POST /api/auth/register
 * @desc Register a new user by saving Firebase user data to MongoDB
 * @access Public (but requires valid Firebase token)
 */
router.post('/register', validate('registerUser'), async (req, res) => {
  try {
    const { idToken, displayName, photoURL, bio, location } = req.body;
    
    // Verify Firebase token and get user info
    const decodedToken = await verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    // Get additional user information from Firebase Auth record
    let firebaseUserRecord = null;
    try {
      firebaseUserRecord = await getUserByUid(firebaseUid);
    } catch (error) {
      console.warn('Could not fetch Firebase user record:', error.message);
    }

    // Extract user data with fallbacks for Google auth
    const extractedDisplayName = displayName || 
                                firebaseUserRecord?.displayName || 
                                decodedToken.name || 
                                email?.split('@')[0] || 
                                'User';

    const extractedPhotoURL = photoURL || 
                             firebaseUserRecord?.photoURL || 
                             decodedToken.picture || 
                             null;

    // Validate that we have a display name from somewhere
    if (!extractedDisplayName || extractedDisplayName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Display name is required and must be at least 2 characters',
          code: 'MISSING_DISPLAY_NAME' 
        }
      });
    }

    // Check if user already exists in MongoDB
    const existingUser = await userDb.findByFirebaseUid(firebaseUid);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { 
          message: 'User already registered in database',
          code: 'USER_ALREADY_EXISTS' 
        },
        data: { 
          user: {
            _id: existingUser._id,
            displayName: existingUser.displayName,
            email: existingUser.email,
            photoURL: existingUser.photoURL,
            joinedAt: existingUser.joinedAt
          }
        }
      });
    }

    // Prepare user data for MongoDB with Google auth support
    const newUserData = {
      firebaseUid,
      email,
      displayName: extractedDisplayName.trim(),
      photoURL: extractedPhotoURL,
      bio: bio?.trim() || '',
      location: location?.trim() || '',
      preferences: {
        privacy: 'public',
        notifications: {
          email: true,
          push: true,
          challenges: true,
          tips: true,
          events: true
        }
      },
      role: 'user',
      joinedAt: new Date(),
      lastActive: new Date(),
      stats: {
        challengesJoined: 0,
        challengesCompleted: 0,
        totalImpactPoints: 0,
        eventsAttended: 0,
        tipsShared: 0,
        streak: 0
      }
    };

    // Create user in MongoDB
    const createdUser = await userDb.create(newUserData);
    console.log(`✅ User registered successfully: ${firebaseUid} - ${displayName}`);

    // Remove sensitive information from response
    const { firebaseUid: uid, ...userProfile } = createdUser;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userProfile,
        firebase: {
          uid: firebaseUid,
          email,
          emailVerified: decodedToken.email_verified
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message.includes('auth/id-token')) {
      return res.status(401).json({
        success: false,
        error: { 
          message: 'Invalid Firebase token',
          code: 'INVALID_TOKEN'
        }
      });
    }

    if (error.message.includes('E11000')) {
      return res.status(409).json({
        success: false,
        error: { 
          message: 'User with this email already exists',
          code: 'DUPLICATE_EMAIL'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: { 
        message: 'Failed to register user',
        code: 'REGISTRATION_FAILED',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
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
 * @route GET /api/auth/profile
 * @desc Get authenticated user profile information only
 * @access Private (requires Firebase authentication)
 */
router.get('/profile', authenticateFirebaseToken, async (req, res, next) => {
  try {
    const { userDb } = require('../models/userModel');
    const firebaseUid = req.user.uid;
    
    // Only get existing user profile, don't create if doesn't exist
    const user = await userDb.findByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User profile not found. Please complete your profile setup.',
          code: 'PROFILE_NOT_FOUND'
        }
      });
    }

    // Update last active timestamp
    await userDb.update(firebaseUid, { lastActive: new Date() });

    // Remove sensitive information and return clean profile
    const { firebaseUid: uid, ...userProfile } = user;

    res.status(200).json({
      success: true,
      data: { 
        user: userProfile,
        firebaseInfo: {
          uid: req.user.uid,
          email: req.user.email,
          emailVerified: req.user.email_verified
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;