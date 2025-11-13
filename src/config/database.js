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

      // Create MongoDB client
      const clientOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
        readPreference: 'primaryPreferred',
        connectTimeoutMS: 15000,
        maxIdleTimeMS: 30000,
      };

      // Add TLS options for Atlas connections
      if (uri.includes('mongodb+srv://')) {
        clientOptions.tls = true;
        clientOptions.tlsAllowInvalidCertificates = false;
      }

      this.client = new MongoClient(uri, clientOptions);

      // Connect to the MongoDB cluster
      await this.client.connect();
      
      // Select the database
      const dbName = process.env.MONGODB_DATABASE || 'ecotrack';
      this.db = this.client.db(dbName);
      
      this.isConnected = true;
      
      console.log('✅ Successfully connected to MongoDB');
      
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
      // Create essential indexes
      await this.db.collection('challenges').createIndex({ category: 1, isActive: 1 });
      await this.db.collection('tips').createIndex({ category: 1, createdAt: -1 });
      await this.db.collection('events').createIndex({ date: 1, status: 1 });
      await this.db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true });
      
      console.log('✅ Database indexes created');
    } catch (error) {
      console.warn('⚠️ Index creation warning:', error.message);
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