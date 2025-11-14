const { tipDb } = require('../models/tipModel');

/**
 * Tips Controller
 * Handles all tip-related operations with proper authentication and authorization
 */
class TipController {

  /**
   * Get all tips with filtering, sorting and pagination
   * GET /api/tips
   * Public endpoint - no authentication required
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
        sort,
        limit: parseInt(limit) * parseInt(page), // Get enough for pagination
        skip: 0
      });

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedTips = tips.slice(startIndex, endIndex);

      // No need to track individual votes anymore since unlimited voting is allowed
      const enhancedTips = paginatedTips.map(tip => ({
        ...tip
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
   * Public endpoint - no authentication required
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

      // Add ownership status if authenticated
      const enhancedTip = {
        ...tip,
        isOwner: req.user ? tip.author === req.user.uid : false
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
   * Requires authentication
   */
  async createTip(req, res, next) {
    try {
      const { title, content } = req.body;

      // Validation is handled by middleware, but double-check required fields
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Title and content are required',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      const tipData = {
        title,
        content,
        author: req.user.uid, // Firebase UID
        authorName: req.user.displayName || 'Anonymous User',
        authorImage: req.user.photoURL || null
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
   * Requires authentication and ownership
   */
  async updateTip(req, res, next) {
    try {
      const { id } = req.params;
      
      // Find the tip first to check ownership
      const existingTip = await tipDb.findById(id);
      
      if (!existingTip) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      // Check if user owns the tip
      if (existingTip.author !== req.user.uid) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You can only edit your own tips',
            code: 'FORBIDDEN'
          }
        });
      }

      // Only allow updating title and content
      const updateData = {};
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.content) updateData.content = req.body.content;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No valid fields to update',
            code: 'VALIDATION_ERROR'
          }
        });
      }

      const updatedTip = await tipDb.update(id, updateData);

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
   * Requires authentication and ownership
   */
  async deleteTip(req, res, next) {
    try {
      const { id } = req.params;

      // Find the tip first to check ownership
      const existingTip = await tipDb.findById(id);
      
      if (!existingTip) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      // Check if user owns the tip
      if (existingTip.author !== req.user.uid) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You can only delete your own tips',
            code: 'FORBIDDEN'
          }
        });
      }

      const deleted = await tipDb.delete(id);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to delete tip',
            code: 'DELETE_FAILED'
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
   * Upvote a tip
   * POST /api/tips/:id/upvote
   * Requires authentication - unlimited votes allowed
   */
  async upvoteTip(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      console.log(`Upvoting tip ${id} by user ${userId}`);
      const updatedTip = await tipDb.upvote(id, userId);
      console.log('Upvote result:', updatedTip);

      res.status(200).json({
        success: true,
        data: {
          tipId: id,
          upvoteCount: updatedTip.upvoteCount
        },
        message: 'Tip upvoted successfully'
      });

    } catch (error) {
      console.error('Upvote controller error:', error);
      
      if (error.message.includes('Tip not found')) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Tip not found',
            code: 'TIP_NOT_FOUND'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during upvote',
          details: error.message
        }
      });
    }
  }

}

module.exports = new TipController();