const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * User Routes
 * Base path: /api/users
 */

// GET /api/users/profile - Get current user profile (auth required later)
router.get('/profile', userController.getCurrentUserProfile);

// PATCH /api/users/profile - Update current user profile (auth required later)
router.patch('/profile', userController.updateUserProfile);

// GET /api/users/:id - Get public user profile
router.get('/:id', userController.getPublicUserProfile);

// GET /api/users/:id/activities - Get user's public activities
router.get('/:id/activities', userController.getUserActivities);

// GET /api/users/:id/challenges - Get user's challenges
router.get('/:id/challenges', userController.getUserChallenges);

// GET /api/users/:id/stats - Get user statistics
router.get('/:id/stats', userController.getUserStats);

module.exports = router;