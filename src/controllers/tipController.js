const { tipDb } = require('../models/tipModel');

/**
 * Tips Controller
 * Handles all tip-related operations
 */
class TipController {

  /**
   * Get all tips with filtering, sorting and pagination
   * GET /api/tips
   */
  async getAllTips(req, res, next) {
    try {
      const {
        category,
        search,
        sort = 'newest', // newest, oldest, popular
        page = 1,
        limit = 20
      } = req.query;

      // Apply filters and sorting
      const tips = await tipDb.findAll({
        category,
        search,
        sort
      });

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedTips = tips.slice(startIndex, endIndex);

      // Add calculated fields
      const enhancedTips = paginatedTips.map(tip => ({
        ...tip,
        netVotes: tip.upvotes - tip.downvotes,
        totalVotes: tip.upvotes + tip.downvotes
      }));

      // Prepare pagination info
      const totalTips = tips.length;
      const totalPages = Math.ceil(totalTips / parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          tips: enhancedTips
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalTips,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single tip by ID
   * GET /api/tips/:id
   */
  async getTipById(req, res, next) {
    try {
      const { id } = req.params;

      const tip = await tipDb.findById(id);

      if (!tip) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      // Add calculated fields
      const enhancedTip = {
        ...tip,
        netVotes: tip.upvotes - tip.downvotes,
        totalVotes: tip.upvotes + tip.downvotes
      };

      res.status(200).json({
        success: true,
        data: { tip: enhancedTip }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new tip
   * POST /api/tips
   */
  async createTip(req, res, next) {
    try {
      const {
        title,
        content,
        category,
        imageUrl
      } = req.body;

      // Basic validation
      if (!title || !content || !category) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Required fields: title, content, category',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      // Validate content length
      if (content.length < 20 || content.length > 1000) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Content must be between 20 and 1000 characters',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      const tipData = {
        title,
        content,
        category,
        imageUrl,
        author: req.user?.email || 'mock@example.com', // Will use auth later
        authorName: req.user?.displayName || 'Mock User',
        authorAvatar: req.user?.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
      };

      const newTip = await tipDb.create(tipData);

      res.status(201).json({
        success: true,
        data: { tip: newTip },
        message: 'Tip created successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update tip
   * PATCH /api/tips/:id
   */
  async updateTip(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated
      delete updateData._id;
      delete updateData.author;
      delete updateData.authorName;
      delete updateData.authorAvatar;
      delete updateData.upvotes;
      delete updateData.downvotes;
      delete updateData.votes;
      delete updateData.createdAt;

      const updatedTip = await tipDb.update(id, updateData);

      if (!updatedTip) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: { tip: updatedTip },
        message: 'Tip updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete tip
   * DELETE /api/tips/:id
   */
  async deleteTip(req, res, next) {
    try {
      const { id } = req.params;

      const deleted = await tipDb.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        message: 'Tip deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Vote on a tip
   * POST /api/tips/:id/vote
   */
  async voteTip(req, res, next) {
    try {
      const { id } = req.params;
      const { voteType } = req.body;
      const userId = req.user?.uid || 'mock_user_123'; // Will use auth later

      // Validate vote type
      if (!voteType || !['upvote', 'downvote'].includes(voteType)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Vote type must be "upvote" or "downvote"',
            code: 'INVALID_VOTE_TYPE'
          }
        });
      }

      const updatedTip = await tipDb.vote(id, userId, voteType);

      if (!updatedTip) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          tipId: id,
          voteType,
          upvotes: updatedTip.upvotes,
          downvotes: updatedTip.downvotes,
          netVotes: updatedTip.upvotes - updatedTip.downvotes
        },
        message: `${voteType === 'upvote' ? 'Upvoted' : 'Downvoted'} tip successfully`
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove vote from a tip
   * DELETE /api/tips/:id/vote
   */
  async removeVote(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.uid || 'mock_user_123'; // Will use auth later

      const updatedTip = await tipDb.removeVote(id, userId);

      if (!updatedTip) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          tipId: id,
          upvotes: updatedTip.upvotes,
          downvotes: updatedTip.downvotes,
          netVotes: updatedTip.upvotes - updatedTip.downvotes
        },
        message: 'Vote removed successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get popular tips (sorted by votes)
   * GET /api/tips/popular
   */
  async getPopularTips(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      // Get tips sorted by popularity
      const popularTips = await tipDb.findAll({ sort: 'popular' })
        .slice(0, parseInt(limit))
        .map(tip => ({
          ...tip,
          netVotes: tip.upvotes - tip.downvotes,
          totalVotes: tip.upvotes + tip.downvotes
        }));

      res.status(200).json({
        success: true,
        data: { tips: popularTips },
        message: `Top ${limit} popular tips`
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tips by category
   * GET /api/tips/category/:category
   */
  async getTipsByCategory(req, res, next) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const tips = await tipDb.findAll({ category });

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedTips = tips.slice(startIndex, endIndex);

      const enhancedTips = paginatedTips.map(tip => ({
        ...tip,
        netVotes: tip.upvotes - tip.downvotes,
        totalVotes: tip.upvotes + tip.downvotes
      }));

      const totalTips = tips.length;
      const totalPages = Math.ceil(totalTips / parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          tips: enhancedTips,
          category
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalTips,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TipController();