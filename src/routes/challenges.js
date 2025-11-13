const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');

/**
 * Challenge Routes
 * Base path: /api/challenges
 */

// GET /api/challenges - Get all challenges with filtering
router.get('/', challengeController.getAllChallenges);

// GET /api/challenges/:id - Get specific challenge
router.get('/:id', challengeController.getChallengeById);

// POST /api/challenges - Create new challenge (auth required later)
router.post('/', challengeController.createChallenge);

// PATCH /api/challenges/:id - Update challenge (auth required later)
router.patch('/:id', challengeController.updateChallenge);

// DELETE /api/challenges/:id - Delete challenge (auth required later)
router.delete('/:id', challengeController.deleteChallenge);

// POST /api/challenges/join/:id - Join challenge (auth required later)
router.post('/join/:id', challengeController.joinChallenge);

// POST /api/challenges/leave/:id - Leave challenge (auth required later)
router.post('/leave/:id', challengeController.leaveChallenge);

// PATCH /api/challenges/:id/progress - Update progress (auth required later)
router.patch('/:id/progress', challengeController.updateProgress);

// POST /api/challenges/:id/complete - Complete challenge (auth required later)
router.post('/:id/complete', challengeController.completeChallenge);

// GET /api/challenges/:id/participants - Get challenge participants
router.get('/:id/participants', challengeController.getChallengeParticipants);

module.exports = router;