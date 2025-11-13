/**
 * Tip Model - MongoDB Operations
 * Handles all tip-related database operations
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');

// MongoDB Tip Operations
const tipDb = {
  // Get all tips with optional filtering
  async findAll(filters = {}) {
    try {
      const db = database.getDb();
      let query = {};
      
      if (filters.category) {
        query.category = new RegExp(filters.category, 'i');
      }
      
      if (filters.search) {
        query.$or = [
          { title: new RegExp(filters.search, 'i') },
          { content: new RegExp(filters.search, 'i') }
        ];
      }
      
      if (filters.author) {
        query.author = filters.author;
      }
      
      let sortOption = {};
      switch (filters.sort) {
        case 'newest':
          sortOption = { createdAt: -1 };
          break;
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        case 'popular':
          sortOption = { upvotes: -1 };
          break;
        default:
          sortOption = { createdAt: -1 };
      }
      
      return await db.collection('tips')
        .find(query)
        .sort(sortOption)
        .limit(filters.limit || 50)
        .skip(filters.skip || 0)
        .toArray();
    } catch (error) {
      throw new Error(`Error finding tips: ${error.message}`);
    }
  },

  // Find tip by ID
  async findById(id) {
    try {
      const db = database.getDb();
      return await db.collection('tips').findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new Error(`Error finding tip by ID: ${error.message}`);
    }
  },

  // Create new tip
  async create(tipData) {
    try {
      const db = database.getDb();
      const newTip = {
        ...tipData,
        upvotes: 0,
        downvotes: 0,
        votes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isVerified: false
      };
      
      const result = await db.collection('tips').insertOne(newTip);
      return { ...newTip, _id: result.insertedId };
    } catch (error) {
      throw new Error(`Error creating tip: ${error.message}`);
    }
  },

  // Update tip
  async update(id, updateData) {
    try {
      const db = database.getDb();
      const result = await db.collection('tips').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            ...updateData, 
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      throw new Error(`Error updating tip: ${error.message}`);
    }
  },

  // Delete tip
  async delete(id) {
    try {
      const db = database.getDb();
      const result = await db.collection('tips').deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting tip: ${error.message}`);
    }
  },

  // Vote on tip
  async vote(tipId, userId, voteType) {
    try {
      const db = database.getDb();
      
      // Remove any existing vote from this user
      await db.collection('tips').updateOne(
        { _id: new ObjectId(tipId) },
        { 
          $pull: { votes: { userId } },
          $set: { updatedAt: new Date() }
        }
      );
      
      // Add new vote and update counts
      const voteUpdate = {
        $push: { votes: { userId, voteType, votedAt: new Date() } },
        $set: { updatedAt: new Date() }
      };
      
      if (voteType === 'upvote') {
        voteUpdate.$inc = { upvotes: 1 };
      } else {
        voteUpdate.$inc = { downvotes: 1 };
      }
      
      const result = await db.collection('tips').findOneAndUpdate(
        { _id: new ObjectId(tipId) },
        voteUpdate,
        { returnDocument: 'after' }
      );
      
      return result.value;
    } catch (error) {
      throw new Error(`Error voting on tip: ${error.message}`);
    }
  },

  // Remove vote from tip
  async removeVote(tipId, userId) {
    try {
      const db = database.getDb();
      
      // First get the current vote to adjust counts
      const tip = await db.collection('tips').findOne({ _id: new ObjectId(tipId) });
      if (!tip) {
        throw new Error('Tip not found');
      }
      
      const userVote = tip.votes.find(vote => vote.userId === userId);
      if (!userVote) {
        throw new Error('No vote found for this user');
      }
      
      const voteUpdate = {
        $pull: { votes: { userId } },
        $set: { updatedAt: new Date() }
      };
      
      if (userVote.voteType === 'upvote') {
        voteUpdate.$inc = { upvotes: -1 };
      } else {
        voteUpdate.$inc = { downvotes: -1 };
      }
      
      const result = await db.collection('tips').findOneAndUpdate(
        { _id: new ObjectId(tipId) },
        voteUpdate,
        { returnDocument: 'after' }
      );
      
      return result.value;
    } catch (error) {
      throw new Error(`Error removing vote: ${error.message}`);
    }
  }
};

module.exports = {
  tipDb
};