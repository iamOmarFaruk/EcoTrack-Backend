const resetTimerService = require('../services/resetTimerService')
const snapshotService = require('../services/snapshotService')
const demoConfig = require('../config/demoConfig')

/**
 * Reset Controller
 *
 * Handles API endpoints for the demo reset control panel.
 */

/**
 * GET /admin/reset/status
 * Get current timer status and snapshot info
 */
async function getStatus(req, res) {
    try {
        const status = await resetTimerService.getStatus()

        res.json({
            success: true,
            data: status
        })
    } catch (error) {
        console.error('[Reset Controller] getStatus error:', error.message)
        res.status(500).json({
            success: false,
            error: { message: 'Failed to get reset status' }
        })
    }
}

/**
 * POST /admin/reset/execute
 * Manually trigger a database reset (demo admin only)
 */
async function executeReset(req, res) {
    try {
        // Only demo admin can execute reset
        if (!demoConfig.isDemoAdmin(req.admin?.email)) {
            return res.status(403).json({
                success: false,
                error: { message: 'Only the demo admin can execute reset' }
            })
        }

        const result = await resetTimerService.executeReset('manual (control panel)')

        res.json({
            success: true,
            message: 'Demo data has been reset successfully',
            data: result
        })
    } catch (error) {
        console.error('[Reset Controller] executeReset error:', error.message)
        res.status(500).json({
            success: false,
            error: { message: 'Failed to execute reset: ' + error.message }
        })
    }
}

/**
 * POST /admin/reset/snapshot
 * Create a new baseline snapshot (demo admin only)
 */
async function createSnapshot(req, res) {
    try {
        // Only demo admin can create snapshots
        if (!demoConfig.isDemoAdmin(req.admin?.email)) {
            return res.status(403).json({
                success: false,
                error: { message: 'Only the demo admin can create snapshots' }
            })
        }

        const snapshot = await snapshotService.createSnapshot('initial', req.admin.email)

        // Clean up old snapshots (keep only 5)
        await snapshotService.cleanupOldSnapshots(5)

        res.json({
            success: true,
            message: 'New baseline snapshot created successfully',
            data: {
                snapshotId: snapshot.snapshotId,
                createdAt: snapshot.createdAt,
                documentCounts: snapshot.documentCounts
            }
        })
    } catch (error) {
        console.error('[Reset Controller] createSnapshot error:', error.message)
        res.status(500).json({
            success: false,
            error: { message: 'Failed to create snapshot: ' + error.message }
        })
    }
}

/**
 * DELETE /admin/reset/timer
 * Cancel the pending reset timer (demo admin only)
 */
async function cancelTimer(req, res) {
    try {
        // Only demo admin can cancel timer
        if (!demoConfig.isDemoAdmin(req.admin?.email)) {
            return res.status(403).json({
                success: false,
                error: { message: 'Only the demo admin can cancel the timer' }
            })
        }

        const result = await resetTimerService.cancelTimer()

        res.json({
            success: true,
            message: 'Reset timer has been cancelled',
            data: result
        })
    } catch (error) {
        console.error('[Reset Controller] cancelTimer error:', error.message)
        res.status(500).json({
            success: false,
            error: { message: 'Failed to cancel timer: ' + error.message }
        })
    }
}

module.exports = {
    getStatus,
    executeReset,
    createSnapshot,
    cancelTimer
}
