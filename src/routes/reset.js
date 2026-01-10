const express = require('express')
const router = express.Router()
const resetController = require('../controllers/resetController')
const { adminAuth } = require('../middleware/adminAuth')

/**
 * Demo Reset Routes
 *
 * These routes are mounted at /api/admin/reset
 * All routes require admin authentication.
 */

// GET /api/admin/reset/status - Get timer status and snapshot info
router.get('/status', adminAuth, resetController.getStatus)

// POST /api/admin/reset/execute - Manually trigger reset (demo admin only)
router.post('/execute', adminAuth, resetController.executeReset)

// POST /api/admin/reset/snapshot - Create new baseline snapshot (demo admin only)
router.post('/snapshot', adminAuth, resetController.createSnapshot)

// DELETE /api/admin/reset/timer - Cancel pending timer (demo admin only)
router.delete('/timer', adminAuth, resetController.cancelTimer)

module.exports = router
