const express = require('express');
const router = express.Router();
const tipController = require('../controllers/tipController');
const { authenticateFirebaseToken, optionalFirebaseAuth } = require('../middleware/firebaseAuth');
const { validate, validateQuery, querySchemas } = require('../middleware/validation');

/**
 * Tips Routes
 * Base path: /api/tips
 */

// GET /api/tips - Get all tips with filtering and sorting (public with optional auth)
router.get('/', 
  optionalFirebaseAuth, // Optional auth to show user upvote status
  validateQuery(querySchemas.tipFilters), 
  tipController.getAllTips
);

// GET /api/tips/:id - Get specific tip (public with optional auth)
router.get('/:id', 
  optionalFirebaseAuth, // Optional auth to show ownership and upvote status
  tipController.getTipById
);

// POST /api/tips - Create new tip (requires authentication)
router.post('/', 
  authenticateFirebaseToken, 
  validate('createTip'), 
  tipController.createTip
);

// PATCH /api/tips/:id - Update tip (requires authentication and ownership)
router.patch('/:id', 
  authenticateFirebaseToken, 
  validate('updateTip'), 
  tipController.updateTip
);

// DELETE /api/tips/:id - Delete tip (requires authentication and ownership)
router.delete('/:id', 
  authenticateFirebaseToken, 
  tipController.deleteTip
);

// POST /api/tips/:id/upvote - Upvote tip (requires authentication, unlimited votes allowed)
router.post('/:id/upvote', 
  authenticateFirebaseToken, 
  tipController.upvoteTip
);

module.exports = router;