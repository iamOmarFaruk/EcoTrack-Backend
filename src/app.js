const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import database connection
const database = require('./config/database');

// Import Firebase configuration
const { initializeFirebase } = require('./config/firebase');

// Import security middleware
const { 
  sanitizeInput, 
  requestSizeLimit, 
  securityHeaders 
} = require('./middleware/security');

// Import routes
const challengeRoutes = require('./routes/challenges');
const tipRoutes = require('./routes/tips');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const authRoutes = require('./routes/auth');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const app = express();

// Initialize database connection
async function initializeDatabase() {
  try {
    await database.connect();
    console.log('🌱 Database connection established');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Initialize database when app starts
initializeDatabase();

// Initialize Firebase
try {
  initializeFirebase();
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  process.exit(1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - relaxed for development
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001', // Allow server requests
  'http://localhost:5173', // Vite dev server
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

if (process.env.NODE_ENV === 'development') {
  // Allow all localhost origins in development
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400
  }));
} else {
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400
  }));
}

// Rate limiting with environment-specific configuration
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const maxRequests = process.env.NODE_ENV === 'development' ? 1000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100);

const limiter = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.'
    }
  }
});
app.use('/api/', limiter);

// Apply security headers
app.use(securityHeaders);

// Request size limiting (before body parsing)
app.use(requestSizeLimit);

// Body parsing middleware with enhanced security
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100 
}));

