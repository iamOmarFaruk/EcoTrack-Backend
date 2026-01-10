const { mongoose } = require('../config/mongoose')

/**
 * Demo Reset Timer Schema
 *
 * Persists the reset timer state across server restarts.
 * This is a singleton document (only one exists with key='demo-reset-timer').
 */
const demoResetTimerSchema = new mongoose.Schema({
  // Singleton document identifier
  key: {
    type: String,
    default: 'demo-reset-timer',
    unique: true
  },

  // When the reset should occur
  scheduledResetAt: {
    type: Date,
    default: null
  },

  // The operation that triggered the timer
  triggerAction: {
    type: String,
    default: null
  },

  // The type of entity that was modified
  triggerEntityType: {
    type: String,
    default: null
  },

  // The ID of the entity that was modified
  triggerEntityId: {
    type: String,
    default: null
  },

  // When the timer was set
  timerSetAt: {
    type: Date,
    default: null
  },

  // Whether a reset is pending
  isActive: {
    type: Boolean,
    default: false
  }
})

const DemoResetTimer = mongoose.model('DemoResetTimer', demoResetTimerSchema)

module.exports = { DemoResetTimer }
