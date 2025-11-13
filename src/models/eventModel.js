/**
 * Event Model - MongoDB Operations
 * Handles all event-related database operations
 */

const { ObjectId } = require('mongodb');
const database = require('../config/database');

// MongoDB Event Operations
const eventDb = {
  // Get all events with optional filtering
  async findAll(filters = {}) {
    try {
      const db = database.getDb();
      let query = {};
      
      if (filters.status) {
        const now = new Date();
        if (filters.status === 'upcoming') {
          query.date = { $gt: now };
        } else if (filters.status === 'past') {
          query.date = { $lt: now };
        }
      }
      
      if (filters.location) {
        query['location.city'] = new RegExp(filters.location, 'i');
      }
      
      if (filters.category) {
        query.category = new RegExp(filters.category, 'i');
      }
      
      if (filters.search) {
        query.$or = [
          { title: new RegExp(filters.search, 'i') },
          { description: new RegExp(filters.search, 'i') }
        ];
      }
      
      return await db.collection('events')
        .find(query)
        .sort({ date: 1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0)
        .toArray();
    } catch (error) {
      throw new Error(`Error finding events: ${error.message}`);
    }
  },

  // Find event by ID
  async findById(id) {
    try {
      const db = database.getDb();
      return await db.collection('events').findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new Error(`Error finding event by ID: ${error.message}`);
    }
  },

  // Create new event
  async create(eventData) {
    try {
      const db = database.getDb();
      const newEvent = {
        ...eventData,
        currentParticipants: 0,
        registrations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('events').insertOne(newEvent);
      return { ...newEvent, _id: result.insertedId };
    } catch (error) {
      throw new Error(`Error creating event: ${error.message}`);
    }
  },

  // Update event
  async update(id, updateData) {
    try {
      const db = database.getDb();
      const result = await db.collection('events').findOneAndUpdate(
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
      throw new Error(`Error updating event: ${error.message}`);
    }
  },

  // Delete event
  async delete(id) {
    try {
      const db = database.getDb();
      const result = await db.collection('events').deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting event: ${error.message}`);
    }
  },

  // Register for event
  async register(eventId, userId) {
    try {
      const db = database.getDb();
      const registration = {
        userId,
        registeredAt: new Date(),
        attended: null
      };
      
      const result = await db.collection('events').findOneAndUpdate(
        { _id: new ObjectId(eventId) },
        { 
          $push: { registrations: registration },
          $inc: { currentParticipants: 1 },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      throw new Error(`Error registering for event: ${error.message}`);
    }
  },

  // Unregister from event
  async unregister(eventId, userId) {
    try {
      const db = database.getDb();
      const result = await db.collection('events').findOneAndUpdate(
        { _id: new ObjectId(eventId) },
        { 
          $pull: { registrations: { userId } },
          $inc: { currentParticipants: -1 },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
      return result.value;
    } catch (error) {
      throw new Error(`Error unregistering from event: ${error.message}`);
    }
  }
};

module.exports = {
  eventDb
};