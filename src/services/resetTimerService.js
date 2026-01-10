const { DemoResetTimer } = require('../models/demoResetTimerModel')
const snapshotService = require('./snapshotService')
const demoConfig = require('../config/demoConfig')

/**
 * Reset Timer Service
 *
 * Manages the 30-minute auto-reset timer for demo admin operations.
 * Persists timer state to survive server restarts.
 */
class ResetTimerService {
  constructor() {
    this.activeTimeout = null
    this.initialized = false
  }

  /**
   * Initialize the service on server startup
   * Checks for pending timers and resumes/executes as needed
   */
  async initialize() {
    if (this.initialized) {
      console.log('[Demo Reset] Timer service already initialized')
      return
    }

    try {
      // Ensure initial snapshot exists
      await snapshotService.ensureInitialSnapshot()

      // Check for pending timer
      const timer = await this.getTimerState()

      if (timer && timer.isActive && timer.scheduledResetAt) {
        const now = new Date()
        const scheduledTime = new Date(timer.scheduledResetAt)
        const remainingMs = scheduledTime.getTime() - now.getTime()

        if (remainingMs <= 0) {
          // Timer already expired, execute reset immediately
          console.log('[Demo Reset] Pending timer expired during downtime, executing reset...')
          await this.executeReset('scheduled (delayed due to server downtime)')
        } else {
          // Resume timer with remaining time
          console.log(`[Demo Reset] Resuming timer with ${Math.round(remainingMs / 1000 / 60)} minutes remaining`)
          this.scheduleTimeout(remainingMs)
        }
      } else {
        console.log('[Demo Reset] No pending timer found')
      }

      this.initialized = true
      console.log('[Demo Reset] Timer service initialized')
    } catch (error) {
      console.error('[Demo Reset] Failed to initialize timer service:', error.message)
    }
  }

  /**
   * Get the current timer state from database
   */
  async getTimerState() {
    return DemoResetTimer.findOne({ key: 'demo-reset-timer' }).lean()
  }

  /**
   * Start or reset the 30-minute countdown timer
   * @param {string} action - The action that triggered the timer (e.g., 'UPDATE challenge')
   * @param {string} entityType - The type of entity modified
   * @param {string} entityId - The ID of the entity modified
   */
  async startTimer(action, entityType = null, entityId = null) {
    const scheduledResetAt = new Date(Date.now() + demoConfig.RESET_DELAY_MS)

    // Clear existing timeout if any
    this.clearActiveTimeout()

    // Update or create timer state in database
    await DemoResetTimer.findOneAndUpdate(
      { key: 'demo-reset-timer' },
      {
        scheduledResetAt,
        triggerAction: action,
        triggerEntityType: entityType,
        triggerEntityId: entityId,
        timerSetAt: new Date(),
        isActive: true
      },
      { upsert: true, new: true }
    )

    // Schedule the actual timeout
    this.scheduleTimeout(demoConfig.RESET_DELAY_MS)

    const minutes = Math.round(demoConfig.RESET_DELAY_MS / 1000 / 60)
    console.log(`[Demo Reset] Timer started/reset: ${action} - reset scheduled in ${minutes} minutes`)

    return {
      scheduledResetAt,
      triggerAction: action,
      delayMinutes: minutes
    }
  }

  /**
   * Schedule the actual JavaScript timeout
   * @param {number} delayMs - Delay in milliseconds
   */
  scheduleTimeout(delayMs) {
    this.clearActiveTimeout()

    this.activeTimeout = setTimeout(async () => {
      await this.executeReset('scheduled')
    }, delayMs)

    // Prevent the timeout from keeping the process alive
    if (this.activeTimeout.unref) {
      this.activeTimeout.unref()
    }
  }

  /**
   * Clear the active JavaScript timeout
   */
  clearActiveTimeout() {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout)
      this.activeTimeout = null
    }
  }

  /**
   * Execute the database reset
   * @param {string} reason - Why the reset was executed
   */
  async executeReset(reason = 'manual') {
    try {
      console.log(`[Demo Reset] Executing reset: ${reason}`)

      // Perform the restore
      const result = await snapshotService.restoreFromSnapshot()

      // Clear timer state
      await DemoResetTimer.findOneAndUpdate(
        { key: 'demo-reset-timer' },
        {
          isActive: false,
          scheduledResetAt: null,
          triggerAction: null,
          triggerEntityType: null,
          triggerEntityId: null,
          timerSetAt: null
        }
      )

      this.clearActiveTimeout()

      console.log(`[Demo Reset] Reset completed successfully`)

      return {
        success: true,
        reason,
        restoredAt: result.restoredAt,
        results: result.results
      }
    } catch (error) {
      console.error('[Demo Reset] Reset failed:', error.message)
      throw error
    }
  }

  /**
   * Cancel the pending reset timer
   */
  async cancelTimer() {
    this.clearActiveTimeout()

    const timer = await DemoResetTimer.findOneAndUpdate(
      { key: 'demo-reset-timer' },
      {
        isActive: false,
        scheduledResetAt: null,
        triggerAction: null,
        triggerEntityType: null,
        triggerEntityId: null,
        timerSetAt: null
      },
      { new: true }
    )

    console.log('[Demo Reset] Timer cancelled')

    return {
      success: true,
      cancelled: true
    }
  }

  /**
   * Get current timer status for API
   */
  async getStatus() {
    const timer = await this.getTimerState()
    const snapshot = await snapshotService.getLatestSnapshot()

    let remainingMs = null
    let remainingMinutes = null

    if (timer && timer.isActive && timer.scheduledResetAt) {
      const now = new Date()
      const scheduledTime = new Date(timer.scheduledResetAt)
      remainingMs = Math.max(0, scheduledTime.getTime() - now.getTime())
      remainingMinutes = Math.ceil(remainingMs / 1000 / 60)
    }

    return {
      timer: {
        isActive: timer?.isActive || false,
        scheduledResetAt: timer?.scheduledResetAt || null,
        remainingMs,
        remainingMinutes,
        triggerAction: timer?.triggerAction || null,
        triggerEntityType: timer?.triggerEntityType || null,
        triggerEntityId: timer?.triggerEntityId || null,
        timerSetAt: timer?.timerSetAt || null
      },
      snapshot: snapshot ? {
        snapshotId: snapshot.snapshotId,
        createdAt: snapshot.createdAt,
        createdBy: snapshot.createdBy,
        type: snapshot.type,
        documentCounts: snapshot.documentCounts
      } : null,
      config: {
        demoAdminEmail: demoConfig.DEMO_ADMIN_EMAIL,
        resetDelayMinutes: demoConfig.RESET_DELAY_MS / 1000 / 60,
        resettableCollections: demoConfig.RESETTABLE_COLLECTIONS
      }
    }
  }
}

module.exports = new ResetTimerService()
