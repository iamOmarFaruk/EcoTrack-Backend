const express = require("express");
const router = express.Router();
const { authenticateFirebaseToken, optionalFirebaseAuth } = require("../middleware/firebaseAuth");
const {
  getAllChallenges,
  getChallengeBySlug,
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

// User-specific routes (must come BEFORE other routes to avoid conflicts)
router.get("/my/created", authenticateFirebaseToken, getMyCreatedChallenges);
router.get("/my/joined", authenticateFirebaseToken, getMyJoinedChallengesList);

// Public routes (no authentication required)
router.get("/", getAllChallenges);
router.get("/community-impact/summary", getCommunityImpactSummary);
router.get("/slug/:slug", optionalFirebaseAuth, getChallengeBySlug); // SEO-friendly URL

// Authenticated routes - using MongoDB _id for operations
router.post("/", authenticateFirebaseToken, createNewChallenge);
router.put("/:id", authenticateFirebaseToken, updateExistingChallenge);
router.delete("/:id", authenticateFirebaseToken, deleteExistingChallenge);
router.post("/:id/join", authenticateFirebaseToken, joinExistingChallenge);
router.post("/:id/leave", authenticateFirebaseToken, leaveExistingChallenge);
router.get("/:id/participants", optionalFirebaseAuth, getChallengeParticipantsList);

module.exports = router;
