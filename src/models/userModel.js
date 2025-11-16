const { mongoose } = require('../config/mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String, required: true },
  photoURL: { type: String, default: null },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  preferences: {
    privacy: { type: String, default: 'public' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      challenges: { type: Boolean, default: true },
      tips: { type: Boolean, default: true },
      events: { type: Boolean, default: true },
    },
  },
  role: { type: String, default: 'user' },
  joinedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  stats: {
    challengesJoined: { type: Number, default: 0 },
    challengesCompleted: { type: Number, default: 0 },
    eventsAttended: { type: Number, default: 0 },
    tipsShared: { type: Number, default: 0 },
    totalImpactPoints: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const userDb = {
  async findByFirebaseUid(firebaseUid) {
    return User.findOne({ firebaseUid }).lean();
  },

  async findById(id) {
    return User.findById(id).lean();
  },

  async create(userData) {
    const user = await User.create(userData);
    return user.toObject();
  },

  async update(firebaseUid, updateData) {
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { ...updateData, lastActive: new Date() },
      { new: true }
    ).lean();
    return user;
  },

  async findAll(limit = 50, skip = 0) {
    return User.find({}, { firebaseUid: 0 }).limit(limit).skip(skip).lean();
  },

  async updateStats(firebaseUid, statUpdates) {
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $inc: statUpdates, lastActive: new Date() },
      { new: true }
    ).lean();
    return user;
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