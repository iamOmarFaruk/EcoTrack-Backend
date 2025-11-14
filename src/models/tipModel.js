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
          sortOption = { upvoteCount: -1 };
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
        author: tipData.author,
        authorName: tipData.authorName,
        authorImage: tipData.authorImage,
        title: tipData.title,
        content: tipData.content,
        upvoteCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
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
      return result.value || result;
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

  // Upvote tip - unlimited votes allowed
  async upvote(tipId, userId) {
    try {
      const db = database.getDb();
      
      // Check if tip exists
      const tip = await db.collection('tips').findOne({ _id: new ObjectId(tipId) });
      if (!tip) {
        throw new Error('Tip not found');
      }
      
      // Allow unlimited upvotes - no restrictions
      const result = await db.collection('tips').findOneAndUpdate(
        { _id: new ObjectId(tipId) },
        { 
          $inc: { upvoteCount: 1 },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      
      // Handle both old and new MongoDB driver return formats
      const updatedTip = result.value || result;
      if (!updatedTip) {
        throw new Error('Failed to update tip');
      }
      
      return updatedTip;
    } catch (error) {
      console.error('Upvote error:', error);
      throw new Error(`Error upvoting tip: ${error.message}`);
    }
  }
};

module.exports = {
  tipDb
};