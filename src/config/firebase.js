// Firebase Admin SDK Configuration (env-only, no JSON file)
const admin = require('firebase-admin');

let firebaseInitialized = false;

// Check if Firebase credentials are configured (not placeholders)
function hasValidFirebaseCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    return false;
  }

  // Check if credentials are placeholders
  if (projectId === 'your-project-id' ||
      privateKey.includes('REPLACE_WITH_YOUR_ACTUAL_PRIVATE_KEY') ||
      clientEmail.includes('xxxxx')) {
    return false;
  }

  return true;
}

// Initialize Firebase Admin SDK
function initializeFirebase() {
  // Skip Firebase initialization if credentials are not configured
  if (!hasValidFirebaseCredentials()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  Firebase credentials not configured - running without Firebase');
      console.log('💡 To enable Firebase, set valid FIREBASE_* environment variables');
      console.log('   Admin panel will still work, but user authentication features will be disabled');
      return null;
    } else {
      console.error('❌ Firebase credentials required in production');
      throw new Error('Firebase credentials not configured');
    }
  }

  if (admin.apps.length === 0) {
    try {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      firebaseInitialized = true;
      console.log('🔥 Firebase Admin SDK initialized successfully');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Firebase initialization failed - running without Firebase');
        console.log('   Error:', error.message);
        return null;
      } else {
        throw error;
      }
    }
  }
  return admin;
}

// Verify Firebase ID token
async function verifyIdToken(idToken) {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized - user authentication is disabled');
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase token:', error.message);
    throw new Error('Invalid Firebase token');
  }
}

// Get user by UID
async function getUserByUid(uid) {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized');
  }
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error fetching user:', error.message);
    throw new Error('User not found');
  }
}

// Create custom token
async function createCustomToken(uid, additionalClaims = {}) {
  try {
    const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    console.error('Error creating custom token:', error.message);
    throw new Error('Failed to create custom token');
  }
}

// Set custom user claims
async function setCustomUserClaims(uid, customClaims) {
  try {
    await admin.auth().setCustomUserClaims(uid, customClaims);
    console.log(`Custom claims set for user ${uid}:`, customClaims);
  } catch (error) {
    console.error('Error setting custom claims:', error.message);
    throw new Error('Failed to set custom claims');
  }
}

// List all users (admin function)
async function listUsers(maxResults = 1000) {
  try {
    const listUsersResult = await admin.auth().listUsers(maxResults);
    return listUsersResult.users;
  } catch (error) {
    console.error('Error listing users:', error.message);
    throw new Error('Failed to list users');
  }
}

// Delete user
async function deleteUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
    console.log(`User ${uid} deleted successfully`);
  } catch (error) {
    console.error('Error deleting user:', error.message);
    throw new Error('Failed to delete user');
  }
}

module.exports = {
  initializeFirebase,
  verifyIdToken,
  getUserByUid,
  createCustomToken,
  setCustomUserClaims,
  listUsers,
  deleteUser,
  admin: () => admin,
  isFirebaseInitialized: () => firebaseInitialized
};