const express = require('express')
const router = express.Router()
const siteController = require('../controllers/siteController')

// Public site content
router.get('/content', siteController.getContent)

module.exports = router
