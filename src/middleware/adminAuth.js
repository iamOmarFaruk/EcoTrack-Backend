const crypto = require('crypto')
const { getAdminConfig } = require('../config/admin')

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'ADMIN' })).toString('base64url')

function signAdminToken(payload = {}) {
  const { tokenSecret, tokenExpiryHours } = getAdminConfig()
  const exp = Math.floor(Date.now() / 1000) + (tokenExpiryHours * 60 * 60)
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url')
  const signature = crypto
    .createHmac('sha256', tokenSecret)
    .update(`${HEADER}.${body}`)
    .digest('base64url')

  return `${HEADER}.${body}.${signature}`
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token')
  }

  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) {
    throw new Error('Malformed token')
  }

  const { tokenSecret } = getAdminConfig()
  const expectedSignature = crypto
    .createHmac('sha256', tokenSecret)
    .update(`${header}.${body}`)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Invalid signature')
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  return payload
}

function adminAuth(req, res, next) {
  // Read token from httpOnly cookie
  const token = req.cookies.admin_token

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Admin token required' }
    })
  }

  try {
    const payload = verifyAdminToken(token)
    req.admin = payload
    return next()
  } catch (error) {
    // Clear invalid cookie
    res.clearCookie('admin_token')
    return res.status(401).json({
      success: false,
      error: { message: error.message || 'Invalid admin token' }
    })
  }
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  adminAuth
}
