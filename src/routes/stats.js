const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

/**
 * Statistics Routes
 * Base path: /api/stats
 */

// GET /api/stats/community - Global community statistics
router.get('/community', statsController.getCommunityStats);

// GET /api/stats/user - Current user statistics (auth required later)
router.get('/user', statsController.getCurrentUserStats);

// GET /api/stats/impact - Environmental impact metrics
router.get('/impact', statsController.getImpactStats);

// GET /api/stats/leaderboard - Leaderboard data
router.get('/leaderboard', statsController.getLeaderboard);

// GET /api/stats/challenges/:id - Challenge-specific statistics
router.get('/challenges/:id', statsController.getChallengeStats);

module.exports = router;