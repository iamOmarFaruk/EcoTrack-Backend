const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { authenticateFirebaseToken } = require('../middleware/firebaseAuth');

/**
 * Challenge Routes
 * Base path: /api/challenges
 */

// GET /api/challenges - Get all challenges with filtering
router.get('/', challengeController.getAllChallenges);

// GET /api/challenges/:id - Get specific challenge
router.get('/:id', challengeController.getChallengeById);

// POST /api/challenges - Create new challenge (requires authentication)
router.post('/', authenticateFirebaseToken, challengeController.createChallenge);

// PATCH /api/challenges/:id - Update challenge (requires authentication)
router.patch('/:id', authenticateFirebaseToken, challengeController.updateChallenge);

// DELETE /api/challenges/:id - Delete challenge (requires authentication)
router.delete('/:id', authenticateFirebaseToken, challengeController.deleteChallenge);

// POST /api/challenges/join/:id - Join challenge (requires authentication)
router.post('/join/:id', authenticateFirebaseToken, challengeController.joinChallenge);

// POST /api/challenges/leave/:id - Leave challenge (requires authentication)
router.post('/leave/:id', authenticateFirebaseToken, challengeController.leaveChallenge);

// PATCH /api/challenges/:id/progress - Update progress (requires authentication)
router.patch('/:id/progress', authenticateFirebaseToken, challengeController.updateProgress);

// POST /api/challenges/:id/complete - Complete challenge (requires authentication)
router.post('/:id/complete', authenticateFirebaseToken, challengeController.completeChallenge);

// GET /api/challenges/:id/participants - Get challenge participants
router.get('/:id/participants', challengeController.getChallengeParticipants);

module.exports = router;