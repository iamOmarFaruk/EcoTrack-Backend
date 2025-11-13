/**
 * MongoDB Database Configuration
 * Using native MongoDB driver for EcoTrack Backend
 */

const { MongoClient } = require('mongodb');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      const uri = process.env.MONGODB_URI;
      
      if (!uri) {
        throw new Error('MONGODB_URI environment variable is not defined');
      }

      // Create MongoDB client with recommended settings
      this.client = new MongoClient(uri, {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      });

      // Connect to the MongoDB cluster
      await this.client.connect();
      
      // Select the database (will be created if doesn't exist)
      const dbName = process.env.MONGODB_DATABASE || 'ecotrack';
      this.db = this.client.db(dbName);
      
      this.isConnected = true;
      
      console.log('✅ Successfully connected to MongoDB Atlas');
      
      // Test the connection
      await this.db.admin().ping();
      console.log('✅ Database ping successful');

      // Create indexes for better performance
      await this.createIndexes();
      
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      throw error;
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  async createIndexes() {
    try {
      // Challenges collection indexes
      await this.db.collection('challenges').createIndex({ category: 1, isActive: 1 });
      await this.db.collection('challenges').createIndex({ startDate: 1, endDate: 1 });
      await this.db.collection('challenges').createIndex({ createdAt: -1 });

      // User challenges collection indexes
      await this.db.collection('userChallenges').createIndex({ userId: 1, status: 1 });
      await this.db.collection('userChallenges').createIndex({ challengeId: 1 });
      await this.db.collection('userChallenges').createIndex({ userId: 1, challengeId: 1 }, { unique: true });

      // Tips collection indexes
      await this.db.collection('tips').createIndex({ category: 1, createdAt: -1 });
      await this.db.collection('tips').createIndex({ author: 1 });
      await this.db.collection('tips').createIndex({ isVerified: 1 });

      // Events collection indexes
      await this.db.collection('events').createIndex({ date: 1, status: 1 });
      await this.db.collection('events').createIndex({ 'location.city': 1, 'location.state': 1 });
      await this.db.collection('events').createIndex({ organizer: 1 });

      // Users collection indexes
      await this.db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true });
      await this.db.collection('users').createIndex({ email: 1 }, { unique: true });
      await this.db.collection('users').createIndex({ isActive: 1 });

      // Activities collection indexes
      await this.db.collection('activities').createIndex({ userId: 1, createdAt: -1 });
      await this.db.collection('activities').createIndex({ activityType: 1, createdAt: -1 });
      await this.db.collection('activities').createIndex({ isPublic: 1, createdAt: -1 });

      // Community stats collection indexes
      await this.db.collection('communityStats').createIndex({ type: 1, period: 1 }, { unique: true });

      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.warn('⚠️ Some indexes may already exist:', error.message);
    }
  }

  /**
   * Get database instance
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get MongoDB client instance
   */
  getClient() {
    if (!this.client) {
      throw new Error('Database client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if database is connected
   */
  isHealthy() {
    return this.isConnected && this.client && this.db;
  }

  /**
   * Close database connection
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        this.client = null;
        this.db = null;
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing database connection:', error.message);
    }
  }

  /**
   * Start a database transaction session
   */
  startSession() {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }
    return this.client.startSession();
  }
}

// Create singleton instance
const database = new Database();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🔄 Received SIGINT. Gracefully shutting down...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM. Gracefully shutting down...');
  await database.disconnect();
  process.exit(0);
});

module.exports = database;