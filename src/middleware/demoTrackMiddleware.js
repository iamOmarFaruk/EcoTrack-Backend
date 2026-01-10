const demoConfig = require('../config/demoConfig')
const resetTimerService = require('../services/resetTimerService')

/**
 * Demo Tracking Middleware
 *
 * Intercepts successful mutating operations performed by the demo admin
 * and triggers the auto-reset timer.
 *
 * This middleware should be applied AFTER authentication but runs
 * AFTER the route handler completes (using response finish event).
 */
function demoTrackMiddleware(req, res, next) {
    // Only track mutating operations
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
    if (!mutatingMethods.includes(req.method)) {
        return next()
    }

    // Store original end method
    const originalEnd = res.end

    // Override end to track successful mutations
    res.end = function (chunk, encoding) {
        // Call original end
        originalEnd.call(this, chunk, encoding)

        // Only track if operation was successful (2xx status)
        if (res.statusCode >= 200 && res.statusCode < 300) {
            // Check if current admin is the demo admin
            if (req.admin && demoConfig.isDemoAdmin(req.admin.email)) {
                // Extract action details from request
                const action = `${req.method} ${req.baseUrl}${req.path}`

                // Determine entity type and ID from route
                const entityType = extractEntityType(req)
                const entityId = req.params?.id || null

                // Start/reset the timer asynchronously
                resetTimerService.startTimer(action, entityType, entityId)
                    .catch(err => {
                        console.error('[Demo Reset] Failed to start timer:', err.message)
                    })
            }
        }
    }

    next()
}

/**
 * Extract entity type from request path
 * @param {Object} req - Express request object
 * @returns {string|null} Entity type or null
 */
function extractEntityType(req) {
    const path = req.baseUrl + req.path

    if (path.includes('/challenges')) return 'challenge'
    if (path.includes('/events')) return 'event'
    if (path.includes('/tips')) return 'tip'
    if (path.includes('/content')) return 'siteContent'
    if (path.includes('/users')) return 'user'
    if (path.includes('/activity')) return 'activity'

    return null
}

module.exports = demoTrackMiddleware
