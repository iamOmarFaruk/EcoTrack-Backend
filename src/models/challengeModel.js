const { getDb } = require("../config/database");
const { ObjectId } = require("mongodb");

const COLLECTION_NAME = "challenges";

// Predefined categories
const VALID_CATEGORIES = [
  "Food",
  "Waste Reduction",
  "Energy Conservation",
  "Water",
  "Community",
];

// Default images by category
const DEFAULT_IMAGES = {
  Food: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80",
  "Waste Reduction":
    "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80",
  "Energy Conservation":
    "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80",
  Water:
    "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80",
  Community:
    "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80",
};

/**
 * Generate unique challenge ID from title and timestamp
 */
function generateChallengeId(title) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const timestamp = Math.floor(Date.now() / 1000);
  return `${slug}-${timestamp}`;
}

/**
 * Get challenges collection
 */
function getChallengesCollection() {
  const db = getDb();
  return db.collection(COLLECTION_NAME);
}

/**
 * Create a new challenge
 */
async function createChallenge(challengeData, userId) {
  const collection = getChallengesCollection();
  const now = new Date().toISOString();

  const challenge = {
    id: generateChallengeId(challengeData.title),
    category: challengeData.category,
    title: challengeData.title.trim(),
    shortDescription: challengeData.shortDescription.trim(),
    detailedDescription: challengeData.detailedDescription
      ? challengeData.detailedDescription.trim()
      : "",
    image: challengeData.image || DEFAULT_IMAGES[challengeData.category],
    participants: [],
    registeredParticipants: 0,
    duration: challengeData.duration.trim(),
    impact: challengeData.impact.trim(),
    co2Saved: challengeData.co2Saved ? challengeData.co2Saved.trim() : "",
    startDate: challengeData.startDate,
    endDate: challengeData.endDate,
    featured: challengeData.featured || false,
    status: "active",
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(challenge);
  return { ...challenge, _id: result.insertedId };
}

/**
 * Get all challenges with filters and pagination
 */
async function getChallenges(filters = {}) {
  const collection = getChallengesCollection();

  const {
    page = 1,
    limit = 10,
    search,
    status,
    category,
    featured,
    sortBy = "startDate",
    order = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const query = {};

  // Apply filters
  if (status) query.status = status;
  if (category) query.category = category;
  if (featured !== undefined) query.featured = featured === "true";

  // Apply search
  if (search) {
    query.$text = { $search: search };
  }

  // Sort configuration
  const sortOrder = order === "asc" ? 1 : -1;
  const sort = search
    ? { score: { $meta: "textScore" }, [sortBy]: sortOrder }
    : { [sortBy]: sortOrder };

  // Execute queries
  const [challenges, total] = await Promise.all([
    collection.find(query).sort(sort).skip(skip).limit(limit).toArray(),
    collection.countDocuments(query),
  ]);

  return {
    challenges,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get challenge by ID
 */
async function getChallengeById(id, userId = null) {
  const collection = getChallengesCollection();
  const challenge = await collection.findOne({ id });

  if (!challenge) return null;

  // Add computed fields if user is authenticated
  if (userId) {
    challenge.isCreator = challenge.createdBy === userId;
    challenge.isJoined = challenge.participants.some(
      (p) => p.userId === userId && p.status === "joined"
    );
  }

  return challenge;
}

/**
 * Update challenge
 */
async function updateChallenge(id, updateData, userId) {
  const collection = getChallengesCollection();

  // Remove fields that shouldn't be updated directly
  const { _id, id: challengeId, createdAt, createdBy, participants, registeredParticipants, ...allowedUpdates } = updateData;

  // Add updatedAt timestamp
  allowedUpdates.updatedAt = new Date().toISOString();

  const result = await collection.findOneAndUpdate(
    { id, createdBy: userId },
    { $set: allowedUpdates },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Delete challenge
 */
async function deleteChallenge(id, userId) {
  const collection = getChallengesCollection();

  // Check if challenge has participants
  const challenge = await collection.findOne({ id, createdBy: userId });
  
  if (!challenge) {
    return { success: false, error: "not_found" };
  }

  // If has active participants, cancel instead of delete
  if (challenge.registeredParticipants > 0) {
    const result = await collection.updateOne(
      { id, createdBy: userId },
      { 
        $set: { 
          status: "cancelled",
          updatedAt: new Date().toISOString()
        } 
      }
    );
    return { 
      success: result.modifiedCount > 0, 
      cancelled: true,
      message: "Challenge cancelled successfully (has participants)"
    };
  }

  // Hard delete if no participants
  const result = await collection.deleteOne({ id, createdBy: userId });
  return { 
    success: result.deletedCount > 0,
    cancelled: false,
    message: "Challenge deleted successfully"
  };
}

/**
 * Join challenge - atomic operation
 */
async function joinChallenge(id, userId) {
  const collection = getChallengesCollection();

  const result = await collection.updateOne(
    {
      id,
      status: "active",
      "participants.userId": { $ne: userId }, // User hasn't joined
      createdBy: { $ne: userId }, // Not the creator
    },
    {
      $inc: { registeredParticipants: 1 },
      $push: {
        participants: {
          userId,
          joinedAt: new Date().toISOString(),
          status: "joined",
        },
      },
      $set: { updatedAt: new Date().toISOString() },
    }
  );

  if (result.modifiedCount === 0) {
    // Determine specific error
    const challenge = await collection.findOne({ id });
    
    if (!challenge) {
      return { success: false, error: "not_found" };
    }
    if (challenge.createdBy === userId) {
      return { success: false, error: "creator_cannot_join" };
    }
    if (challenge.status !== "active") {
      return { success: false, error: "not_active" };
    }
    if (challenge.participants.some(p => p.userId === userId && p.status === "joined")) {
      return { success: false, error: "already_joined" };
    }
    
    return { success: false, error: "unknown" };
  }

  // Fetch updated challenge
  const updatedChallenge = await getChallengeById(id, userId);
  return { success: true, challenge: updatedChallenge };
}

/**
 * Leave challenge - atomic operation
 */
async function leaveChallenge(id, userId) {
  const collection = getChallengesCollection();

  // First, find the participant index
  const challenge = await collection.findOne({
    id,
    "participants": {
      $elemMatch: {
        userId,
        status: "joined"
      }
    }
  });

  if (!challenge) {
    return { success: false, error: "not_joined" };
  }

  // Find the index of the participant
  const participantIndex = challenge.participants.findIndex(
    p => p.userId === userId && p.status === "joined"
  );

  if (participantIndex === -1) {
    return { success: false, error: "not_joined" };
  }

  // Update using positional operator
  const result = await collection.updateOne(
    {
      id,
      "participants.userId": userId,
    },
    {
      $inc: { registeredParticipants: -1 },
      $set: {
        [`participants.${participantIndex}.status`]: "left",
        updatedAt: new Date().toISOString(),
      },
    }
  );

  if (result.modifiedCount === 0) {
    return { success: false, error: "not_joined" };
  }

  // Fetch updated challenge
  const updatedChallenge = await getChallengeById(id, userId);
  return { success: true, challenge: updatedChallenge };
}

/**
 * Get challenges created by user
 */
async function getMyChallenges(userId) {
  const collection = getChallengesCollection();
  const challenges = await collection
    .find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .toArray();

  return challenges;
}

/**
 * Get challenges joined by user
 */
async function getMyJoinedChallenges(userId, filters = {}) {
  const collection = getChallengesCollection();
  
  const query = {
    participants: {
      $elemMatch: {
        userId,
        status: filters.status || "joined",
      },
    },
  };

  // Exclude completed challenges unless explicitly requested
  if (!filters.includeCompleted) {
    query.status = { $ne: "completed" };
  }

  const challenges = await collection
    .find(query)
    .sort({ startDate: 1 })
    .toArray();

  return challenges;
}

/**
 * Get challenge participants
 */
async function getChallengeParticipants(id, userId = null) {
  const collection = getChallengesCollection();
  const challenge = await collection.findOne({ id });

  if (!challenge) return null;

  // If user is creator, return full participant list
  if (userId && challenge.createdBy === userId) {
    return {
      participants: challenge.participants,
      count: challenge.registeredParticipants,
    };
  }

  // Otherwise, just return count
  return {
    count: challenge.registeredParticipants,
    message: "Participant details available to creator only",
  };
}

/**
 * Check if title is unique (case-insensitive)
 */
async function isTitleUnique(title, excludeId = null) {
  const collection = getChallengesCollection();
  const query = {
    title: { $regex: new RegExp(`^${title}$`, "i") },
  };

  if (excludeId) {
    query.id = { $ne: excludeId };
  }

  const existing = await collection.findOne(query);
  return !existing;
}

module.exports = {
  VALID_CATEGORIES,
  DEFAULT_IMAGES,
  generateChallengeId,
  getChallengesCollection,
  createChallenge,
  getChallenges,
  getChallengeById,
  updateChallenge,
  deleteChallenge,
  joinChallenge,
  leaveChallenge,
  getMyChallenges,
  getMyJoinedChallenges,
  getChallengeParticipants,
  isTitleUnique,
};
