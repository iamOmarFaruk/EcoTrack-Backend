const express = require('express')
const router = express.Router()
const resetController = require('../controllers/resetController')

/**
 * Demo Reset Routes
 *
 * These routes are mounted at /api/admin/reset
 * All routes require admin authentication.
 */

// GET /api/admin/reset/status - Get timer status and snapshot info
router.get('/status', resetController.getStatus)

// POST /api/admin/reset/execute - Manually trigger reset (demo admin only)
router.post('/execute', resetController.executeReset)

// POST /api/admin/reset/snapshot - Create new baseline snapshot (demo admin only)
router.post('/snapshot', resetController.createSnapshot)

// DELETE /api/admin/reset/timer - Cancel pending timer (demo admin only)
router.delete('/timer', resetController.cancelTimer)

module.exports = router
