const express = require("express");
const router = express.Router();
const { authenticateFirebaseToken, optionalFirebaseAuth } = require("../middleware/firebaseAuth");
const {
  getAllChallenges,
  getChallengeDetails,
  createNewChallenge,
  updateExistingChallenge,
  deleteExistingChallenge,
  joinExistingChallenge,
  leaveExistingChallenge,
  getMyCreatedChallenges,
  getMyJoinedChallengesList,
  getChallengeParticipantsList,
  getCommunityImpactSummary,
} = require("../controllers/challengeController");

// User-specific routes (must come BEFORE /:id routes to avoid conflicts)
router.get("/my/created", authenticateFirebaseToken, getMyCreatedChallenges);
router.get("/my/joined", authenticateFirebaseToken, getMyJoinedChallengesList);

// Public routes (no authentication required)
router.get("/", getAllChallenges);
router.get("/community-impact/summary", getCommunityImpactSummary);
router.get("/:id", optionalFirebaseAuth, getChallengeDetails);
router.get("/:id/participants", optionalFirebaseAuth, getChallengeParticipantsList);

// Authenticated routes
router.post("/", authenticateFirebaseToken, createNewChallenge);
router.put("/:id", authenticateFirebaseToken, updateExistingChallenge);
router.delete("/:id", authenticateFirebaseToken, deleteExistingChallenge);
router.post("/:id/join", authenticateFirebaseToken, joinExistingChallenge);
router.post("/:id/leave", authenticateFirebaseToken, leaveExistingChallenge);

module.exports = router;
