/**
 * Challenge Model - MongoDB Operations
 * Handles all challenge-related database operations
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');

// MongoDB Challenge Operations
const challengeDb = {
  // Get all challenges with optional filtering
  async findAll(filters = {}) {
    try {
      const db = database.getDb();
      let query = {};
      
      if (filters.category) {
        query.category = new RegExp(filters.category, 'i');
      }
      
      if (filters.status) {
        const now = new Date();
        if (filters.status === 'active') {
          query.endDate = { $gt: now };
          query.isActive = true;
        } else if (filters.status === 'completed') {
          query.endDate = { $lte: now };
        }
      }
      
      if (filters.search) {
        query.$or = [
          { title: new RegExp(filters.search, 'i') },
          { description: new RegExp(filters.search, 'i') }
        ];
      }
      
      return await db.collection('challenges')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
    } catch (error) {
      throw new Error(`Error finding challenges: ${error.message}`);
    }
  },

  // Find challenge by ID
  async findById(id) {
    try {
      const db = database.getDb();
      return await db.collection('challenges').findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new Error(`Error finding challenge: ${error.message}`);
    }
  },

  // Create new challenge
  async create(challengeData) {
    try {
      const db = database.getDb();
      const newChallenge = {
        ...challengeData,
        participants: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      
      const result = await db.collection('challenges').insertOne(newChallenge);
      return { ...newChallenge, _id: result.insertedId };
    } catch (error) {
      throw new Error(`Error creating challenge: ${error.message}`);
    }
  },

  // Update challenge  
  async update(id, updateData) {
    try {
      const db = database.getDb();
      const result = await db.collection('challenges').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updateData, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      throw new Error(`Error updating challenge: ${error.message}`);
    }
  },

  // Delete challenge
  async delete(id) {
    try {
      const db = database.getDb();
      await db.collection('challenges').deleteOne({ _id: new ObjectId(id) });
      await db.collection('userChallenges').deleteMany({ challengeId: new ObjectId(id) });
      return true;
    } catch (error) {
      throw new Error(`Error deleting challenge: ${error.message}`);
    }
  },

  // Join challenge
  async join(challengeId, userId) {
    try {
      const db = database.getDb();
      
      // Check if already joined
      const existing = await db.collection('userChallenges').findOne({
        challengeId: new ObjectId(challengeId), userId
      });
      
      if (existing) throw new Error('Already joined this challenge');

      // Create user challenge record
      const userChallenge = {
        userId,
        challengeId: new ObjectId(challengeId),
        status: 'Not Started',
        progress: 0,
        joinDate: new Date(),
        completedDate: null,
        impactAchieved: 0,
        notes: '',
        dailyLogs: []
      };
      
      await db.collection('userChallenges').insertOne(userChallenge);
      
      // Increment participants count
      await db.collection('challenges').updateOne(
        { _id: new ObjectId(challengeId) },
        { $inc: { participants: 1 }, $set: { updatedAt: new Date() } }
      );

      return userChallenge;
    } catch (error) {
      throw new Error(`Error joining challenge: ${error.message}`);
    }
  },


};

module.exports = {
  challengeDb
};