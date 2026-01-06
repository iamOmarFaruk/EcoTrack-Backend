const crypto = require('crypto')

const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@ecotrack.com',
  password: process.env.ADMIN_PASSWORD || 'Admin#2025',
  name: process.env.ADMIN_NAME || 'EcoTrack Admin'
}

const ADMIN_TOKEN_SECRET = process.env.ADMIN_JWT_SECRET || 'eco-admin-secret'
const ADMIN_TOKEN_EXPIRY_HOURS = parseInt(process.env.ADMIN_JWT_EXPIRY_HOURS || '12', 10)

/**
 * Safely compare two strings to avoid timing attacks
 */
function safeCompare(a, b) {
  const aBuffer = Buffer.from(String(a))
  const bBuffer = Buffer.from(String(b))

  if (aBuffer.length !== bBuffer.length) return false

  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

/**
 * Verify an admin password using either a SHA-256 hash or plain text fallback
 */
function verifyPassword(inputPassword) {
  const hashedEnvPassword = process.env.ADMIN_PASSWORD_HASH
  if (hashedEnvPassword) {
    const hash = crypto.createHash('sha256').update(inputPassword).digest('hex')
    return safeCompare(hash, hashedEnvPassword)
  }

  return safeCompare(inputPassword, DEFAULT_ADMIN.password)
}

/**
 * Get admin configuration for the control panel
 */
function getAdminConfig() {
  return {
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    tokenSecret: ADMIN_TOKEN_SECRET,
    tokenExpiryHours: ADMIN_TOKEN_EXPIRY_HOURS
  }
}

module.exports = {
  getAdminConfig,
  verifyPassword,
  safeCompare
}
