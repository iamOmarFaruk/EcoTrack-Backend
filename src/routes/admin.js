const express = require('express')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { adminAuth } = require('../middleware/adminAuth')

// Admin authentication
router.post('/login', adminController.login)
router.get('/me', adminAuth, adminController.me)

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
