const crypto = require('crypto')
const bcrypt = require('bcrypt')

const SALT_ROUNDS = 12

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
 * Verify an admin password using bcrypt
 * @param {string} inputPassword - The password to verify
 * @returns {Promise<boolean>} - Whether the password is correct
 */
async function verifyPassword(inputPassword) {
  const hashedEnvPassword = process.env.ADMIN_PASSWORD_HASH

  if (!hashedEnvPassword) {
    throw new Error('Admin password not configured. Please set ADMIN_PASSWORD_HASH in environment variables.')
  }

  try {
    return await bcrypt.compare(inputPassword, hashedEnvPassword)
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

/**
 * Hash a password using bcrypt (for generating ADMIN_PASSWORD_HASH)
 * @param {string} plainPassword - The password to hash
 * @returns {Promise<string>} - The hashed password
 */
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS)
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
  hashPassword,
  safeCompare
}