// Input sanitization
app.use(sanitizeInput);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EcoTrack API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: database.isHealthy() ? 'Connected' : 'Disconnected'
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  const apiDocumentation = {
    success: true,
    message: 'EcoTrack API Documentation',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    timestamp: new Date().toISOString(),
    routes: {
      // Authentication Routes
      authentication: {
        description: 'Firebase Authentication endpoints',
        baseRoute: '/api/auth',
        endpoints: [
          {
            method: 'POST',
            path: '/api/auth/verify-token',
            description: 'Verify Firebase ID token and return user info',
            access: 'Public (requires valid Firebase token)',
            body: { idToken: 'string (required)' }
          },
          {
            method: 'GET',
            path: '/api/auth/user',
            description: 'Get current authenticated user information',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' }
          },
          {
            method: 'POST',
            path: '/api/auth/set-claims',
            description: 'Set custom claims for a user',
            access: 'Private (requires admin role)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            body: { uid: 'string', customClaims: 'object' }
          },
          {
            method: 'GET',
            path: '/api/auth/users',
            description: 'List all users',
            access: 'Private (requires admin role)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            query: { limit: 'number (optional, default: 1000)' }
          },
          {
            method: 'GET',
            path: '/api/auth/protected',
            description: 'Test protected route',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' }
          },
          {
            method: 'GET',
            path: '/api/auth/admin',
            description: 'Test admin-only route',
            access: 'Private (requires admin role)',
            headers: { Authorization: 'Bearer <firebase_token>' }
          },
          {
            method: 'GET',
            path: '/api/auth/profile',
            description: 'Get authenticated user profile information only',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            note: 'Returns 404 if user profile not found in database'
          }
        ]
      },

      // User Management Routes
      users: {
        description: 'User profile and activity endpoints',
        baseRoute: '/api/users',
        endpoints: [
          {
            method: 'GET',
            path: '/api/users/profile',
            description: 'Get current user profile',
            access: 'Private (requires authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' }
          },
          {
            method: 'PATCH',
            path: '/api/users/profile',
            description: 'Update current user profile',
            access: 'Private (requires authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            body: { name: 'string', bio: 'string', preferences: 'object' }
          },
          {
            method: 'GET',
            path: '/api/users/:id',
            description: 'Get public user profile',
            access: 'Public',
            params: { id: 'string (user ID)' }
          },
          {
            method: 'GET',
            path: '/api/users/:id/activities',
            description: 'Get user\'s public activities',
            access: 'Public',
            params: { id: 'string (user ID)' }
          },
          {
            method: 'GET',
            path: '/api/users/:id/challenges',
            description: 'Get user\'s challenges',
            access: 'Public',
            params: { id: 'string (user ID)' }
          },
          {
            method: 'GET',
            path: '/api/users/:id/stats',
            description: 'Get user statistics',
            access: 'Public',
            params: { id: 'string (user ID)' }
          }
        ]
      },

      // Challenge Management Routes
      challenges: {
        description: 'Environmental challenge endpoints',
        baseRoute: '/api/challenges',
        endpoints: [
          {
            method: 'GET',
            path: '/api/challenges',
            description: 'Get all challenges with filtering',
            access: 'Public',
            query: { 
              category: 'string (optional)',
              difficulty: 'string (optional)',
              status: 'string (optional)',
              page: 'number (optional)',
              limit: 'number (optional)'
            }
          },
          {
            method: 'GET',
            path: '/api/challenges/:id',
            description: 'Get specific challenge',
            access: 'Public',
            params: { id: 'string (challenge ID)' }
          },
          {
            method: 'POST',
            path: '/api/challenges',
            description: 'Create new challenge',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            body: {
              title: 'string',
              description: 'string',
              category: 'string',
              difficulty: 'string',
              duration: 'number',
              target: 'object'
            }
          },
          {
            method: 'PATCH',
            path: '/api/challenges/:id',
            description: 'Update challenge',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (challenge ID)' },
            body: { title: 'string', description: 'string' }
          },
          {
            method: 'DELETE',
            path: '/api/challenges/:id',
            description: 'Delete challenge',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (challenge ID)' }
          },
          {
            method: 'POST',
            path: '/api/challenges/join/:id',
            description: 'Join challenge',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (challenge ID)' }
          },
          {
            method: 'POST',
            path: '/api/challenges/leave/:id',
            description: 'Leave challenge',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (challenge ID)' }
          },
          {
            method: 'PATCH',
            path: '/api/challenges/:id/progress',
            description: 'Update challenge progress',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (challenge ID)' },
            body: { progress: 'number' }
          },
          {
            method: 'POST',
            path: '/api/challenges/:id/complete',
            description: 'Complete challenge',
            access: 'Private (requires Firebase authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (challenge ID)' }
          },
          {
            method: 'GET',
            path: '/api/challenges/:id/participants',
            description: 'Get challenge participants',
            access: 'Public',
            params: { id: 'string (challenge ID)' }
          }
        ]
      },

      // Event Management Routes
      events: {
        description: 'Environmental event endpoints',
        baseRoute: '/api/events',
        endpoints: [
          {
            method: 'GET',
            path: '/api/events',
            description: 'Get all events with filtering',
            access: 'Public',
            query: {
              category: 'string (optional)',
              location: 'string (optional)',
              date: 'string (optional)',
              page: 'number (optional)',
              limit: 'number (optional)'
            }
          },
          {
            method: 'GET',
            path: '/api/events/upcoming',
            description: 'Get upcoming events',
            access: 'Public',
            query: { limit: 'number (optional)' }
          },
          {
            method: 'GET',
            path: '/api/events/:id',
            description: 'Get specific event',
            access: 'Public',
            params: { id: 'string (event ID)' }
          },
          {
            method: 'POST',
            path: '/api/events',
            description: 'Create new event',
            access: 'Private (authentication will be required)',
            body: {
              title: 'string',
              description: 'string',
              date: 'string',
              location: 'object',
              category: 'string',
              capacity: 'number'
            }
          },
          {
            method: 'PATCH',
            path: '/api/events/:id',
            description: 'Update event',
            access: 'Private (organizer/admin only)',
            params: { id: 'string (event ID)' },
            body: { title: 'string', description: 'string', date: 'string' }
          },
          {
            method: 'DELETE',
            path: '/api/events/:id',
            description: 'Delete event',
            access: 'Private (organizer/admin only)',
            params: { id: 'string (event ID)' }
          },
          {
            method: 'POST',
            path: '/api/events/:id/register',
            description: 'Register for event',
            access: 'Private (authentication will be required)',
            params: { id: 'string (event ID)' }
          },
          {
            method: 'DELETE',
            path: '/api/events/:id/register',
            description: 'Unregister from event',
            access: 'Private (authentication will be required)',
            params: { id: 'string (event ID)' }
          },
          {
            method: 'PATCH',
            path: '/api/events/:id/attendance',
            description: 'Mark attendance',
            access: 'Private (organizer/admin only)',
            params: { id: 'string (event ID)' },
            body: { userId: 'string', attended: 'boolean' }
          },
          {
            method: 'GET',
            path: '/api/events/:id/registrations',
            description: 'Get event registrations',
            access: 'Private (organizer/admin only)',
            params: { id: 'string (event ID)' }
          }
        ]
      },

      // Eco Tips Routes
      tips: {
        description: 'Environmental tips and advice endpoints',
        baseRoute: '/api/tips',
        endpoints: [
          {
            method: 'GET',
            path: '/api/tips',
            description: 'Get all tips with filtering and sorting',
            access: 'Public',
            query: {
              category: 'string (optional)',
              difficulty: 'string (optional)',
              sort: 'string (optional)',
              page: 'number (optional)',
              limit: 'number (optional)'
            }
          },
          {
            method: 'GET',
            path: '/api/tips/popular',
            description: 'Get popular tips',
            access: 'Public',
            query: { limit: 'number (optional)' }
          },
          {
            method: 'GET',
            path: '/api/tips/category/:category',
            description: 'Get tips by category',
            access: 'Public',
            params: { category: 'string (category name)' }
          },
          {
            method: 'GET',
            path: '/api/tips/:id',
            description: 'Get specific tip',
            access: 'Public',
            params: { id: 'string (tip ID)' }
          },
          {
            method: 'POST',
            path: '/api/tips',
            description: 'Create new tip',
            access: 'Private (authentication will be required)',
            body: {
              title: 'string',
              content: 'string',
              category: 'string',
              difficulty: 'string',
              estimatedImpact: 'string'
            }
          },
          {
            method: 'PATCH',
            path: '/api/tips/:id',
            description: 'Update tip',
            access: 'Private (owner only)',
            params: { id: 'string (tip ID)' },
            body: { title: 'string', content: 'string' }
          },
          {
            method: 'DELETE',
            path: '/api/tips/:id',
            description: 'Delete tip',
            access: 'Private (owner/admin only)',
            params: { id: 'string (tip ID)' }
          },
          {
            method: 'POST',
            path: '/api/tips/:id/vote',
            description: 'Vote on tip',
            access: 'Private (authentication will be required)',
            params: { id: 'string (tip ID)' },
            body: { type: 'string (upvote/downvote)' }
          },
          {
            method: 'DELETE',
            path: '/api/tips/:id/vote',
            description: 'Remove vote from tip',
            access: 'Private (authentication will be required)',
            params: { id: 'string (tip ID)' }
          }
        ]
      },

      // Statistics Routes
      statistics: {
        description: 'Application statistics and analytics endpoints',
        baseRoute: '/api/stats',
        endpoints: [
          {
            method: 'GET',
            path: '/api/stats/community',
            description: 'Global community statistics',
            access: 'Public'
          },
          {
            method: 'GET',
            path: '/api/stats/user',
            description: 'Current user statistics',
            access: 'Private (authentication will be required)',
            headers: { Authorization: 'Bearer <firebase_token>' }
          },
          {
            method: 'GET',
            path: '/api/stats/impact',
            description: 'Environmental impact metrics',
            access: 'Public'
          },
          {
            method: 'GET',
            path: '/api/stats/leaderboard',
            description: 'Leaderboard data',
            access: 'Public',
            query: {
              type: 'string (optional)',
              period: 'string (optional)',
              limit: 'number (optional)'
            }
          },
          {
            method: 'GET',
            path: '/api/stats/challenges/:id',
            description: 'Challenge-specific statistics',
            access: 'Public',
            params: { id: 'string (challenge ID)' }
          }
        ]
      }
    },

    // Additional Information
    general: {
      description: 'General API information and utility endpoints',
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: 'API health check',
          access: 'Public'
        },
        {
          method: 'GET',
          path: '/api',
          description: 'This API documentation',
          access: 'Public'
        }
      ]
    },

    // Security & Rate Limiting Info
    security: {
      authentication: {
        type: 'Firebase Authentication',
        description: 'Use Firebase ID tokens in Authorization header',
        format: 'Bearer <firebase_id_token>'
      },
      rateLimiting: {
        window: process.env.NODE_ENV === 'development' ? '15 minutes' : '15 minutes',
        maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 100,
        scope: 'Per IP address'
      },
      cors: {
        enabled: true,
        development: 'All localhost origins allowed',
        production: 'Configured allowed origins only'
      }
    },

    // Response Format
    responseFormat: {
      success: {
        structure: {
          success: true,
          data: 'response_data',
          message: 'optional_message'
        }
      },
      error: {
        structure: {
          success: false,
          error: {
            message: 'error_description',
            code: 'optional_error_code'
          }
        }
      }
    },

    notes: [
      'All routes marked as "Private (authentication will be required)" are currently public but will require Firebase authentication in production',
      'Admin routes require custom claims: { role: "admin" }',
      'All POST/PATCH/DELETE requests should include Content-Type: application/json header',
      'Rate limiting is more relaxed in development mode',
      'API responses follow a consistent format with success/error indicators'
    ]
  };

  res.json(apiDocumentation);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);

// 404 handler for unknown routes
app.use('*', notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;