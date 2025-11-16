const { mongoose } = require("../config/mongoose");

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
 * Generate unique slug from title with auto-increment
 */
async function generateUniqueSlug(title, excludeId = null) {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = baseSlug;
  let counter = 1;

  // Check if slug exists
  while (true) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const existing = await Challenge.findOne(query).lean();
    if (!existing) break;
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

const participantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, default: "joined" },
  },
  { _id: false }
);

const challengeSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  shortDescription: { type: String, required: true },
  detailedDescription: { type: String, default: "" },
  image: { type: String, required: true },
  participants: { type: [participantSchema], default: [] },
  registeredParticipants: { type: Number, default: 0 },
  duration: { type: String, required: true },
  communityImpact: {
    co2SavedKg: { type: Number, default: 0 },
    plasticReducedKg: { type: Number, default: 0 },
    waterSavedL: { type: Number, default: 0 },
    energySavedKwh: { type: Number, default: 0 },
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  featured: { type: Boolean, default: false },
  status: { type: String, default: "active" },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

challengeSchema.index({ category: 1, isActive: 1 });
challengeSchema.index({ title: "text", shortDescription: "text", detailedDescription: "text" });

const Challenge =
  mongoose.models.Challenge || mongoose.model("Challenge", challengeSchema);

/**
 * Create a new challenge
 */
async function createChallenge(challengeData, userId) {
  const now = new Date().toISOString();

  const slug = await generateUniqueSlug(challengeData.title);

  const challenge = new Challenge({
    slug,
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
    communityImpact: {
      co2SavedKg: Number(challengeData.communityImpact?.co2SavedKg) || 0,
      plasticReducedKg:
        Number(challengeData.communityImpact?.plasticReducedKg) || 0,
      waterSavedL: Number(challengeData.communityImpact?.waterSavedL) || 0,
      energySavedKwh:
        Number(challengeData.communityImpact?.energySavedKwh) || 0,
    },
    startDate: challengeData.startDate,
    endDate: challengeData.endDate,
    featured: challengeData.featured || false,
    status: "active",
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await challenge.save();
  return challenge.toObject();
}

/**
 * Get all challenges with filters and pagination
 */
async function getChallenges(filters = {}) {
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
    Challenge.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Challenge.countDocuments(query),
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
 * Get challenge by slug (for viewing)
 */
async function getChallengeBySlug(slug, userId = null) {
  const challenge = await Challenge.findOne({ slug }).lean();

  if (!challenge) return null;

  // Add computed fields if user is authenticated
  if (userId) {
    challenge.isCreator = challenge.createdBy === userId;
    challenge.isJoined = challenge.participants.some(
      (p) => p.userId === userId && p.status === "active"
    );
  }

  return challenge;
}

/**
 * Get challenge by MongoDB _id (for operations)
 */
async function getChallengeById(id, userId = null) {
  const challenge = await Challenge.findById(id).lean();

  if (!challenge) return null;

  // Add computed fields if user is authenticated
  if (userId) {
    challenge.isCreator = challenge.createdBy === userId;
    challenge.isJoined = challenge.participants.some(
      (p) => p.userId === userId && p.status === "active"
    );
  }

  return challenge;
}

/**
 * Update challenge
 */
async function updateChallenge(id, updateData, userId) {
  // Remove fields that shouldn't be updated directly
  const { _id, slug, createdAt, createdBy, participants, registeredParticipants, ...allowedUpdates } = updateData;

  // If title is being updated, regenerate slug
  if (allowedUpdates.title) {
    allowedUpdates.slug = await generateUniqueSlug(allowedUpdates.title, id);
  }

  // Add updatedAt timestamp
  allowedUpdates.updatedAt = new Date().toISOString();

  const result = await Challenge.findOneAndUpdate(
    { _id: id, createdBy: userId },
    { $set: allowedUpdates },
    { new: true }
  ).lean();

  return result;
}

/**
 * Delete challenge
 */
async function deleteChallenge(id, userId) {
  const challenge = await Challenge.findOne({ _id: id, createdBy: userId }).lean();
  
  if (!challenge) {
    return { success: false, error: "not_found" };
  }

  // If has active participants, cancel instead of delete
  if (challenge.registeredParticipants > 0) {
    const result = await Challenge.updateOne(
      { _id: id, createdBy: userId },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        },
      }
    );
    return { 
      success: result.modifiedCount > 0, 
      cancelled: true,
      message: "Challenge cancelled successfully (has participants)"
    };
  }

  // Hard delete if no participants
  const result = await Challenge.deleteOne({ _id: id, createdBy: userId });
  return { 
    success: result.deletedCount > 0,
    cancelled: false,
    message: "Challenge deleted successfully"
  };
}

/**
 * Join challenge - allows unlimited rejoining
 */
async function joinChallenge(id, userId) {
  const challenge = await Challenge.findById(id);
  
  if (!challenge) {
    return { success: false, error: "not_found" };
  }
  
  if (challenge.createdBy === userId) {
    return { success: false, error: "creator_cannot_join" };
  }
  
  if (challenge.status !== "active") {
    return { success: false, error: "not_active" };
  }

  // Check if user already has an active participation
  const existingParticipant = challenge.participants.find(
    (p) => p.userId === userId && p.status === "active"
  );

  if (existingParticipant) {
    return { success: false, error: "already_joined" };
  }

  // Find if user has left before
  const participantIndex = challenge.participants.findIndex(
    (p) => p.userId === userId
  );

  if (participantIndex !== -1) {
    // User rejoining - update existing entry
    challenge.participants[participantIndex].status = "active";
    challenge.participants[participantIndex].joinedAt = new Date();
  } else {
    // New participant
    challenge.participants.push({
      userId,
      joinedAt: new Date(),
      status: "active",
    });
  }

  // Update registered participants count
  challenge.registeredParticipants = challenge.participants.filter(
    (p) => p.status === "active"
  ).length;
  challenge.updatedAt = new Date();

  await challenge.save();

  // Fetch updated challenge
  const updatedChallenge = await getChallengeById(id, userId);
  return { success: true, challenge: updatedChallenge };
}

/**
 * Leave challenge
 */
async function leaveChallenge(id, userId) {
  const challenge = await Challenge.findOne({
    _id: id,
    "participants": {
      $elemMatch: {
        userId,
        status: "active"
      }
    }
  });

  if (!challenge) {
    return { success: false, error: "not_joined" };
  }

  // Find the participant
  const participant = challenge.participants.find(
    p => p.userId === userId && p.status === "active"
  );

  if (!participant) {
    return { success: false, error: "not_joined" };
  }

  // Update participant status to left
  participant.status = "left";

  // Update registered participants count
  challenge.registeredParticipants = challenge.participants.filter(
    (p) => p.status === "active"
  ).length;
  challenge.updatedAt = new Date();

  await challenge.save();

  // Fetch updated challenge
  const updatedChallenge = await getChallengeById(id, userId);
  return { success: true, challenge: updatedChallenge };
}

/**
 * Get challenges created by user
 */
async function getMyChallenges(userId) {
  const challenges = await Challenge.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .lean();

  return challenges;
}

/**
 * Get challenges joined by user
 */
async function getMyJoinedChallenges(userId, filters = {}) {
  const query = {
    participants: {
      $elemMatch: {
        userId,
        status: filters.status || "active",
      },
    },
  };

  // Exclude completed challenges unless explicitly requested
  if (!filters.includeCompleted) {
    query.status = { $ne: "completed" };
  }

  const challenges = await Challenge.find(query)
    .sort({ startDate: 1 })
    .lean();

  return challenges;
}

/**
 * Aggregate community impact across all challenges
 */
async function getCommunityImpactTotals() {
  const result = await Challenge.aggregate([
    {
      $group: {
        _id: null,
        totalCo2SavedKg: { $sum: "$communityImpact.co2SavedKg" },
        totalPlasticReducedKg: { $sum: "$communityImpact.plasticReducedKg" },
        totalWaterSavedL: { $sum: "$communityImpact.waterSavedL" },
        totalEnergySavedKwh: { $sum: "$communityImpact.energySavedKwh" },
      },
    },
  ]);

  const totals = result[0] || {};

  return {
    co2SavedKg: totals.totalCo2SavedKg || 0,
    plasticReducedKg: totals.totalPlasticReducedKg || 0,
    waterSavedL: totals.totalWaterSavedL || 0,
    energySavedKwh: totals.totalEnergySavedKwh || 0,
  };
}

/**
 * Get challenge participants
 */
async function getChallengeParticipants(id, userId = null) {
  const challenge = await Challenge.findById(id).lean();

  if (!challenge) return null;

  // If user is creator, return full participant list
  if (userId && challenge.createdBy === userId) {
    return {
      participants: challenge.participants.filter(p => p.status === "active"),
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
  const query = {
    title: { $regex: new RegExp(`^${title}$`, "i") },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await Challenge.findOne(query).lean();
  return !existing;
}

module.exports = {
  VALID_CATEGORIES,
  DEFAULT_IMAGES,
  generateUniqueSlug,
  createChallenge,
  getChallenges,
  getChallengeById,
  getChallengeBySlug,
  updateChallenge,
  deleteChallenge,
  joinChallenge,
  leaveChallenge,
  getMyChallenges,
  getMyJoinedChallenges,
  getChallengeParticipants,
  isTitleUnique,
  getCommunityImpactTotals,
};
