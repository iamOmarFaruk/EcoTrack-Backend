const { mongoose } = require('../config/mongoose');

const upvoteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  votedAt: { type: Date, default: Date.now }
}, { _id: false });

const tipSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  authorImage: { type: String, default: null },
  upvoteCount: { type: Number, default: 0 },
  upvotes: { type: [upvoteSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

tipSchema.index({ title: 'text', content: 'text' });

const Tip = mongoose.models.Tip || mongoose.model('Tip', tipSchema);

/** Tips Model */

class TipModel {
  /**
   * Get the tips collection
   */
  static async getCollection() {
    return Tip;
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
    
    const tip = await collection.create({
      id: this.generateTipId(),
      title: tipData.title.trim(),
      content: tipData.content.trim(),
      authorId: tipData.authorId,
      authorName: tipData.authorName,
      authorImage: tipData.authorImage || null,
      upvoteCount: 0,
      upvotes: []
    });

    return tip.toObject();
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
      .select('-upvotes')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

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
    
    const projection = includeUpvotes ? {} : '-upvotes';
    const tip = await collection.findOne({ id }).select(projection).lean();
    
    return tip ? this.computeFields(tip) : null;
  }

  /**
   * Update tip
   */
  static async update(id, updateData, userId) {
    const collection = await this.getCollection();
    
    // Check if user is the author
    const tip = await collection.findOne({ id }).lean();
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

    const updated = await collection.findOneAndUpdate(
      { id },
      update,
      { new: true }
    ).lean();

    return {
      success: true,
      tip: this.computeFields(updated)
    };
  }

  /**
   * Delete tip
   */
  static async delete(id, userId) {
    const collection = await this.getCollection();
    
    // Check if user is the author
    const tip = await collection.findOne({ id }).lean();
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
    const tip = await collection.findOne({ id }).lean();
    
    if (!tip) {
      return { success: false, error: 'Tip not found', code: 'NOT_FOUND' };
    }

    // Ensure upvotes is always an array to avoid runtime errors
    const existingUpvotes = Array.isArray(tip.upvotes) ? tip.upvotes : [];

    // Check if user is trying to upvote their own tip
    if (tip.authorId === userId) {
      return { 
        success: false, 
        error: 'You cannot upvote your own tip',
        code: 'SELF_UPVOTE'
      };
    }

    // Check upvote limit (100 per user per tip)
    const userUpvotesCount = existingUpvotes.filter(v => v.userId === userId).length;
    if (userUpvotesCount >= 100) {
      return {
        success: false,
        error: 'You have reached the maximum upvote limit (100) for this tip',
        code: 'UPVOTE_LIMIT_REACHED'
      };
    }

    // Atomic upvote operation
    const updatedTip = await collection.findOneAndUpdate(
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
      { new: true }
    ).lean();
    const updatedUpvotes = Array.isArray(updatedTip.upvotes) ? updatedTip.upvotes : [];
    const updatedUserUpvotesCount = updatedUpvotes.filter(v => v.userId === userId).length;

    return {
      success: true,
      tip: this.computeFields(updatedTip),
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
      .select('-upvotes')
      .sort({ upvoteCount: -1 })
      .limit(limit)
      .lean();

    return tips.map(tip => this.computeFields(tip));
  }

  /**
   * Compute additional fields
   */
  static computeFields(tip, userId = null) {
    if (!tip) return null;

    // Normalize dates to avoid crashes if stored as strings or missing
    const createdAt = tip.createdAt instanceof Date
      ? tip.createdAt
      : new Date(tip.createdAt || Date.now());

    const updatedAt = tip.updatedAt instanceof Date
      ? tip.updatedAt
      : createdAt;

    tip.createdAt = createdAt;
    tip.updatedAt = updatedAt;

    // Compute isEdited
    tip.isEdited = updatedAt.getTime() !== createdAt.getTime();

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
