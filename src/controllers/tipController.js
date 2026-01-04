const TipModel = require('../models/tipModel');

/**
 * Tips Controller
 * Handles all tip-related operations
 */

/**
 * GET /api/tips
 * Get all tips with pagination and filtering
 * Access: Public
 */
exports.getAllTips = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      search,
      authorId,
      category
    } = req.query;

    // Validate and sanitize pagination
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(100, Math.max(1, parseInt(limit)));

    // Validate sortBy
    const validSortFields = ['createdAt', 'upvoteCount'];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // Validate order
    const validOrder = ['asc', 'desc'].includes(order) ? order : 'desc';

    const result = await TipModel.find({}, {
      page: validPage,
      limit: validLimit,
      sortBy: validSortBy,
      order: validOrder,
      search,
      authorId,
      category
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching tips:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tips',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/tips
 * Create new tip
 * Access: Authenticated users only
 */
exports.createTip = async (req, res, next) => {
  try {
    const { title, content, category } = req.body;

    // Validate input
    const validation = TipModel.validateTip({ title, content });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Extract author information from Firebase token (req.user set by firebaseAuth middleware)
    const authorData = {
      title,
      content,
      category: category || 'General',
      authorId: req.user.uid,
      authorName: req.user.displayName || req.user.email?.split('@')[0] || 'Anonymous',
      authorImage: req.user.photoURL || null
    };

    // Create tip
    const tip = await TipModel.create(authorData);

    res.status(201).json({
      success: true,
      message: 'Tip created successfully',
      data: TipModel.computeFields(tip, req.user.uid)
    });
  } catch (error) {
    console.error('Error creating tip:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Tip ID already exists. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create tip',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/tips/:id
 * Update tip (full update)
 * Access: Tip author only
 */
exports.updateTip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    // Validate input (allow partial updates)
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (req.body.category !== undefined) updateData.category = req.body.category;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Validate the update data
    const validation = TipModel.validateTip(updateData, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Update tip
    const result = await TipModel.update(id, updateData, req.user.uid);

    if (!result.success) {
      const status = result.error === 'Tip not found' ? 404 : 403;
      return res.status(status).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tip updated successfully',
      data: result.tip
    });
  } catch (error) {
    console.error('Error updating tip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tip',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PATCH /api/tips/:id
 * Update tip (partial update)
 * Access: Tip author only
 * Note: Same implementation as PUT since we support partial updates in both
 */
// This will be assigned at the end of the file

/**
 * DELETE /api/tips/:id
 * Delete tip
 * Access: Tip author only
 */
exports.deleteTip = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Delete tip
    const result = await TipModel.delete(id, req.user.uid);

    if (!result.success) {
      const status = result.error === 'Tip not found' ? 404 : 403;
      return res.status(status).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tip deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tip',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/tips/:id/upvote
 * Upvote a tip
 * Access: Authenticated users only
 */
exports.upvoteTip = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Upvote the tip
    const result = await TipModel.upvote(id, req.user.uid);

    if (!result.success) {
      let status = 500;
      if (result.code === 'NOT_FOUND') status = 404;
      else if (result.code === 'SELF_UPVOTE' || result.code === 'UPVOTE_LIMIT_REACHED') status = 400;

      return res.status(status).json({
        success: false,
        message: result.error,
        code: result.code
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tip upvoted successfully',
      data: {
        ...result.tip,
        userUpvotesCount: result.userUpvotesCount
      }
    });
  } catch (error) {
    console.error('Error upvoting tip:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upvote tip',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/tips/my-tips
 * Get tips created by logged-in user
 * Access: Authenticated users only
 */
exports.getMyTips = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Validate and sanitize pagination
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(100, Math.max(1, parseInt(limit)));

    // Validate sortBy
    const validSortFields = ['createdAt', 'upvoteCount'];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // Validate order
    const validOrder = ['asc', 'desc'].includes(order) ? order : 'desc';

    const result = await TipModel.find({}, {
      page: validPage,
      limit: validLimit,
      sortBy: validSortBy,
      order: validOrder,
      authorId: req.user.uid // Filter by current user
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching user tips:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your tips',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/tips/trending
 * Get trending tips (most upvoted recently)
 * Access: Public
 */
exports.getTrendingTips = async (req, res, next) => {
  try {
    const {
      days = 7,
      limit = 10
    } = req.query;

    // Validate and sanitize
    const validDays = Math.min(30, Math.max(1, parseInt(days)));
    const validLimit = Math.min(50, Math.max(1, parseInt(limit)));

    const tips = await TipModel.getTrending(validDays, validLimit);

    res.status(200).json({
      success: true,
      data: {
        tips,
        days: validDays,
        limit: validLimit
      }
    });
  } catch (error) {
    console.error('Error fetching trending tips:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending tips',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Assign patchTip to updateTip (both support partial updates)
exports.patchTip = exports.updateTip;
