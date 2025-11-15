const express = require('express');
const router = express.Router();
const tipController = require('../controllers/tipController');
const { authenticateFirebaseToken } = require('../middleware/firebaseAuth');

/**
 * Tips Routes
 * Base: /api/tips
 */

// Public endpoints (no authentication required)
router.get('/trending', tipController.getTrendingTips);

// Authenticated endpoints - specific routes before parameterized routes
router.get('/my-tips', authenticateFirebaseToken, tipController.getMyTips);

// Public list endpoint
router.get('/', tipController.getAllTips);

// Create new tip
router.post('/', authenticateFirebaseToken, tipController.createTip);

// Parameterized routes (must come after specific routes like /my-tips and /trending)
router.put('/:id', authenticateFirebaseToken, tipController.updateTip);
router.patch('/:id', authenticateFirebaseToken, tipController.updateTip);
router.delete('/:id', authenticateFirebaseToken, tipController.deleteTip);
router.post('/:id/upvote', authenticateFirebaseToken, tipController.upvoteTip);

module.exports = router;
