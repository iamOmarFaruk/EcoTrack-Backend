require('dotenv').config();
const database = require('../src/config/database');

async function initializeEventIndexes() {
  try {
    console.log('🔄 Connecting to database...');
    await database.connect();
    
    const db = database.getDb();
    const eventsCollection = db.collection('events');
    
    console.log('🔄 Creating indexes for events collection...');
    
    await eventsCollection.createIndex({ id: 1 }, { unique: true });
    console.log('✅ Created unique index on id');
    
    await eventsCollection.createIndex({ createdBy: 1 });
    console.log('✅ Created index on createdBy');
    
    await eventsCollection.createIndex({ date: 1 });
    console.log('✅ Created index on date');
    
    await eventsCollection.createIndex({ status: 1 });
    console.log('✅ Created index on status');
    
    await eventsCollection.createIndex({ status: 1, date: 1 });
    console.log('✅ Created compound index on status and date');
    
    await eventsCollection.createIndex({ 'participants.userId': 1 });
    console.log('✅ Created index on participants.userId');
    
    await eventsCollection.createIndex({ 
      title: 'text', 
      location: 'text', 
      organizer: 'text' 
    });
    console.log('✅ Created text index on title, location, and organizer');
    
    console.log('✅ All event indexes created successfully!');
    
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    await database.disconnect();
    process.exit(1);
  }
}

initializeEventIndexes();
