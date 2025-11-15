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
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const tipRoutes = require('./routes/tips');
const challengeRoutes = require('./routes/challenges');

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
          }
        ]
      },

      // Tips Management Routes
      tips: {
        description: 'Eco-friendly tips sharing and upvoting',
        baseRoute: '/api/tips',
        endpoints: [
          {
            method: 'GET',
            path: '/api/tips',
            description: 'Get all tips with pagination and filtering',
            access: 'Public',
            query: {
              page: 'number (default: 1)',
              limit: 'number (default: 20, max: 100)',
              sortBy: 'string (createdAt, upvoteCount)',
              order: 'string (asc, desc)',
              search: 'string (text search)',
              authorId: 'string (filter by author)'
            }
          },
          {
            method: 'GET',
            path: '/api/tips/trending',
            description: 'Get trending tips (most upvoted recently)',
            access: 'Public',
            query: {
              days: 'number (default: 7, max: 30)',
              limit: 'number (default: 10, max: 50)'
            }
          },
          {
            method: 'GET',
            path: '/api/tips/my-tips',
            description: 'Get tips created by authenticated user',
            access: 'Private (requires authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            query: {
              page: 'number (default: 1)',
              limit: 'number (default: 20)',
              sortBy: 'string (createdAt, upvoteCount)',
              order: 'string (asc, desc)'
            }
          },
          {
            method: 'POST',
            path: '/api/tips',
            description: 'Create new tip',
            access: 'Private (requires authentication)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            body: {
              title: 'string (required, 5-100 chars)',
              content: 'string (required, 20-500 chars)'
            }
          },
          {
            method: 'PUT',
            path: '/api/tips/:id',
            description: 'Update tip (author only)',
            access: 'Private (tip author only)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (tip ID)' },
            body: {
              title: 'string (optional, 5-100 chars)',
              content: 'string (optional, 20-500 chars)'
            }
          },
          {
            method: 'PATCH',
            path: '/api/tips/:id',
            description: 'Partially update tip (author only)',
            access: 'Private (tip author only)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (tip ID)' },
            body: {
              title: 'string (optional, 5-100 chars)',
              content: 'string (optional, 20-500 chars)'
            }
          },
          {
            method: 'DELETE',
            path: '/api/tips/:id',
            description: 'Delete tip (author only)',
            access: 'Private (tip author only)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (tip ID)' }
          },
          {
            method: 'POST',
            path: '/api/tips/:id/upvote',
            description: 'Upvote a tip (max 100 times per user per tip)',
            access: 'Private (requires authentication, cannot upvote own tips)',
            headers: { Authorization: 'Bearer <firebase_token>' },
            params: { id: 'string (tip ID)' }
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
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/challenges', challengeRoutes);

// 404 handler for unknown routes
app.use('*', notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;