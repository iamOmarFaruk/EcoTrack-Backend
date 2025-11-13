/**
 * Test script for user registration endpoint
 * Run this after starting the server to test the new /api/auth/register endpoint
 */

const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/auth/register`;

// Mock Firebase ID token (in real scenario, this comes from Firebase Auth)
const MOCK_TOKEN = 'mock-firebase-token-for-testing';

// Test cases
const testCases = [
  {
    name: 'Valid Registration',
    data: {
      idToken: MOCK_TOKEN,
      displayName: 'John Doe',
      photoURL: 'https://example.com/avatar.jpg',
      bio: 'Passionate about environmental conservation',
      location: 'San Francisco, CA'
    },
    expectedStatus: 201
  },
  {
    name: 'Registration without optional fields',
    data: {
      idToken: MOCK_TOKEN,
      displayName: 'Jane Smith'
    },
    expectedStatus: 201
  },
  {
    name: 'Missing required displayName',
    data: {
      idToken: MOCK_TOKEN,
      photoURL: 'https://example.com/avatar.jpg'
    },
    expectedStatus: 400
  },
  {
    name: 'Missing Firebase token',
    data: {
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.jpg'
    },
    expectedStatus: 400
  },
  {
    name: 'Invalid photo URL',
    data: {
      idToken: MOCK_TOKEN,
      displayName: 'Test User',
      photoURL: 'invalid-url'
    },
    expectedStatus: 400
  }
];

async function runTests() {
  console.log('🧪 Starting Registration Endpoint Tests\n');
  console.log(`Testing endpoint: ${API_URL}\n`);

  for (const testCase of testCases) {
    try {
      console.log(`📝 Test: ${testCase.name}`);
      console.log(`Data:`, JSON.stringify(testCase.data, null, 2));
      
      const response = await axios.post(API_URL, testCase.data, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Don't throw on non-2xx status codes
      });

      const status = response.status;
      const responseData = response.data;

      console.log(`Status: ${status} (Expected: ${testCase.expectedStatus})`);
      console.log('Response:', JSON.stringify(responseData, null, 2));

      if (status === testCase.expectedStatus) {
        console.log('✅ PASSED\n');
      } else {
        console.log('❌ FAILED - Status mismatch\n');
      }

    } catch (error) {
      console.log('❌ FAILED - Request error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('Make sure your server is running on', BASE_URL);
      }
      console.log('');
    }
  }
}

// Additional utility function to test with real Firebase token
function testWithRealToken(firebaseToken, userData) {
  console.log('🔥 Testing with real Firebase token...\n');
  
  const testData = {
    idToken: firebaseToken,
    ...userData
  };

  return axios.post(API_URL, testData, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('✅ Registration successful!');
    console.log('User created:', JSON.stringify(response.data, null, 2));
    return response.data;
  })
  .catch(error => {
    console.log('❌ Registration failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Request error:', error.message);
    }
    throw error;
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testWithRealToken
};