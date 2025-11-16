const { mongoose } = require('./mongoose');

const database = {
  async connect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DATABASE || 'ecotrack',
    });
    console.log('✅ Successfully connected to MongoDB via Mongoose');
    return mongoose.connection;
  },

  getDb() {
    return mongoose.connection;
  },

  isHealthy() {
    return mongoose.connection.readyState === 1;
  },
};

module.exports = database;