const { userDb } = require('../models/userModel');

/**
 * User Controller
 * Handles all user-related operations
 */
class UserController {

  /**
   * Get current user profile
   * GET /api/users/profile
   */
  async getCurrentUserProfile(req, res, next) {
    try {
      const userId = req.user?.uid || 'user123'; // Will use auth later

      const user = await userDb.findByFirebaseUid(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Remove sensitive information
      const { firebaseUid, ...userProfile } = user;

      res.status(200).json({
        success: true,
        data: { user: userProfile }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user profile
   * PATCH /api/users/profile
   */
  async updateUserProfile(req, res, next) {
    try {
      const userId = req.user?.uid || 'user123'; // Will use auth later
      const updateData = req.body;

      // Remove fields that shouldn't be updated
      delete updateData._id;
      delete updateData.firebaseUid;
      delete updateData.email; // Email updates should be handled by Firebase Auth
      delete updateData.role;
      delete updateData.stats;
      delete updateData.joinedAt;

      const updatedUser = await userDb.update(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Remove sensitive information
      const { firebaseUid, ...userProfile } = updatedUser;

      res.status(200).json({
        success: true,
        data: { user: userProfile },
        message: 'Profile updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get public user profile by ID
   * GET /api/users/:id
   */
  async getPublicUserProfile(req, res, next) {
    try {
      const { id } = req.params;

      const user = userMockDb.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Return only public information
      const publicProfile = {
        _id: user._id,
        displayName: user.displayName,
        photoURL: user.photoURL,
        bio: user.bio,
        location: user.location,
        joinedAt: user.joinedAt,
        stats: user.stats
      };

      // Only show full profile if privacy is public
      if (user.preferences.privacy === 'private') {
        publicProfile.bio = null;
        publicProfile.location = null;
        publicProfile.stats = {
          challengesJoined: user.stats.challengesJoined,
          challengesCompleted: user.stats.challengesCompleted
        };
      }

      res.status(200).json({
        success: true,
        data: { user: publicProfile }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's public activities
   * GET /api/users/:id/activities
   */
  async getUserActivities(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const user = userMockDb.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Mock activities data
      const activities = [
        {
          _id: 'act1',
          activityType: 'challenge_joined',
          relatedId: '674b1a2f8e4d5c1a2b3c4d5e',
          metadata: {
            challengeTitle: 'Plastic-Free July Challenge',
            impactValue: 25
          },
          createdAt: '2024-11-01T10:00:00Z'
        },
        {
          _id: 'act2',
          activityType: 'tip_shared',
          relatedId: '674b1a2f8e4d5c1a2b3c4d70',
          metadata: {
            tipTitle: 'How to Start Composting at Home'
          },
          createdAt: '2024-10-28T14:30:00Z'
        }
      ];

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedActivities = activities.slice(startIndex, endIndex);

      const totalActivities = activities.length;
      const totalPages = Math.ceil(totalActivities / parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          activities: paginatedActivities,
          userId: id
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalActivities,
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
   * Get user's challenges
   * GET /api/users/:id/challenges
   */
  async getUserChallenges(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.query; // 'active', 'completed', 'all'

      const user = userMockDb.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Mock user challenges data
      let userChallenges = [
        {
          challengeId: '674b1a2f8e4d5c1a2b3c4d5e',
          challengeTitle: 'Plastic-Free July Challenge',
          status: 'Ongoing',
          progress: 65,
          joinDate: '2024-11-01T10:00:00Z',
          impactAchieved: 12.5
        },
        {
          challengeId: '674b1a2f8e4d5c1a2b3c4d5f',
          challengeTitle: 'Energy Conservation Challenge',
          status: 'Finished',
          progress: 100,
          joinDate: '2024-09-01T10:00:00Z',
          completedDate: '2024-09-30T18:00:00Z',
          impactAchieved: 45.2
        }
      ];

      // Filter by status if provided
      if (status && status !== 'all') {
        if (status === 'active') {
          userChallenges = userChallenges.filter(c => c.status === 'Ongoing');
        } else if (status === 'completed') {
          userChallenges = userChallenges.filter(c => c.status === 'Finished');
        }
      }

      res.status(200).json({
        success: true,
        data: {
          challenges: userChallenges,
          userId: id,
          totalChallenges: userChallenges.length
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user statistics
   * GET /api/users/:id/stats
   */
  async getUserStats(req, res, next) {
    try {
      const { id } = req.params;

      const user = userMockDb.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Calculate additional stats
      const enhancedStats = {
        ...user.stats,
        completionRate: user.stats.challengesJoined > 0 
          ? Math.round((user.stats.challengesCompleted / user.stats.challengesJoined) * 100) 
          : 0,
        rank: calculateUserRank(user.stats.totalImpactPoints),
        badges: calculateBadges(user.stats),
        memberSince: user.joinedAt,
        lastActive: user.lastActive
      };

      res.status(200).json({
        success: true,
        data: {
          stats: enhancedStats,
          userId: id
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

// Helper functions
function calculateUserRank(impactPoints) {
  if (impactPoints >= 500) return 'Champion';
  if (impactPoints >= 300) return 'Expert';
  if (impactPoints >= 150) return 'Enthusiast';
  if (impactPoints >= 50) return 'Beginner';
  return 'Newcomer';
}

function calculateBadges(stats) {
  const badges = [];
  
  if (stats.challengesCompleted >= 10) badges.push('Challenge Master');
  if (stats.challengesCompleted >= 5) badges.push('Committed');
  if (stats.challengesCompleted >= 1) badges.push('First Steps');
  
  if (stats.eventsAttended >= 5) badges.push('Community Leader');
  if (stats.eventsAttended >= 1) badges.push('Team Player');
  
  if (stats.tipsShared >= 10) badges.push('Knowledge Sharer');
  if (stats.tipsShared >= 5) badges.push('Helper');
  
  return badges;
}

module.exports = new UserController();