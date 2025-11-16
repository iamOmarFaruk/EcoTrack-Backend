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

/**
 * @route GET /api/auth/me
 * @desc Get complete authenticated user data for React frontend
 * @desc Returns ALL user information including profile, stats, preferences, and Firebase data
 * @access Private (requires Firebase authentication)
 */
router.get('/me', authenticateFirebaseToken, async (req, res, next) => {
  try {
    const { userDb } = require('../models/userModel');
    const firebaseUid = req.user.uid;
    
    // Get user from MongoDB
    let user = await userDb.findByFirebaseUid(firebaseUid);

    // If user doesn't exist in database, create basic profile
    if (!user) {
      // Get displayName and photoURL from Firebase Auth
      let firebaseDisplayName = null;
      let firebasePhotoURL = null;
      
      try {
        const firebaseUser = await getUserByUid(firebaseUid);
        firebaseDisplayName = firebaseUser.displayName;
        firebasePhotoURL = firebaseUser.photoURL;
      } catch (error) {
        console.warn('Could not fetch Firebase user details for auto-profile creation:', error.message);
      }

      const newUserData = {
        firebaseUid,
        email: req.user.email,
        displayName: firebaseDisplayName || req.user.email.split('@')[0],
        photoURL: firebasePhotoURL || null,
        bio: '',
        location: '',
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

      user = await userDb.create(newUserData);
      console.log(`✅ New user profile created via /me endpoint: ${firebaseUid}`);
    } else {
      // Update last active timestamp
      await userDb.update(firebaseUid, { lastActive: new Date() });
    }

    // Prepare complete user data response
    const completeUserData = {
      // Database User Profile
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      bio: user.bio || '',
      location: user.location || '',
      
      // User Stats
      stats: {
        challengesJoined: user.stats?.challengesJoined || 0,
        challengesCompleted: user.stats?.challengesCompleted || 0,
        totalImpactPoints: user.stats?.totalImpactPoints || 0,
        eventsAttended: user.stats?.eventsAttended || 0,
        tipsShared: user.stats?.tipsShared || 0,
        streak: user.stats?.streak || 0,
        completionRate: user.stats?.challengesJoined > 0 
          ? Math.round((user.stats.challengesCompleted / user.stats.challengesJoined) * 100)
          : 0
      },
      
      // User Preferences
      preferences: {
        privacy: user.preferences?.privacy || 'public',
        notifications: {
          email: user.preferences?.notifications?.email ?? true,
          push: user.preferences?.notifications?.push ?? true,
          challenges: user.preferences?.notifications?.challenges ?? true,
          tips: user.preferences?.notifications?.tips ?? true,
          events: user.preferences?.notifications?.events ?? true
        }
      },
      
      // User Role & Status
      role: user.role || 'user',
      isActive: user.isActive !== undefined ? user.isActive : true,
      
      // Timestamps
      joinedAt: user.joinedAt,
      lastActive: user.lastActive,
      
      // Firebase Authentication Data
      firebase: {
        uid: req.user.uid,
        email: req.user.email,
        emailVerified: req.user.emailVerified,
        displayName: req.user.displayName,
        photoURL: req.user.photoURL,
        customClaims: req.user.customClaims || {}
      },
      
      // Additional Computed Data
      membershipDuration: calculateMembershipDuration(user.joinedAt),
      rank: calculateUserRank(user.stats?.totalImpactPoints || 0),
      badges: calculateBadges(user.stats || {}),
      nextRank: getNextRank(user.stats?.totalImpactPoints || 0)
    };

    res.status(200).json({
      success: true,
      message: 'User data retrieved successfully',
      data: completeUserData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    next(error);
  }
});

// Helper functions for /me endpoint
function calculateMembershipDuration(joinedAt) {
  if (!joinedAt) return 'New member';
  
  const now = new Date();
  const joined = new Date(joinedAt);
  const diffTime = Math.abs(now - joined);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  return `${Math.floor(diffDays / 365)} years`;
}

function calculateUserRank(impactPoints) {
  if (impactPoints >= 1000) return 'Legend';
  if (impactPoints >= 500) return 'Champion';
  if (impactPoints >= 300) return 'Expert';
  if (impactPoints >= 150) return 'Enthusiast';
  if (impactPoints >= 50) return 'Beginner';
  return 'Newcomer';
}

function getNextRank(impactPoints) {
  if (impactPoints >= 1000) return { rank: 'Legend', pointsNeeded: 0, isMaxRank: true };
  if (impactPoints >= 500) return { rank: 'Legend', pointsNeeded: 1000 - impactPoints };
  if (impactPoints >= 300) return { rank: 'Champion', pointsNeeded: 500 - impactPoints };
  if (impactPoints >= 150) return { rank: 'Expert', pointsNeeded: 300 - impactPoints };
  if (impactPoints >= 50) return { rank: 'Enthusiast', pointsNeeded: 150 - impactPoints };
  return { rank: 'Beginner', pointsNeeded: 50 - impactPoints };
}

function calculateBadges(stats) {
  const badges = [];
  
  // Challenge-related badges
  if (stats.challengesCompleted >= 50) badges.push({ name: 'Challenge Legend', icon: '🏆', category: 'challenges' });
  if (stats.challengesCompleted >= 25) badges.push({ name: 'Challenge Expert', icon: '🥇', category: 'challenges' });
  if (stats.challengesCompleted >= 10) badges.push({ name: 'Challenge Master', icon: '🎖️', category: 'challenges' });
  if (stats.challengesCompleted >= 5) badges.push({ name: 'Committed', icon: '💪', category: 'challenges' });
  if (stats.challengesCompleted >= 1) badges.push({ name: 'First Steps', icon: '🌱', category: 'challenges' });
  
  // Event-related badges
  if (stats.eventsAttended >= 10) badges.push({ name: 'Event Enthusiast', icon: '🎪', category: 'events' });
  if (stats.eventsAttended >= 5) badges.push({ name: 'Community Leader', icon: '👥', category: 'events' });
  if (stats.eventsAttended >= 1) badges.push({ name: 'Team Player', icon: '🤝', category: 'events' });
  
  // Knowledge-sharing badges
  if (stats.tipsShared >= 20) badges.push({ name: 'Knowledge Expert', icon: '🧠', category: 'tips' });
  if (stats.tipsShared >= 10) badges.push({ name: 'Knowledge Sharer', icon: '📚', category: 'tips' });
  if (stats.tipsShared >= 5) badges.push({ name: 'Helper', icon: '💡', category: 'tips' });
  
  // Streak badges
  if (stats.streak >= 30) badges.push({ name: 'Consistency King', icon: '👑', category: 'streak' });
  if (stats.streak >= 14) badges.push({ name: 'Two Week Warrior', icon: '⚡', category: 'streak' });
  if (stats.streak >= 7) badges.push({ name: 'Week Champion', icon: '🔥', category: 'streak' });
  
  // Impact badges
  if (stats.totalImpactPoints >= 500) badges.push({ name: 'Impact Hero', icon: '🌍', category: 'impact' });
  if (stats.totalImpactPoints >= 250) badges.push({ name: 'Impact Maker', icon: '🌟', category: 'impact' });
  if (stats.totalImpactPoints >= 100) badges.push({ name: 'Impact Starter', icon: '✨', category: 'impact' });
  
  return badges;
}

module.exports = router;