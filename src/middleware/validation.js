const Joi = require('joi');

/**
 * Request validation middleware using Joi
 */

// Common validation schemas
const schemas = {
  // Challenge validation
  createChallenge: Joi.object({
    title: Joi.string().min(3).max(100).required(),
    category: Joi.string().valid(
      'Energy Conservation', 
      'Water Conservation', 
      'Sustainable Transport', 
      'Green Living', 
      'Waste Reduction'
    ).required(),
    description: Joi.string().min(10).max(500).required(),
    duration: Joi.number().integer().min(1).max(365).required(),
    target: Joi.string().max(200),
    startDate: Joi.date().iso().greater('now').required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
    difficulty: Joi.string().valid('Beginner', 'Intermediate', 'Advanced').default('Beginner'),
    instructions: Joi.array().items(Joi.string().max(200)),
    tips: Joi.array().items(Joi.string().max(200)),
    imageUrl: Joi.string().uri().allow('')
  }),

  updateChallenge: Joi.object({
    title: Joi.string().min(3).max(100),
    category: Joi.string().valid(
      'Energy Conservation', 
      'Water Conservation', 
      'Sustainable Transport', 
      'Green Living', 
      'Waste Reduction'
    ),
    description: Joi.string().min(10).max(500),
    duration: Joi.number().integer().min(1).max(365),
    target: Joi.string().max(200),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso(),
    difficulty: Joi.string().valid('Beginner', 'Intermediate', 'Advanced'),
    instructions: Joi.array().items(Joi.string().max(200)),
    tips: Joi.array().items(Joi.string().max(200)),
    imageUrl: Joi.string().uri().allow(''),
    isActive: Joi.boolean()
  }).min(1),

  // Tip validation
  createTip: Joi.object({
    title: Joi.string().min(5).max(100).required().messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 5 characters long',
      'string.max': 'Title cannot exceed 100 characters',
      'any.required': 'Title is required'
    }),
    content: Joi.string().min(20).max(500).required().messages({
      'string.empty': 'Content is required',
      'string.min': 'Content must be at least 20 characters long',
      'string.max': 'Content cannot exceed 500 characters',
      'any.required': 'Content is required'
    })
  }),

  updateTip: Joi.object({
    title: Joi.string().min(5).max(100).messages({
      'string.min': 'Title must be at least 5 characters long',
      'string.max': 'Title cannot exceed 100 characters'
    }),
    content: Joi.string().min(20).max(500).messages({
      'string.min': 'Content must be at least 20 characters long',
      'string.max': 'Content cannot exceed 500 characters'
    })
  }).min(1).messages({
    'object.min': 'At least one field (title or content) must be provided for update'
  }),

  createEvent: Joi.object({
    title: Joi.string().min(3).max(100).required().trim(),
    description: Joi.string().min(10).max(200).required().trim(),
    detailedDescription: Joi.string().min(50).max(2000).required().trim(),
    date: Joi.date().iso().min(new Date(Date.now() + 24 * 60 * 60 * 1000)).required(),
    location: Joi.string().min(3).max(100).required().trim(),
    organizer: Joi.string().min(3).max(100).required().trim(),
    capacity: Joi.number().integer().min(1).max(10000).required(),
    duration: Joi.string().min(3).max(50).required().trim(),
    requirements: Joi.string().min(10).max(500).required().trim(),
    benefits: Joi.string().min(10).max(500).required().trim(),
    image: Joi.string().uri().required()
  }),

  updateEvent: Joi.object({
    title: Joi.string().min(3).max(100).trim(),
    description: Joi.string().min(10).max(200).trim(),
    detailedDescription: Joi.string().min(50).max(2000).trim(),
    date: Joi.date().iso().min('now'),
    location: Joi.string().min(3).max(100).trim(),
    organizer: Joi.string().min(3).max(100).trim(),
    capacity: Joi.number().integer().min(1).max(10000),
    duration: Joi.string().min(3).max(50).trim(),
    requirements: Joi.string().min(10).max(500).trim(),
    benefits: Joi.string().min(10).max(500).trim(),
    image: Joi.string().uri(),
    status: Joi.string().valid('active', 'cancelled', 'completed')
  }).min(1),

  // User profile validation
  updateUserProfile: Joi.object({
    displayName: Joi.string().min(2).max(50),
    bio: Joi.string().max(300).allow(''),
    location: Joi.string().max(100).allow(''),
    preferences: Joi.object({
      notifications: Joi.boolean(),
      newsletter: Joi.boolean(),
      privacy: Joi.string().valid('public', 'private')
    })
  }).min(1),

  // User registration validation
  registerUser: Joi.object({
    idToken: Joi.string().required().messages({
      'string.empty': 'Firebase ID token is required',
      'any.required': 'Firebase ID token is required'
    }),
    displayName: Joi.string().min(2).max(50).optional().messages({
      'string.min': 'Display name must be at least 2 characters long',
      'string.max': 'Display name cannot exceed 50 characters'
    }),
    photoURL: Joi.string().uri().allow('', null).messages({
      'string.uri': 'Photo URL must be a valid URL'
    }),
    bio: Joi.string().max(300).allow('').messages({
      'string.max': 'Bio cannot exceed 300 characters'
    }),
    location: Joi.string().max(100).allow('').messages({
      'string.max': 'Location cannot exceed 100 characters'
    })
  }),

  // Vote validation
  vote: Joi.object({
    voteType: Joi.string().valid('upvote', 'downvote').required()
  }),

  // Progress validation
  updateProgress: Joi.object({
    progress: Joi.number().integer().min(0).max(100).required(),
    notes: Joi.string().max(500).allow('')
  }),

  // Complete challenge validation
  completeChallenge: Joi.object({
    impactAchieved: Joi.number().min(0),
    notes: Joi.string().max(500).allow('')
  }),

  // Attendance validation
  markAttendance: Joi.object({
    userId: Joi.string().required(),
    attended: Joi.boolean().required()
  })
};

/**
 * Generic validation middleware factory
 * @param {string} schemaName - Name of the schema to validate against
 * @returns {Function} Express middleware function
 */
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Validation schema not found',
          code: 'SCHEMA_ERROR'
        }
      });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Query parameter validation middleware
 */
const validateQuery = (paramSchema) => {
  return (req, res, next) => {
    const { error, value } = paramSchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true // Convert string numbers to numbers, etc.
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        parameter: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid query parameters',
          code: 'QUERY_VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Common query schemas
 */
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  challengeFilters: Joi.object({
    category: Joi.string().valid(
      'Energy Conservation', 
      'Water Conservation', 
      'Sustainable Transport', 
      'Green Living', 
      'Waste Reduction'
    ),
    status: Joi.string().valid('active', 'completed', 'upcoming'),
    search: Joi.string().max(100),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  tipFilters: Joi.object({
    category: Joi.string().valid(
      'Energy Conservation', 
      'Water Conservation', 
      'Sustainable Transport', 
      'Green Living', 
      'Waste Reduction',
      'Waste Management'
    ),
    search: Joi.string().max(100),
    sort: Joi.string().valid('newest', 'oldest', 'popular').default('newest'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  eventFilters: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string().valid('active', 'cancelled', 'completed'),
    search: Joi.string().max(100),
    sortBy: Joi.string().valid('date', 'createdAt', 'capacity').default('date'),
    order: Joi.string().valid('asc', 'desc').default('asc')
  })
};

module.exports = {
  validate,
  validateQuery,
  schemas,
  querySchemas
};