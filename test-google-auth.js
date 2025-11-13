/**
 * Test script for Google Authentication Registration
 * This simulates the registration flow when users sign in with Google
 */

const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';
const API_URL = `${BASE_URL}/api/auth/register`;

console.log('🔍 Google Authentication Registration Test\n');
console.log(`Testing endpoint: ${API_URL}\n`);

// Test cases for Google authentication scenarios
const googleAuthTestCases = [
  {
    name: '✅ Google Sign-in - Complete data provided',
    description: 'User signs in with Google and provides complete profile data',
    data: {
      idToken: 'mock-google-firebase-token',
      displayName: 'John Doe',
      photoURL: 'https://lh3.googleusercontent.com/user-photo.jpg',
      bio: 'Environmental activist from Google auth',
      location: 'Mountain View, CA'
    },
    expectedStatus: 201,
    notes: 'This simulates when frontend sends complete data along with Google token'
  },
  {
    name: '✅ Google Sign-in - Only token (no extra data)',
    description: 'User signs in with Google, relying on Firebase token data',
    data: {
      idToken: 'mock-google-firebase-token'
      // No displayName, photoURL - should be extracted from token
    },
    expectedStatus: 201,
    notes: 'This simulates when frontend only sends token, expecting backend to extract profile data'
  },
  {
    name: '✅ Google Sign-in - Partial data override',
    description: 'User signs in with Google but overrides some profile data',
    data: {
      idToken: 'mock-google-firebase-token',
      displayName: 'Custom Display Name', // Override Google name
      bio: 'Custom bio text',
      location: 'Custom Location'
      // photoURL not provided - should use Google photo
    },
    expectedStatus: 201,
    notes: 'Frontend can override specific fields while using Google defaults for others'
  },
  {
    name: '✅ Google Sign-in - Empty strings handled',
    description: 'User signs in with Google with empty string values',
    data: {
      idToken: 'mock-google-firebase-token',
      displayName: '', // Empty - should fallback to Google data
      photoURL: '',   // Empty - should fallback to Google data
      bio: '',
      location: ''
    },
    expectedStatus: 201,
    notes: 'Empty strings should trigger fallback to Google profile data'
  }
];

async function testGoogleAuthRegistration() {
  console.log('🧪 Testing Google Authentication Registration Scenarios\n');

  for (let i = 0; i < googleAuthTestCases.length; i++) {
    const testCase = googleAuthTestCases[i];
    console.log(`📝 Test ${i + 1}: ${testCase.name}`);
    console.log(`📄 Description: ${testCase.description}`);
    console.log(`📋 Notes: ${testCase.notes}`);
    console.log(`📨 Request Data:`, JSON.stringify(testCase.data, null, 2));

    try {
      const response = await axios.post(API_URL, testCase.data, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Don't throw on non-2xx status codes
      });

      const status = response.status;
      const responseData = response.data;

      console.log(`📊 Status: ${status} (Expected: ${testCase.expectedStatus})`);
      console.log(`📋 Response:`, JSON.stringify(responseData, null, 2));

      if (status === testCase.expectedStatus) {
        if (status === 201 && responseData.success) {
          console.log(`✅ SUCCESS - User registered with:`);
          console.log(`   - Name: ${responseData.data.user.displayName}`);
          console.log(`   - Email: ${responseData.data.user.email}`);
          console.log(`   - Photo: ${responseData.data.user.photoURL || 'None'}`);
          console.log(`   - Bio: ${responseData.data.user.bio || 'None'}`);
          console.log(`   - Location: ${responseData.data.user.location || 'None'}`);
        } else {
          console.log('✅ EXPECTED RESPONSE RECEIVED');
        }
      } else {
        console.log('❌ FAILED - Status mismatch');
      }

    } catch (error) {
      console.log('❌ FAILED - Request error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 Make sure your server is running on', BASE_URL);
      }
    }

    console.log('\n' + '─'.repeat(80) + '\n');
  }
}

// Frontend integration example for Google Sign-in
function showFrontendExample() {
  console.log('📱 Frontend Integration Example for Google Sign-in:\n');
  
  const frontendCode = `
// 1. Set up Google Sign-in
import { GoogleAuthProvider, signInWithPopup, getIdToken } from 'firebase/auth';
import { auth } from './firebase-config';

async function signInWithGoogle() {
  try {
    // Sign in with Google
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // Get the ID token
    const idToken = await getIdToken(result.user);
    
    // Register user in your backend
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: idToken,
        // Optional: Override Google profile data
        // displayName: 'Custom Name',
        // photoURL: 'custom-photo-url',
        // bio: 'Custom bio',
        // location: 'Custom location'
      })
    });
    
    const userData = await response.json();
    
    if (userData.success) {
      console.log('✅ User registered:', userData.data.user);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      if (userData.error.code === 'USER_ALREADY_EXISTS') {
        console.log('ℹ️ User already registered, logging in...');
        // Handle existing user
        window.location.href = '/dashboard';
      } else {
        console.error('❌ Registration failed:', userData.error);
        // Show error to user
      }
    }
    
  } catch (error) {
    console.error('❌ Google sign-in failed:', error);
  }
}

// 2. Alternative: Minimal approach (let backend handle everything)
async function signInWithGoogleMinimal() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await getIdToken(result.user);
    
    // Just send the token, backend extracts all profile data
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    const userData = await response.json();
    if (userData.success) {
      console.log('✅ Auto-registered with Google profile');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}
`;

  console.log(frontendCode);
}

// Data extraction examples
function showDataExtractionExamples() {
  console.log('🔍 How the backend extracts Google profile data:\n');
  
  const examples = `
When a user signs in with Google, Firebase provides rich profile data:

1. From Firebase ID Token (decodedToken):
   - decodedToken.name → User's full name
   - decodedToken.picture → User's profile photo
   - decodedToken.email → User's email
   - decodedToken.uid → Unique Firebase user ID

2. From Firebase User Record (firebaseUserRecord):
   - firebaseUserRecord.displayName → User's display name
   - firebaseUserRecord.photoURL → User's profile photo
   - firebaseUserRecord.email → User's email

3. Fallback Priority for displayName:
   1. displayName from request body (if provided)
   2. firebaseUserRecord.displayName (from Google)
   3. decodedToken.name (from Google)
   4. email.split('@')[0] (username part)
   5. 'User' (final fallback)

4. Fallback Priority for photoURL:
   1. photoURL from request body (if provided)
   2. firebaseUserRecord.photoURL (from Google)
   3. decodedToken.picture (from Google)
   4. null (no photo)

This ensures Google users get their profile automatically populated!
`;

  console.log(examples);
}

// Run tests if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      testGoogleAuthRegistration();
      break;
    case 'example':
      showFrontendExample();
      break;
    case 'data':
      showDataExtractionExamples();
      break;
    default:
      console.log('🎯 Google Auth Registration Test Utilities\n');
      console.log('Usage:');
      console.log('  node test-google-auth.js test     - Run registration tests');
      console.log('  node test-google-auth.js example  - Show frontend integration');
      console.log('  node test-google-auth.js data     - Show data extraction info');
      console.log('');
      testGoogleAuthRegistration();
      break;
  }
}

module.exports = {
  testGoogleAuthRegistration,
  showFrontendExample,
  showDataExtractionExamples
};