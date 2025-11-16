const {
  VALID_CATEGORIES,
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
} = require("../models/challengeModel");

/**
 * Validate challenge data
 */
function validateChallengeData(data, isUpdate = false) {
  const errors = [];

  // Category validation
  if (!isUpdate || data.category !== undefined) {
    if (!data.category) {
      errors.push("Category is required");
    } else if (!VALID_CATEGORIES.includes(data.category)) {
      errors.push(
        `Category must be one of: ${VALID_CATEGORIES.join(", ")}`
      );
    }
  }

  // Title validation
  if (!isUpdate || data.title !== undefined) {
    if (!data.title) {
      errors.push("Title is required");
    } else if (data.title.trim().length < 5 || data.title.trim().length > 100) {
      errors.push("Title must be between 5 and 100 characters");
    }
  }

  // Short description validation
  if (!isUpdate || data.shortDescription !== undefined) {
    if (!data.shortDescription) {
      errors.push("Short description is required");
    } else if (
      data.shortDescription.trim().length < 20 ||
      data.shortDescription.trim().length > 250
    ) {
      errors.push("Short description must be between 20 and 250 characters");
    }
  }

  // Detailed description validation (optional)
  if (data.detailedDescription && data.detailedDescription.trim().length > 2000) {
    errors.push("Detailed description must not exceed 2000 characters");
  }

  // Image validation
  if (!isUpdate || data.image !== undefined) {
    if (!data.image) {
      errors.push("Image URL is required");
    } else {
      try {
        const url = new URL(data.image);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push("Image must be a valid HTTP or HTTPS URL");
        }
        // Block dangerous protocols
        if (["data:", "javascript:", "file:", "ftp:"].includes(url.protocol)) {
          errors.push("Invalid image URL protocol");
        }
        if (data.image.length > 500) {
          errors.push("Image URL must not exceed 500 characters");
        }
      } catch (e) {
        errors.push("Image must be a valid URL");
      }
    }
  }

  // Duration validation
  if (!isUpdate || data.duration !== undefined) {
    if (!data.duration) {
      errors.push("Duration is required");
    } else if (data.duration.trim().length < 2 || data.duration.trim().length > 50) {
      errors.push("Duration must be between 2 and 50 characters");
    }
  }

  // Impact validation
  const impact = data.communityImpact || {};

  const toNumber = (value) => {
    if (value === undefined || value === null || value === "") return 0;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : NaN;
  };

  if (!isUpdate) {
    const requiredFields = [
      "co2SavedKg",
      "plasticReducedKg",
      "waterSavedL",
      "energySavedKwh",
    ];

    for (const field of requiredFields) {
      if (impact[field] === undefined) {
        errors.push(`communityImpact.${field} is required`);
      }
    }
  }

  const numericFields = {
    co2SavedKg: impact.co2SavedKg,
    plasticReducedKg: impact.plasticReducedKg,
    waterSavedL: impact.waterSavedL,
    energySavedKwh: impact.energySavedKwh,
  };

  for (const [field, value] of Object.entries(numericFields)) {
    if (value !== undefined && value !== null && value !== "") {
      const num = toNumber(value);
      if (Number.isNaN(num)) {
        errors.push(`communityImpact.${field} must be a non-negative number`);
      }
    }
  }

  // Date validation
  if (!isUpdate || data.startDate !== undefined || data.endDate !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isUpdate && !data.startDate) {
      errors.push("Start date is required");
    } else if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push("Start date must be a valid date (YYYY-MM-DD)");
      } else if (!isUpdate && startDate < today) {
        errors.push("Start date must be today or in the future");
      }
    }

    if (!isUpdate && !data.endDate) {
      errors.push("End date is required");
    } else if (data.endDate) {
      const endDate = new Date(data.endDate);
      if (isNaN(endDate.getTime())) {
        errors.push("End date must be a valid date (YYYY-MM-DD)");
      }
    }

    // Check date range
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      if (endDate <= startDate) {
        errors.push("End date must be after start date");
      }
    }
  }

  // Featured validation (optional)
  if (data.featured !== undefined && typeof data.featured !== "boolean") {
    errors.push("Featured must be a boolean");
  }

  // Status validation (for updates)
  if (isUpdate && data.status !== undefined) {
    const validStatuses = ["active", "completed", "cancelled"];
    if (!validStatuses.includes(data.status)) {
      errors.push("Status must be one of: active, completed, cancelled");
    }
  }

  return errors;
}

/**
 * GET /api/challenges
 * Get all challenges with pagination, filtering, and search
 */
exports.getAllChallenges = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      featured,
      sortBy = "startDate",
      order = "desc",
    } = req.query;

    // Validate and limit page size
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);
    const parsedPage = parseInt(page) || 1;

    const filters = {
      page: parsedPage,
      limit: parsedLimit,
      search,
      status,
      category,
      featured,
      sortBy,
      order,
    };

    const result = await getChallenges(filters);

    res.json({
      success: true,
      data: result.challenges,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch challenges",
    });
  }
};

/**
 * GET /api/challenges/slug/:slug
 * Get single challenge with full details by slug (SEO-friendly)
 */
exports.getChallengeBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?.uid || null;

    const challenge = await getChallengeBySlug(slug, userId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    res.json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch challenge",
    });
  }
};

/**
 * POST /api/challenges
 * Create new challenge (authenticated)
 */
