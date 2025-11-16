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
      const firebaseUid = req.user.uid;
      const userEmail = req.user.email;

      let user = await userDb.findByFirebaseUid(firebaseUid);

      // If user doesn't exist in our database, create them
      if (!user) {
        const newUserData = {
          firebaseUid,
          email: userEmail,
          displayName: req.user.email.split('@')[0], // Default display name
          photoURL: null,
          bio: '',
          location: '',
          preferences: {
            privacy: 'public',
            notifications: {
              email: true,
              push: true,
              challenges: true,
              tips: true,
              events: true
            }
          },
          role: 'user',
          joinedAt: new Date(),
          lastActive: new Date(),
          stats: {
            challengesJoined: 0,
            challengesCompleted: 0,
            totalImpactPoints: 0,
            eventsAttended: 0,
            tipsShared: 0,
            streak: 0
          }
        };

        user = await userDb.create(newUserData);
        console.log(`✅ New user created: ${firebaseUid}`);
      } else {
        // Update last active timestamp
        await userDb.update(firebaseUid, { lastActive: new Date() });
      }

      // Remove sensitive information
      const { firebaseUid: uid, ...userProfile } = user;

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
      const firebaseUid = req.user.uid;
      const updateData = req.body;

      // Remove fields that shouldn't be updated
      delete updateData._id;
      delete updateData.firebaseUid;
      delete updateData.email; // Email updates should be handled by Firebase Auth
      delete updateData.role;
      delete updateData.stats;
      delete updateData.joinedAt;

      // Add last active timestamp
      updateData.lastActive = new Date();

      const updatedUser = await userDb.update(firebaseUid, updateData);

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
      const { firebaseUid: uid, ...userProfile } = updatedUser;

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

      const user = await userDb.findByFirebaseUid(id);

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

      const user = await userDb.findByFirebaseUid(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      const { ObjectId } = require('mongodb');
      const database = require('../config/database');
      const db = database.getDb();

      // Fetch user's challenges from database
      const userChallengesData = await db.collection('userChallenges')
        .find({ userId: id })
        .toArray();

      // Get challenge details for each user challenge
      const challengeIds = userChallengesData.map(uc => uc.challengeId);
      const challenges = await db.collection('challenges')
        .find({ _id: { $in: challengeIds } })
        .toArray();

      // Map challenges with user data
      let userChallenges = userChallengesData.map(uc => {
        const challenge = challenges.find(c => c._id.toString() === uc.challengeId.toString());
        return {
          challengeId: uc.challengeId.toString(),
          challengeTitle: challenge ? challenge.title : 'Unknown Challenge',
          challengeCategory: challenge ? challenge.category : null,
          status: uc.status,
          progress: uc.progress,
          joinDate: uc.joinDate,
          completedDate: uc.completedDate,
          impactAchieved: uc.impactAchieved,
          notes: uc.notes
        };
      });

      // Filter by status if provided
      if (status && status !== 'all') {
        if (status === 'active') {
          userChallenges = userChallenges.filter(c => 
            c.status === 'Not Started' || c.status === 'Ongoing'
          );
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

      const user = await userDb.findByFirebaseUid(id);

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

  /**
   * Get current user's activities (joined challenges)
   * GET /api/users/my-activities
   * Protected route - requires authentication
   */
  async getMyActivities(req, res, next) {
    try {
      const firebaseUid = req.user.uid;
      const { page = 1, limit = 20, status } = req.query;

      // Verify user exists
      const user = await userDb.findByFirebaseUid(firebaseUid);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      const { ObjectId } = require('mongodb');
      const database = require('../config/database');
      const db = database.getDb();

      // Fetch user's joined challenges from userChallenges collection
      let query = { userId: firebaseUid };
      
      // Filter by status if provided
      if (status) {
        if (status === 'active') {
          query.status = { $in: ['Not Started', 'Ongoing'] };
        } else if (status === 'completed') {
          query.status = 'Finished';
        }
      }

      const userChallengesData = await db.collection('userChallenges')
        .find(query)
        .sort({ joinDate: -1 })
        .toArray();

      // Get challenge details for each user challenge
      const challengeIds = userChallengesData.map(uc => uc.challengeId);
      const challenges = await db.collection('challenges')
        .find({ _id: { $in: challengeIds } })
        .toArray();

      // Map challenges with user data
      const joinedChallenges = userChallengesData.map(uc => {
        const challenge = challenges.find(c => c._id.toString() === uc.challengeId.toString());
        
        if (!challenge) {
          return null;
        }

        return {
          _id: uc._id,
          challenge: {
            _id: challenge._id,
            title: challenge.title,
            category: challenge.category,
            description: challenge.description,
            difficulty: challenge.difficulty,
            duration: challenge.duration,
            startDate: challenge.startDate,
            endDate: challenge.endDate,
            imageUrl: challenge.imageUrl,
            impactMetric: challenge.impactMetric
          },
          userProgress: {
            status: uc.status,
            progress: uc.progress || 0,
            joinDate: uc.joinDate,
            completedDate: uc.completedDate,
            impactAchieved: uc.impactAchieved,
            notes: uc.notes
          }
        };
      }).filter(item => item !== null);

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedActivities = joinedChallenges.slice(startIndex, endIndex);

      const totalActivities = joinedChallenges.length;
      const totalPages = Math.ceil(totalActivities / parseInt(limit));

      // Calculate summary stats
      const activeChallenges = joinedChallenges.filter(c => 
        c.userProgress.status === 'Not Started' || c.userProgress.status === 'Ongoing'
      ).length;
      const completedChallenges = joinedChallenges.filter(c => 
        c.userProgress.status === 'Finished'
      ).length;

      res.status(200).json({
        success: true,
        data: {
          activities: paginatedActivities,
          summary: {
            total: totalActivities,
            active: activeChallenges,
            completed: completedChallenges
          }
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
   * Delete current user's account and related data
   * DELETE /api/users/profile
   */
  async deleteMyAccount(req, res, next) {
    try {
      const firebaseUid = req.user.uid;

      const { userDb } = require('../models/userModel');
      const TipModel = require('../models/tipModel');
      const { deleteChallenge, leaveChallenge, getMyChallenges, getMyJoinedChallenges } = require('../models/challengeModel');
      const { getMyEvents, getMyJoinedEvents, leaveEvent, deleteEvent } = require('../models/eventModel');
      const database = require('../config/database');
      const db = database.getDb();
      const { deleteUser } = require('../config/firebase');

      // Delete tips authored by user
      const Tip = await TipModel.getCollection();
      await Tip.deleteMany({ authorId: firebaseUid });

      // Handle challenges created by user
      const myChallenges = await getMyChallenges(firebaseUid);
      for (const challenge of myChallenges) {
        await deleteChallenge(challenge.id, firebaseUid);
      }

      // Leave challenges the user joined
      const joinedChallenges = await getMyJoinedChallenges(firebaseUid, { includeCompleted: true, status: 'joined' });
      for (const challenge of joinedChallenges) {
        await leaveChallenge(challenge.id, firebaseUid);
      }

      // Handle events created by user (cancel or delete via model logic)
      const myEvents = await getMyEvents(firebaseUid);
      if (myEvents && Array.isArray(myEvents.events)) {
        for (const event of myEvents.events) {
          await deleteEvent(event.id, firebaseUid);
        }
      }

      // Leave events the user joined
      const joinedEvents = await getMyJoinedEvents(firebaseUid, 'all');
      if (joinedEvents && Array.isArray(joinedEvents.events)) {
        for (const event of joinedEvents.events) {
          await leaveEvent(event.id, firebaseUid);
        }
      }

      // Clean up userChallenges documents for this user
      await db.collection('userChallenges').deleteMany({ userId: firebaseUid });

      // Delete user document
      const deleted = await userDb.delete(firebaseUid);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Delete Firebase Auth user
      try {
        await deleteUser(firebaseUid);
      } catch (err) {
        console.error('Error deleting Firebase Auth user:', err.message || err);
      }

      res.status(200).json({
        success: true,
        message: 'Account and related data deleted successfully'
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