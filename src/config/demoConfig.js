/**
 * Demo Reset Configuration
 *
 * Controls the demo reset functionality for the EcoTrack demo environment.
 * Only the demo admin (admin@ecotrack.com) triggers auto-reset behavior.
 */

const DEMO_ADMIN_EMAIL = 'admin@ecotrack.com'

module.exports = {
  // Demo admin email
  DEMO_ADMIN_EMAIL,

  // Reset timer delay in milliseconds (30 minutes)
  RESET_DELAY_MS: 30 * 60 * 1000,

  // Collections that should be snapshotted and reset
  // These will be restored to their snapshot state on reset
  RESETTABLE_COLLECTIONS: [
    'challenges',
    'events',
    'tips',
    'sitecontents',
    'adminactivities'
  ],

  // Collections that should NEVER be reset
  // User data is preserved across resets
  PROTECTED_COLLECTIONS: [
    'users'
  ],

  /**
   * Check if an email belongs to the demo admin
   * @param {string} email - Email to check
   * @returns {boolean} True if this is the demo admin
   */
  isDemoAdmin: (email) => {
    return email?.toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase()
  }
}
