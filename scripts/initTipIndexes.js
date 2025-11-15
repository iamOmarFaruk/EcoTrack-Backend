/**
 * Initialize Tips Collection Indexes
 * Run this script once to create all necessary indexes for optimal performance
 * 
 * Usage: node scripts/initTipIndexes.js
 */

require('dotenv').config();
const TipModel = require('../src/models/tipModel');
const database = require('../src/config/database');

async function initializeTipIndexes() {
  try {
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✅ Database connected');

    console.log('\n📊 Creating indexes for tips collection...');
    await TipModel.createIndexes();
    console.log('✅ All indexes created successfully');

    console.log('\n✨ Tips collection is ready for production use!');
    console.log('\nIndexes created:');
    console.log('  - id (unique)');
    console.log('  - authorId');
    console.log('  - createdAt (descending)');
    console.log('  - upvoteCount (descending)');
    console.log('  - upvotes.userId');
    console.log('  - text index on title and content');

  } catch (error) {
    console.error('❌ Error initializing tip indexes:', error);
    process.exit(1);
  } finally {
    console.log('\n🔌 Closing database connection...');
    await database.disconnect();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the script
initializeTipIndexes();
