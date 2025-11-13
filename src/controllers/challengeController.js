const { challengeDb } = require('../models/challengeModel');

/**
 * Challenge Controller
 * Handles all challenge-related operations
 */
class ChallengeController {
  
  /**
   * Get all challenges with filtering and pagination
   * GET /api/challenges
   */
  async getAllChallenges(req, res, next) {
    try {
      const { 
        category, 
        status, 
        search, 
        page = 1, 
        limit = 20 
      } = req.query;

      // Apply filters
      const challenges = await challengeDb.findAll({
        category,
        status,
        search
      });

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedChallenges = challenges.slice(startIndex, endIndex);

      // Prepare pagination info
      const totalChallenges = challenges.length;
      const totalPages = Math.ceil(totalChallenges / parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: {
          challenges: paginatedChallenges,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalChallenges,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single challenge by ID
   * GET /api/challenges/:id
   */
  async getChallengeById(req, res, next) {
    try {
      const { id } = req.params;
      
      const challenge = await challengeDb.findById(id);
      
      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Challenge not found',
            code: 'CHALLENGE_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: { challenge }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new challenge
   * POST /api/challenges
   */
  async createChallenge(req, res, next) {
    try {
      const {
        title,
        category,
        description,
        duration,
        target,
        startDate,
        endDate,
        difficulty,
        instructions,
        tips,
        imageUrl
      } = req.body;

      // Basic validation
      if (!title || !category || !description || !duration || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Required fields: title, category, description, duration, startDate, endDate',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      // Check if user is authenticated (this should always be true due to middleware)
      if (!req.user || !req.user.uid || !req.user.email) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User authentication required to create challenges',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }

      // Validate date logic
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'End date must be after start date',
            code: 'INVALID_DATE_RANGE'
          }
        });
      }

      const challengeData = {
        title,
        category,
        description,
        duration,
        target,
        startDate,
        endDate,
        difficulty: difficulty || 'Beginner',
        instructions: instructions || [],
        tips: tips || [],
        imageUrl,
        createdBy: req.user.email,
        createdById: req.user.uid,
        creatorName: req.user.name || req.user.email.split('@')[0],
        impactMetric: 'points' // Default metric
      };

      const newChallenge = await challengeDb.create(challengeData);

      res.status(201).json({
        success: true,
        data: { challenge: newChallenge },
        message: 'Challenge created successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update challenge
   * PATCH /api/challenges/:id
   */
  async updateChallenge(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated
      delete updateData._id;
      delete updateData.participants;
      delete updateData.createdAt;
      delete updateData.createdBy;

      const updatedChallenge = await challengeDb.update(id, updateData);
      
      if (!updatedChallenge) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Challenge not found',
            code: 'CHALLENGE_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: { challenge: updatedChallenge },
        message: 'Challenge updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete challenge
   * DELETE /api/challenges/:id
   */
  async deleteChallenge(req, res, next) {
    try {
      const { id } = req.params;
      
      const deleted = await challengeDb.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Challenge not found',
            code: 'CHALLENGE_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Challenge deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Join a challenge
   * POST /api/challenges/join/:id
   */
  async joinChallenge(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      try {
        const userChallenge = await challengeDb.join(id, userId);
        
        res.status(200).json({
          success: true,
          data: { userChallenge },
          message: 'Successfully joined challenge'
        });

      } catch (joinError) {
        return res.status(400).json({
          success: false,
          error: {
            message: joinError.message,
            code: 'JOIN_ERROR'
          }
        });
      }

    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave a challenge
   * POST /api/challenges/leave/:id
   */
  async leaveChallenge(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      // For now, we'll just return success
      // In real implementation, this would remove from userChallenges and decrement participants
      
      res.status(200).json({
        success: true,
        message: 'Successfully left challenge'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update challenge progress
   * PATCH /api/challenges/:id/progress
   */
  async updateProgress(req, res, next) {
    try {
      const { id } = req.params;
      const { progress, notes } = req.body;
      const userId = req.user.uid;

      // Validate progress
      if (progress < 0 || progress > 100) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Progress must be between 0 and 100',
            code: 'INVALID_PROGRESS'
          }
        });
      }

      // For mock implementation, return success
      res.status(200).json({
        success: true,
        data: {
          userId,
          challengeId: id,
          progress,
          notes,
          updatedAt: new Date().toISOString()
        },
        message: 'Progress updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete a challenge
   * POST /api/challenges/:id/complete
   */
  async completeChallenge(req, res, next) {
    try {
      const { id } = req.params;
      const { impactAchieved, notes } = req.body;
      const userId = req.user.uid;

      const challenge = await challengeDb.findById(id);
      
      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Challenge not found',
            code: 'CHALLENGE_NOT_FOUND'
          }
        });
      }

      // For mock implementation, return success
      res.status(200).json({
        success: true,
        data: {
          userId,
          challengeId: id,
          completedAt: new Date().toISOString(),
          impactAchieved,
          notes,
          pointsEarned: 50 // Mock points calculation
        },
        message: 'Challenge completed successfully!'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get challenge participants
   * GET /api/challenges/:id/participants
   */
  async getChallengeParticipants(req, res, next) {
    try {
      const { id } = req.params;
      
      const challenge = await challengeDb.findById(id);
      
      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Challenge not found',
            code: 'CHALLENGE_NOT_FOUND'
          }
        });
      }

      // Mock participants data
      const participants = [
        {
          userId: 'user123',
          displayName: 'John Doe',
          photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          progress: 75,
          joinDate: '2024-11-01T10:00:00Z'
        },
        {
          userId: 'user456',
          displayName: 'Sarah Green',
          photoURL: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150',
          progress: 90,
          joinDate: '2024-11-02T14:30:00Z'
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          challengeId: id,
          participants,
          totalCount: challenge.participants
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChallengeController();