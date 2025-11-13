const express = require('express');
const router = express.Router();
const tipController = require('../controllers/tipController');

/**
 * Tips Routes
 * Base path: /api/tips
 */

// GET /api/tips/popular - Get popular tips (place specific routes before parameterized ones)
router.get('/popular', tipController.getPopularTips);

// GET /api/tips/category/:category - Get tips by category
router.get('/category/:category', tipController.getTipsByCategory);

// GET /api/tips - Get all tips with filtering and sorting
router.get('/', tipController.getAllTips);

// GET /api/tips/:id - Get specific tip
router.get('/:id', tipController.getTipById);

// POST /api/tips - Create new tip (auth required later)
router.post('/', tipController.createTip);

// PATCH /api/tips/:id - Update tip (auth required later - owner only)
router.patch('/:id', tipController.updateTip);

// DELETE /api/tips/:id - Delete tip (auth required later - owner/admin only)
router.delete('/:id', tipController.deleteTip);

// POST /api/tips/:id/vote - Vote on tip (auth required later)
router.post('/:id/vote', tipController.voteTip);

// DELETE /api/tips/:id/vote - Remove vote from tip (auth required later)
router.delete('/:id/vote', tipController.removeVote);

module.exports = router;