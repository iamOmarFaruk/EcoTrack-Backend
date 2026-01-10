const express = require('express')
const rateLimit = require('express-rate-limit')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { authenticateFirebaseToken, requireAdmin } = require('../middleware/firebaseAuth')
const demoTrackMiddleware = require('../middleware/demoTrackMiddleware')
const resetRoutes = require('./reset')

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

// Apply general rate limiting to all admin routes
router.use(adminOperationsLimiter)

// Firebase admin authentication for all admin routes
router.use(authenticateFirebaseToken, requireAdmin)

// Apply demo tracking middleware to track mutations by demo admin
router.use(demoTrackMiddleware)

// Demo reset routes (mounted at /api/admin/reset)
router.use('/reset', resetRoutes)

// Dashboard data
router.get('/me', adminController.me)
router.post('/logout', adminController.logout)
router.get('/dashboard', adminController.dashboard)

// Public site content management
router.get('/content', adminController.getContent)
router.put('/content', adminController.updateContent)

// User management
router.get('/users', adminController.listUsers)
router.patch('/users/:id', adminController.updateUser)

// Challenges moderation
router.get('/challenges', adminController.listChallenges)
router.get('/challenges/:id', adminController.getChallenge)
router.put('/challenges/:id', adminController.updateChallenge)
router.patch('/challenges/:id/status', adminController.updateChallengeStatus)
router.delete('/challenges/:id', adminController.deleteChallenge)

// Events moderation
router.get('/events', adminController.listEvents)
router.get('/events/:id', adminController.getEvent)
router.put('/events/:id', adminController.updateEvent)
router.patch('/events/:id/status', adminController.updateEventStatus)
router.delete('/events/:id', adminController.deleteEvent)

// Tips moderation
router.get('/tips', adminController.listTips)
router.patch('/tips/:id/status', adminController.updateTipStatus)

// Activity log
router.get('/activity', adminController.activity)
router.delete('/activity', adminController.clearActivity)
router.delete('/activity/:id', adminController.deleteActivity)

module.exports = router
