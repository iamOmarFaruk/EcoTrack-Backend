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
    title: Joi.string().min(5).max(100).required(),
    content: Joi.string().min(20).max(1000).required(),
    category: Joi.string().valid(
      'Energy Conservation', 
      'Water Conservation', 
      'Sustainable Transport', 
      'Green Living', 
      'Waste Reduction',
      'Waste Management'
    ).required(),
    imageUrl: Joi.string().uri().allow('')
  }),

  updateTip: Joi.object({
    title: Joi.string().min(5).max(100),
    content: Joi.string().min(20).max(1000),
    category: Joi.string().valid(
      'Energy Conservation', 
      'Water Conservation', 
      'Sustainable Transport', 
      'Green Living', 
      'Waste Reduction',
      'Waste Management'
    ),
    imageUrl: Joi.string().uri().allow('')
  }).min(1),

  // Event validation
  createEvent: Joi.object({
    title: Joi.string().min(5).max(100).required(),
    description: Joi.string().min(20).max(500).required(),
    detailedDescription: Joi.string().min(50).max(2000),
    date: Joi.date().iso().greater('now').required(),
    endDate: Joi.date().iso().greater(Joi.ref('date')),
    location: Joi.object({
      address: Joi.string().min(5).max(200).required(),
      city: Joi.string().min(2).max(100).required(),
      state: Joi.string().min(2).max(100),
      zipCode: Joi.string().max(20),
      coordinates: Joi.object({
        lat: Joi.number().min(-90).max(90),
        lng: Joi.number().min(-180).max(180)
      })
    }).required(),
    maxParticipants: Joi.number().integer().min(1).max(10000).required(),
    organizerName: Joi.string().min(2).max(50),
    category: Joi.string().valid('Community', 'Education', 'Environmental', 'Workshop', 'Social').default('Community'),
    requirements: Joi.string().max(300),
    benefits: Joi.string().max(300),
    imageUrl: Joi.string().uri().allow('')
  }),

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
    status: Joi.string().valid('upcoming', 'completed', 'cancelled'),
    location: Joi.string().max(100),
    date: Joi.date().iso(),
    category: Joi.string().valid('Community', 'Education', 'Environmental', 'Workshop', 'Social'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

module.exports = {
  validate,
  validateQuery,
  schemas,
  querySchemas
};