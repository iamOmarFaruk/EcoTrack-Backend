const database = require('../config/database');

/**
 * Tips Model (MongoDB Native Driver)
 * 
 * Collection: tips
 * 
 * Document Structure:
 * {
 *   _id: ObjectId,
 *   id: string,               // URL-friendly unique ID (e.g., "tip-1731668400123")
 *   title: string,            // 5-100 chars
 *   content: string,          // 20-500 chars
 *   authorId: string,         // Firebase UID
 *   authorName: string,       // Author display name
 *   authorImage: string,      // Author photo URL (nullable)
 *   upvoteCount: Number,      // Total upvote count
 *   upvotes: Array,           // Array of {userId, votedAt}
 *   createdAt: Date,
 *   updatedAt: Date,
 *   isEdited: boolean         // Computed field
 * }
 */

class TipModel {
  /**
   * Get the tips collection
   */
  static async getCollection() {
    const db = database.getDb();
    return db.collection('tips');
  }

  /**
   * Initialize database indexes (run once on setup)
   */
  static async createIndexes() {
    const collection = await this.getCollection();
    
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ authorId: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ upvoteCount: -1 });
    await collection.createIndex({ 'upvotes.userId': 1 });
    await collection.createIndex({ 
      title: 'text', 
      content: 'text' 
    });

    console.log('Tips collection indexes created successfully');
  }

  /**
   * Validate tip data
   */
  static validateTip(data, isUpdate = false) {
    const errors = [];

    // Validate title
    if (data.title !== undefined) {
      const title = String(data.title).trim();
      if (!isUpdate && !title) {
        errors.push({ field: 'title', message: 'Title is required' });
      } else if (title && (title.length < 5 || title.length > 100)) {
        errors.push({ field: 'title', message: 'Title must be between 5 and 100 characters' });
      } else if (title && !/^[\w\s.,!?\-&:]+$/.test(title)) {
        errors.push({ field: 'title', message: 'Title contains invalid characters' });
      }
    } else if (!isUpdate) {
      errors.push({ field: 'title', message: 'Title is required' });
    }

    // Validate content
    if (data.content !== undefined) {
      const content = String(data.content).trim();
      if (!isUpdate && !content) {
        errors.push({ field: 'content', message: 'Content is required' });
      } else if (content && (content.length < 20 || content.length > 500)) {
        errors.push({ field: 'content', message: 'Content must be between 20 and 500 characters' });
      }
    } else if (!isUpdate) {
      errors.push({ field: 'content', message: 'Content is required' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique tip ID
   */
  static generateTipId() {
    return `tip-${Date.now()}`;
  }

  /**
   * Create new tip
   */
  static async create(tipData) {
    const collection = await this.getCollection();
    
    const tip = {
      id: this.generateTipId(),
      title: tipData.title.trim(),
      content: tipData.content.trim(),
      authorId: tipData.authorId,
      authorName: tipData.authorName,
      authorImage: tipData.authorImage || null,
      upvoteCount: 0,
      upvotes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(tip);
    return { ...tip, _id: result.insertedId };
  }

  /**
   * Find tips with pagination and filtering
   */
  static async find(filters = {}, options = {}) {
    const collection = await this.getCollection();
    
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      search,
      authorId
    } = options;

    // Build query
    const query = {};
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (authorId) {
      query.authorId = authorId;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const tips = await collection
      .find(query)
      .project({ upvotes: 0 }) // Exclude upvotes array from list view
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await collection.countDocuments(query);

    return {
      tips: tips.map(tip => this.computeFields(tip)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find tip by ID
   */
  static async findById(id, includeUpvotes = false) {
    const collection = await this.getCollection();
    
    const projection = includeUpvotes ? {} : { upvotes: 0 };
    const tip = await collection.findOne({ id }, { projection });
    
    return tip ? this.computeFields(tip) : null;
  }

  /**
   * Update tip
   */
  static async update(id, updateData, userId) {
    const collection = await this.getCollection();
    
    // Check if user is the author
    const tip = await collection.findOne({ id });
    if (!tip) {
      return { success: false, error: 'Tip not found' };
    }
    
    if (tip.authorId !== userId) {
      return { success: false, error: 'You are not authorized to update this tip' };
    }

    // Prepare update
    const update = {
      $set: {
        updatedAt: new Date()
      }
    };

    if (updateData.title !== undefined) {
      update.$set.title = updateData.title.trim();
    }

    if (updateData.content !== undefined) {
      update.$set.content = updateData.content.trim();
    }

    const result = await collection.findOneAndUpdate(
      { id },
      update,
      { returnDocument: 'after' }
    );

    return {
      success: true,
      tip: this.computeFields(result.value)
    };
  }

  /**
   * Delete tip
   */
  static async delete(id, userId) {
    const collection = await this.getCollection();
    
    // Check if user is the author
    const tip = await collection.findOne({ id });
    if (!tip) {
      return { success: false, error: 'Tip not found' };
    }
    
    if (tip.authorId !== userId) {
      return { success: false, error: 'You are not authorized to delete this tip' };
    }

    await collection.deleteOne({ id });
    
    return { success: true };
  }

  /**
   * Upvote a tip (atomic operation)
   */
  static async upvote(id, userId) {
    const collection = await this.getCollection();
    
    // First, get the tip to check various conditions
    const tip = await collection.findOne({ id });
    
    if (!tip) {
      return { success: false, error: 'Tip not found', code: 'NOT_FOUND' };
    }

    // Check if user is trying to upvote their own tip
    if (tip.authorId === userId) {
      return { 
        success: false, 
        error: 'You cannot upvote your own tip',
        code: 'SELF_UPVOTE'
      };
    }

    // Check upvote limit (100 per user per tip)
    const userUpvotesCount = tip.upvotes.filter(v => v.userId === userId).length;
    if (userUpvotesCount >= 100) {
      return {
        success: false,
        error: 'You have reached the maximum upvote limit (100) for this tip',
        code: 'UPVOTE_LIMIT_REACHED'
      };
    }

    // Atomic upvote operation
    const result = await collection.findOneAndUpdate(
      { id },
      {
        $inc: { upvoteCount: 1 },
        $push: {
          upvotes: {
            userId,
            votedAt: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    // Calculate user's total upvotes on this tip
    const updatedUserUpvotesCount = result.value.upvotes.filter(v => v.userId === userId).length;

    return {
      success: true,
      tip: this.computeFields(result.value),
      userUpvotesCount: updatedUserUpvotesCount
    };
  }

  /**
   * Get trending tips (most upvoted recently)
   */
  static async getTrending(days = 7, limit = 10) {
    const collection = await this.getCollection();
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const tips = await collection
      .find({
        createdAt: { $gte: daysAgo }
      })
      .project({ upvotes: 0 })
      .sort({ upvoteCount: -1 })
      .limit(limit)
      .toArray();

    return tips.map(tip => this.computeFields(tip));
  }

  /**
   * Compute additional fields
   */
  static computeFields(tip, userId = null) {
    if (!tip) return null;

    // Compute isEdited
    tip.isEdited = tip.updatedAt.getTime() !== tip.createdAt.getTime();

    // Compute isOwner if userId provided
    if (userId) {
      tip.isOwner = tip.authorId === userId;
    }

    // Remove MongoDB _id from response
    const { _id, ...tipWithoutId } = tip;

    return tipWithoutId;
  }
}

module.exports = TipModel;
