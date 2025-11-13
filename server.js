require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 EcoTrack API Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📋 Available API endpoints:');
    console.log(`   GET    /api/challenges     - List all challenges`);
    console.log(`   GET    /api/tips          - List all tips`);
    console.log(`   GET    /api/events        - List all events`);
    console.log(`   GET    /api/users/profile - Get user profile`);
    console.log(`   GET    /api/stats/community - Community statistics`);
    console.log('\n📖 Full API documentation available in BACKEND_SPECIFICATION.txt\n');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});