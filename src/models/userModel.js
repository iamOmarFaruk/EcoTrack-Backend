/**
 * User Model - MongoDB Operations
 * Handles all user-related database operations
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');



// MongoDB User Operations
const userDb = {
  // Find user by Firebase UID
  async findByFirebaseUid(firebaseUid) {
    try {
      const db = database.getDb();
      return await db.collection('users').findOne({ firebaseUid });
    } catch (error) {
      throw new Error(`Error finding user by Firebase UID: ${error.message}`);
    }
  },

  // Find user by ID
  async findById(id) {
    try {
      const db = database.getDb();
      return await db.collection('users').findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  },

  // Create new user
  async create(userData) {
    try {
      const db = database.getDb();
      const newUser = {
        ...userData,
        joinedAt: new Date(),
        lastActive: new Date(),
        preferences: {
          notifications: true,
          newsletter: true,
          privacy: "public"
        },
        stats: {
          challengesJoined: 0,
          challengesCompleted: 0,
          eventsAttended: 0,
          tipsShared: 0,
          totalImpactPoints: 0
        },
        role: "user",
        isActive: true
      };
      
      const result = await db.collection('users').insertOne(newUser);
      return { ...newUser, _id: result.insertedId };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  },

  // Update user
  async update(firebaseUid, updateData) {
    try {
      const db = database.getDb();
      const result = await db.collection('users').findOneAndUpdate(
        { firebaseUid },
        { 
          $set: { 
            ...updateData, 
            lastActive: new Date() 
          } 
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  },

  // Get all users (admin only)
  async findAll(limit = 50, skip = 0) {
    try {
      const db = database.getDb();
      const users = await db.collection('users')
        .find({}, { projection: { firebaseUid: 0 } })
        .limit(limit)
        .skip(skip)
        .toArray();
      return users;
    } catch (error) {
      throw new Error(`Error finding all users: ${error.message}`);
    }
  },

  // Update user stats
  async updateStats(firebaseUid, statUpdates) {
    try {
      const db = database.getDb();
      const result = await db.collection('users').findOneAndUpdate(
        { firebaseUid },
        { 
          $inc: statUpdates,
          $set: { lastActive: new Date() }
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      throw new Error(`Error updating user stats: ${error.message}`);
    }
  },


};

// MongoDB Statistics Operations
const statsDb = {
  // Get community stats
  async getCommunityStats() {
    try {
      const db = database.getDb();
      return await db.collection('communityStats').findOne({ type: 'global' });
    } catch (error) {
      throw new Error(`Error getting community stats: ${error.message}`);
    }
  },

  // Get user stats
  async getUserStats(firebaseUid) {
    try {
      const user = await userDb.findByFirebaseUid(firebaseUid);
      if (!user) return null;

      return {
        personalStats: user.stats,
        joinDate: user.joinedAt,
        lastActive: user.lastActive,
        rank: calculateUserRank(user.stats.totalImpactPoints),
        badges: calculateBadges(user.stats)
      };
    } catch (error) {
      throw new Error(`Error getting user stats: ${error.message}`);
    }
  },

  // Get challenge stats
  async getChallengeStats(challengeId) {
    try {
      const db = database.getDb();
      
      // Aggregate challenge participation data
      const pipeline = [
        { $match: { challengeId: new ObjectId(challengeId) } },
        {
          $group: {
            _id: null,
            totalParticipants: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "Finished"] }, 1, 0] } },
            averageProgress: { $avg: "$progress" }
          }
        }
      ];
      
      const result = await db.collection('userChallenges').aggregate(pipeline).toArray();
      const stats = result[0] || { totalParticipants: 0, completed: 0, averageProgress: 0 };
      
      const completionRate = stats.totalParticipants > 0 
        ? Math.round((stats.completed / stats.totalParticipants) * 100) 
        : 0;

      return {
        challengeId,
        totalParticipants: stats.totalParticipants,
        completionRate,
        averageProgress: Math.round(stats.averageProgress || 0)
      };
    } catch (error) {
      throw new Error(`Error getting challenge stats: ${error.message}`);
    }
  },


};

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

module.exports = {
  userDb,
  statsDb
};