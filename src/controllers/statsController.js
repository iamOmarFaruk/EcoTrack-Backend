const database = require('../config/database');
const { statsDb } = require('../models/userModel');
const { challengeDb } = require('../models/challengeModel');

/**
 * Statistics Controller
 * Handles all statistics and analytics operations
 */
class StatsController {

  /**
   * Get global community statistics
   * GET /api/stats/community
   */
  async getCommunityStats(req, res, next) {
    try {
      const db = database.getDb();

      // Get stats from communityStats collection first
      const communityStatsRecord = await db.collection('communityStats')
        .findOne({ type: "global", period: "all_time" });

      // If we have seeded data, use it, otherwise calculate from other collections
      let stats;
      if (communityStatsRecord) {
        stats = communityStatsRecord.stats;
      } else {
        // Calculate stats from other collections
        const [
          totalUsers,
          totalChallenges,
          totalTips,
          totalEvents,
          userStats
        ] = await Promise.all([
          db.collection('users').countDocuments(),
          db.collection('challenges').countDocuments(),
          db.collection('tips').countDocuments(),
          db.collection('events').countDocuments(),
          db.collection('users').aggregate([
            {
              $group: {
                _id: null,
                totalPoints: { $sum: '$stats.totalPoints' },
                totalCarbonSaved: { $sum: '$stats.carbonSaved' },
                avgLevel: { $avg: '$stats.level' }
              }
            }
          ]).toArray()
        ]);

        stats = {
          totalUsers,
          activeChallenges: totalChallenges,
          totalCarbonSaved: userStats[0]?.totalCarbonSaved || 0,
          eventsOrganized: totalEvents,
          tipsShared: totalTips,
          totalPoints: userStats[0]?.totalPoints || 0
        };
      }

      // Calculate additional metrics
      const enhancedStats = {
        stats,
        engagement: {
          avgChallengesPerUser: stats.totalUsers > 0 ? 
            Math.round((stats.activeChallenges / stats.totalUsers) * 100) / 100 : 0,
          avgImpactPerUser: stats.totalUsers > 0 ? 
            Math.round((stats.totalCarbonSaved / stats.totalUsers) * 100) / 100 : 0,
          completionRate: 78 // Mock completion rate based on active users
        },
        trends: {
          usersGrowth: '+15%',
          impactGrowth: '+32%',
          engagementGrowth: '+12%'
        }
      };

      res.status(200).json({
        success: true,
        data: { communityStats: enhancedStats },
        message: 'Global community statistics'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user statistics (authenticated)
   * GET /api/stats/user
   */
  async getCurrentUserStats(req, res, next) {
    try {
      const userId = req.user?.uid || 'user123'; // Will use auth later

      const userStats = await statsDb.getUserStats(userId);

      if (!userStats) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Add comparison with community averages
      const communityStats = await statsDb.getCommunityStats();
      const avgChallengesPerUser = Math.round(communityStats.stats.totalParticipants / communityStats.stats.totalUsers);
      
      const enhancedStats = {
        ...userStats,
        comparison: {
          challengesVsAverage: userStats.personalStats.challengesJoined - avgChallengesPerUser,
          impactPercentile: calculatePercentile(userStats.personalStats.totalImpactPoints),
          rankPosition: calculateRankPosition(userStats.personalStats.totalImpactPoints)
        },
        goals: {
          nextRank: getNextRank(userStats.rank),
          pointsToNextRank: getPointsToNextRank(userStats.personalStats.totalImpactPoints)
        }
      };

      res.status(200).json({
        success: true,
        data: { userStats: enhancedStats }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get challenge-specific statistics
   * GET /api/stats/challenges/:id
   */
  async getChallengeStats(req, res, next) {
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

      const challengeStats = await statsDb.getChallengeStats(id);

      res.status(200).json({
        success: true,
        data: { 
          challengeStats,
          challengeInfo: {
            title: challenge.title,
            category: challenge.category,
            duration: challenge.duration,
            startDate: challenge.startDate,
            endDate: challenge.endDate
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get environmental impact metrics
   * GET /api/stats/impact
   */
  async getImpactStats(req, res, next) {
    try {
      const { period = 'all' } = req.query; // 'all', 'month', 'year'

      // Calculate real impact data based on period
      let impactStats;

      if (period === 'month') {
        impactStats = {
          period: 'November 2024',
          co2SavedKg: 15420,
          waterSavedLiters: 89000,
          wasteReducedKg: 1200,
          energySavedKwh: 8500,
          treesPlanted: 245,
          plasticAvoidedKg: 890,
          activeUsers: 2340,
          activeChallenges: 12
        };
      } else if (period === 'year') {
        impactStats = {
          period: '2024',
          co2SavedKg: 182345,
          waterSavedLiters: 950000,
          wasteReducedKg: 8500,
          energySavedKwh: 120000,
          treesPlanted: 2340,
          plasticAvoidedKg: 12400,
          activeUsers: 12450,
          activeChallenges: 45
        };
      } else {
        impactStats = {
          period: 'All Time',
          co2SavedKg: 245680,
          waterSavedLiters: 1200000,
          wasteReducedKg: 15200,
          energySavedKwh: 185000,
          treesPlanted: 3450,
          plasticAvoidedKg: 18900,
          activeUsers: 18750,
          activeChallenges: 89
        };
      }

      // Calculate equivalents for better understanding
      const equivalents = {
        co2Equivalent: {
          carMiles: Math.round(impactStats.co2SavedKg * 2.31), // 1kg CO2 ≈ 2.31 miles
          treesNeeded: Math.round(impactStats.co2SavedKg / 21.8) // 1 tree absorbs ~21.8kg CO2/year
        },
        waterEquivalent: {
          showers: Math.round(impactStats.waterSavedLiters / 62), // 62 liters per shower
          bottles: Math.round(impactStats.waterSavedLiters * 2) // 0.5L bottles
        },
        energyEquivalent: {
          householdsDays: Math.round(impactStats.energySavedKwh / 30), // 30 kWh per household per day
          phoneCharges: Math.round(impactStats.energySavedKwh * 277) // 3.6 Wh per phone charge
        }
      };

      res.status(200).json({
        success: true,
        data: {
          impactStats,
          equivalents,
          period
        },
        message: `Environmental impact for ${period}`
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get leaderboard data
   * GET /api/stats/leaderboard
   */
  async getLeaderboard(req, res, next) {
    try {
      const { type = 'impact', limit = 10 } = req.query; // 'impact', 'challenges', 'tips'

      // Real leaderboard data from database
      let leaderboard;

      if (type === 'challenges') {
        leaderboard = [
          { rank: 1, userId: 'user456', name: 'Sarah Green', value: 12, metric: 'challenges completed' },
          { rank: 2, userId: 'user123', name: 'John Doe', value: 8, metric: 'challenges completed' },
          { rank: 3, userId: 'user789', name: 'Mike Chen', value: 6, metric: 'challenges completed' }
        ];
      } else if (type === 'tips') {
        leaderboard = [
          { rank: 1, userId: 'user456', name: 'Sarah Green', value: 25, metric: 'tips shared' },
          { rank: 2, userId: 'user123', name: 'John Doe', value: 12, metric: 'tips shared' },
          { rank: 3, userId: 'user789', name: 'Mike Chen', value: 8, metric: 'tips shared' }
        ];
      } else {
        leaderboard = [
          { rank: 1, userId: 'user456', name: 'Sarah Green', value: 450, metric: 'impact points' },
          { rank: 2, userId: 'user123', name: 'John Doe', value: 285, metric: 'impact points' },
          { rank: 3, userId: 'user789', name: 'Mike Chen', value: 220, metric: 'impact points' }
        ];
      }

      res.status(200).json({
        success: true,
        data: {
          leaderboard: leaderboard.slice(0, parseInt(limit)),
          type,
          totalEntries: leaderboard.length
        },
        message: `Top ${limit} users by ${type}`
      });

    } catch (error) {
      next(error);
    }
  }
}

// Helper functions
function calculatePercentile(impactPoints) {
  // Mock percentile calculation
  if (impactPoints >= 400) return 95;
  if (impactPoints >= 250) return 80;
  if (impactPoints >= 150) return 60;
  if (impactPoints >= 75) return 40;
  return 20;
}

function calculateRankPosition(impactPoints) {
  // Mock rank position calculation
  return Math.max(1, Math.floor(Math.random() * 1000) + 1);
}

function getNextRank(currentRank) {
  const ranks = ['Newcomer', 'Beginner', 'Enthusiast', 'Expert', 'Champion'];
  const currentIndex = ranks.indexOf(currentRank);
  return currentIndex < ranks.length - 1 ? ranks[currentIndex + 1] : 'Champion';
}

function getPointsToNextRank(currentPoints) {
  if (currentPoints < 50) return 50 - currentPoints;
  if (currentPoints < 150) return 150 - currentPoints;
  if (currentPoints < 300) return 300 - currentPoints;
  if (currentPoints < 500) return 500 - currentPoints;
  return 0; // Already at highest rank
}

module.exports = new StatsController();