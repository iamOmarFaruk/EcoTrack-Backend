// Firebase Admin SDK Configuration (env-only, no JSON file)
const admin = require('firebase-admin');

// Build service account from environment variables only
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
  console.error('❌ Firebase env vars missing. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
  throw new Error('Firebase credentials not configured');
}

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

console.log('✅ Firebase credentials loaded from environment variables');

// Initialize Firebase Admin SDK
function initializeFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('🔥 Firebase Admin SDK initialized successfully');
  }
  return admin;
}

// Verify Firebase ID token
async function verifyIdToken(idToken) {
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
  admin: () => admin
};