exports.createNewChallenge = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Validate input
    const errors = validateChallengeData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Check title uniqueness
    const titleUnique = await isTitleUnique(req.body.title);
    if (!titleUnique) {
      return res.status(400).json({
        success: false,
        message: "A challenge with this title already exists",
        error: "DUPLICATE_TITLE",
      });
    }

    // Create challenge
    const challenge = await createChallenge(req.body, userId);

    res.status(201).json({
      success: true,
      message: "Challenge created successfully",
      data: challenge,
    });
  } catch (error) {
    console.error("Error creating challenge:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create challenge",
    });
  }
};

/**
 * PUT /api/challenges/:id
 * Update challenge (creator only)
 */
exports.updateExistingChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    // Check if challenge exists and user is creator
    const existingChallenge = await getChallengeById(id);
    if (!existingChallenge) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    if (existingChallenge.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own challenges",
      });
    }

    // Validate update data
    const errors = validateChallengeData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Check title uniqueness if title is being changed
    if (req.body.title && req.body.title !== existingChallenge.title) {
      const titleUnique = await isTitleUnique(req.body.title, id);
      if (!titleUnique) {
        return res.status(400).json({
          success: false,
          message: "A challenge with this title already exists",
          error: "DUPLICATE_TITLE",
        });
      }
    }

    // Update challenge
    const updatedChallenge = await updateChallenge(id, req.body, userId);

    if (!updatedChallenge) {
      return res.status(400).json({
        success: false,
        message: "Failed to update challenge",
      });
    }

    res.json({
      success: true,
      message: "Challenge updated successfully",
      data: updatedChallenge,
    });
  } catch (error) {
    console.error("Error updating challenge:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update challenge",
    });
  }
};

/**
 * DELETE /api/challenges/:id
 * Delete challenge (creator only)
 */
exports.deleteExistingChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    // Check if challenge exists and user is creator
    const existingChallenge = await getChallengeById(id);
    if (!existingChallenge) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    if (existingChallenge.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own challenges",
      });
    }

    // Delete or cancel challenge
    const result = await deleteChallenge(id, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to delete challenge",
      });
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error deleting challenge:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete challenge",
    });
  }
};

/**
 * POST /api/challenges/:id/join
 * Join a challenge (authenticated)
 */
exports.joinExistingChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const result = await joinChallenge(id, userId);

    if (!result.success) {
      const errorMessages = {
        not_found: "Challenge not found",
        creator_cannot_join: "Cannot join your own challenge",
        not_active: "Challenge is not active",
        already_joined: "You have already joined this challenge",
        unknown: "Failed to join challenge",
      };

      const statusCodes = {
        not_found: 404,
        creator_cannot_join: 400,
        not_active: 400,
        already_joined: 400,
        unknown: 500,
      };

      return res.status(statusCodes[result.error] || 500).json({
        success: false,
        message: errorMessages[result.error] || "Failed to join challenge",
        error: result.error.toUpperCase(),
      });
    }

    res.json({
      success: true,
      message: "Successfully joined the challenge",
      data: result.challenge,
    });
  } catch (error) {
    console.error("Error joining challenge:", error);
    res.status(500).json({
      success: false,
      message: "Failed to join challenge",
    });
  }
};

/**
 * POST /api/challenges/:id/leave
 * Leave a challenge (authenticated)
 */
exports.leaveExistingChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const result = await leaveChallenge(id, userId);

    if (!result.success) {
      const errorMessages = {
        not_joined: "You have not joined this challenge",
      };

      return res.status(400).json({
        success: false,
        message: errorMessages[result.error] || "Failed to leave challenge",
        error: result.error.toUpperCase(),
      });
    }

    res.json({
      success: true,
      message: "Successfully left the challenge",
      data: result.challenge,
    });
  } catch (error) {
    console.error("Error leaving challenge:", error);
    res.status(500).json({
      success: false,
      message: "Failed to leave challenge",
    });
  }
};

/**
 * GET /api/challenges/my-challenges
 * Get challenges created by logged-in user
 */
exports.getMyCreatedChallenges = async (req, res) => {
  try {
    const userId = req.user.uid;
    const challenges = await getMyChallenges(userId);

    // Add isCreator flag
    const challengesWithFlags = challenges.map((challenge) => ({
      ...challenge,
      isCreator: true,
    }));

    res.json({
      success: true,
      data: challengesWithFlags,
      count: challenges.length,
    });
  } catch (error) {
    console.error("Error fetching my challenges:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your challenges",
    });
  }
};

/**
 * GET /api/challenges/my-joined
 * Get challenges joined by logged-in user
 */
exports.getMyJoinedChallengesList = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status, includeCompleted } = req.query;

    const filters = {
      status,
      includeCompleted: includeCompleted === "true",
    };

    const challenges = await getMyJoinedChallenges(userId, filters);

    res.json({
      success: true,
      data: challenges,
      count: challenges.length,
    });
  } catch (error) {
    console.error("Error fetching joined challenges:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch joined challenges",
    });
  }
};

/**
 * GET /api/challenges/:id/participants
 * Get list of participants for a challenge
 */
exports.getChallengeParticipantsList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid || null;

    const result = await getChallengeParticipants(id, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Challenge not found",
      });
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching participants:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch participants",
    });
  }
};

/**
 * GET /api/challenges/community-impact
 * Get aggregated community impact totals across all challenges
 */
exports.getCommunityImpactSummary = async (req, res) => {
  try {
    const totals = await getCommunityImpactTotals();

    res.json({
      success: true,
      data: {
        co2SavedKg: totals.co2SavedKg,
        plasticReducedKg: totals.plasticReducedKg,
        waterSavedL: totals.waterSavedL,
        energySavedKwh: totals.energySavedKwh,
      },
    });
  } catch (error) {
    console.error("Error fetching community impact totals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch community impact totals",
    });
  }
};
