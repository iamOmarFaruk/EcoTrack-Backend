const express = require('express')
const rateLimit = require('express-rate-limit')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { adminAuth } = require('../middleware/adminAuth')
const demoTrackMiddleware = require('../middleware/demoTrackMiddleware')
const resetRoutes = require('./reset')

// Strict rate limiting for admin login (5 attempts per 15 minutes)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts
  message: {
    success: false,
    error: { message: 'Too many login attempts. Please try again in 15 minutes.' }
  }
})

// General admin operations rate limiting (100 per 15 minutes)
const adminOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Please slow down.' }
  }
})

// Admin authentication with strict rate limiting
router.post('/login', adminLoginLimiter, adminController.login)
router.get('/me', adminAuth, adminController.me)
router.post('/logout', adminAuth, adminController.logout)

// Apply general rate limiting to all other admin routes
router.use(adminOperationsLimiter)

// Apply demo tracking middleware to track mutations by demo admin
router.use(demoTrackMiddleware)

// Demo reset routes (mounted at /api/admin/reset)
router.use('/reset', resetRoutes)

// Dashboard data
router.get('/dashboard', adminAuth, adminController.dashboard)

// Public site content management
router.get('/content', adminAuth, adminController.getContent)
router.put('/content', adminAuth, adminController.updateContent)

// User management
router.get('/users', adminAuth, adminController.listUsers)
router.patch('/users/:id', adminAuth, adminController.updateUser)

// Challenges moderation
router.get('/challenges', adminAuth, adminController.listChallenges)
router.get('/challenges/:id', adminAuth, adminController.getChallenge)
router.put('/challenges/:id', adminAuth, adminController.updateChallenge)
router.patch('/challenges/:id/status', adminAuth, adminController.updateChallengeStatus)
router.delete('/challenges/:id', adminAuth, adminController.deleteChallenge)

// Events moderation
router.get('/events', adminAuth, adminController.listEvents)
router.get('/events/:id', adminAuth, adminController.getEvent)
router.put('/events/:id', adminAuth, adminController.updateEvent)
router.patch('/events/:id/status', adminAuth, adminController.updateEventStatus)
router.delete('/events/:id', adminAuth, adminController.deleteEvent)

// Tips moderation
router.get('/tips', adminAuth, adminController.listTips)
router.patch('/tips/:id/status', adminAuth, adminController.updateTipStatus)

// Activity log
router.get('/activity', adminAuth, adminController.activity)
router.delete('/activity', adminAuth, adminController.clearActivity)
router.delete('/activity/:id', adminAuth, adminController.deleteActivity)

module.exports = router
