/**
 * Database Verification Script
 * Verifies database connection and displays seeded data
 */

require('dotenv').config();
const database = require('../config/database');

/**
 * Verify database connection and show collections data
 */
async function verifyDatabase() {
  try {
    console.log('🔍 Verifying database connection and data...');
    
    // Connect to database
    const db = await database.connect();
    console.log('✅ Connected to database successfully');

    // Get all collections
    const collections = ['challenges', 'tips', 'events', 'users', 'activities', 'communityStats', 'userChallenges'];
    
    console.log('\n📊 Database Collections Summary:');
    console.log('==========================================');

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        const sample = await collection.findOne();
        
        console.log(`\n${collectionName.toUpperCase()}:`);
        console.log(`  📈 Total documents: ${count}`);
        
        if (sample) {
          if (collectionName === 'challenges') {
            console.log(`  📝 Sample: "${sample.title}" (${sample.category})`);
          } else if (collectionName === 'tips') {
            console.log(`  💡 Sample: "${sample.title}" by ${sample.author}`);
          } else if (collectionName === 'events') {
            console.log(`  🎪 Sample: "${sample.title}" in ${sample.location.city}`);
          } else if (collectionName === 'users') {
            console.log(`  👤 Sample: ${sample.profile.firstName} ${sample.profile.lastName} (${sample.email})`);
          } else if (collectionName === 'activities') {
            console.log(`  🚀 Sample: ${sample.activityType} - "${sample.title}"`);
          } else if (collectionName === 'communityStats') {
            console.log(`  📊 Sample: ${sample.type} stats for ${sample.period}`);
          } else if (collectionName === 'userChallenges') {
            console.log(`  🎯 Sample: User challenge with ${sample.progress}% progress`);
          }
        } else {
          console.log('  ⚠️ No sample data found');
        }
      } catch (error) {
        console.log(`  ❌ Error accessing ${collectionName}: ${error.message}`);
      }
    }

    // Test some specific queries
    console.log('\n🧪 Testing Sample Queries:');
    console.log('==========================================');

    // Test active challenges
    const activeChallenges = await db.collection('challenges').find({ isActive: true }).toArray();
    console.log(`\n🎯 Active Challenges: ${activeChallenges.length}`);
    activeChallenges.forEach((challenge, index) => {
      console.log(`  ${index + 1}. ${challenge.title} (${challenge.duration})`);
    });

    // Test verified tips
    const verifiedTips = await db.collection('tips').find({ isVerified: true }).toArray();
    console.log(`\n💡 Verified Tips: ${verifiedTips.length}`);
    verifiedTips.forEach((tip, index) => {
      console.log(`  ${index + 1}. ${tip.title} - ${tip.likes} likes`);
    });

    // Test upcoming events
    const upcomingEvents = await db.collection('events').find({ status: 'upcoming' }).toArray();
    console.log(`\n🎪 Upcoming Events: ${upcomingEvents.length}`);
    upcomingEvents.forEach((event, index) => {
      const eventDate = new Date(event.date).toDateString();
      console.log(`  ${index + 1}. ${event.title} - ${eventDate}`);
    });

    // Test user stats
    const userStats = await db.collection('users').aggregate([
      {
        $group: {
          _id: null,
          totalPoints: { $sum: '$stats.totalPoints' },
          totalCarbonSaved: { $sum: '$stats.carbonSaved' },
          averageLevel: { $avg: '$stats.level' }
        }
      }
    ]).toArray();

    if (userStats.length > 0) {
      console.log(`\n👥 Community Overview:`);
      console.log(`  🏆 Total Points Earned: ${userStats[0].totalPoints}`);
      console.log(`  🌱 Total Carbon Saved: ${userStats[0].totalCarbonSaved.toFixed(2)} kg`);
      console.log(`  📊 Average User Level: ${userStats[0].averageLevel.toFixed(1)}`);
    }

    console.log('\n✅ Database verification completed successfully!');
    console.log('\n🚀 Your EcoTrack database is ready to use!');

  } catch (error) {
    console.error('❌ Error verifying database:', error);
    throw error;
  } finally {
    await database.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

/**
 * Run the verification script
 */
if (require.main === module) {
  verifyDatabase()
    .then(() => {
      console.log('✅ Verification completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyDatabase };