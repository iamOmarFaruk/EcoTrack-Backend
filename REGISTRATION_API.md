# User Registration API Documentation

## Register New User

Registers a new user by saving Firebase user data to MongoDB database. **Fully supports Google Sign-in** with automatic profile data extraction.

### Endpoint
```
POST /api/auth/register
```

### Description
This endpoint allows you to register users from your frontend application by saving their Firebase authentication data to your MongoDB database. The user must be authenticated with Firebase first, then you send their data to this endpoint to create their profile in your database.

**🔥 Google Sign-in Support**: When users sign in with Google, the endpoint automatically extracts profile information (name, photo, email) from Firebase, making manual data entry optional.

### Request Headers
```
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idToken` | string | **Yes** | Firebase ID token from authenticated user |
| `displayName` | string | **No*** | User's display name (2-50 characters) |
| `photoURL` | string | No | User's profile image URL (must be valid URL) |
| `bio` | string | No | User's bio/description (max 300 characters) |
| `location` | string | No | User's location (max 100 characters) |

**\*Note**: `displayName` is technically optional because it can be automatically extracted from Google authentication. If not provided, the system will use Google profile data as fallback.

### Google Sign-in Data Extraction

When users authenticate with Google, the backend automatically extracts profile data with the following priority:

#### Display Name Priority:
1. `displayName` from request body (if provided)
2. Google display name from Firebase user record
3. Google name from Firebase token
4. Username part of email (before @)
5. "User" (final fallback)

#### Photo URL Priority:
1. `photoURL` from request body (if provided)  
2. Google photo URL from Firebase user record
3. Google picture from Firebase token
4. `null` (no photo)

### Example Requests

#### Standard Registration (Manual Data)
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzM...",
  "displayName": "John Doe",
  "photoURL": "https://example.com/user-avatar.jpg",
  "bio": "Passionate about environmental conservation",
  "location": "San Francisco, CA"
}
```

#### Google Sign-in (Automatic Profile Extraction)
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzM..."
  // That's it! Name and photo will be extracted from Google profile
}
```

#### Google Sign-in (Partial Override)
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzM...",
  "bio": "Custom bio that overrides Google data",
  "location": "Custom location"
  // displayName and photoURL will be extracted from Google
}
```

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "displayName": "John Doe",
      "email": "john.doe@example.com",
      "photoURL": "https://example.com/user-avatar.jpg",
      "bio": "Passionate about environmental conservation",
      "location": "San Francisco, CA",
      "preferences": {
        "privacy": "public",
        "notifications": {
          "email": true,
          "push": true,
          "challenges": true,
          "tips": true,
          "events": true
        }
      },
      "role": "user",
      "joinedAt": "2024-11-13T10:30:00.000Z",
      "lastActive": "2024-11-13T10:30:00.000Z",
      "stats": {
        "challengesJoined": 0,
        "challengesCompleted": 0,
        "totalImpactPoints": 0,
        "eventsAttended": 0,
        "tipsShared": 0,
        "streak": 0
      }
    },
    "firebase": {
      "uid": "firebase-user-uid",
      "email": "john.doe@example.com",
      "emailVerified": true
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "displayName",
        "message": "Display name is required",
        "value": ""
      }
    ]
  }
}
```

#### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "error": {
    "message": "Invalid Firebase token",
    "code": "INVALID_TOKEN"
  }
}
```

#### 409 Conflict - User Already Exists
```json
{
  "success": false,
  "error": {
    "message": "User already registered in database",
    "code": "USER_ALREADY_EXISTS"
  },
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "displayName": "John Doe",
      "email": "john.doe@example.com",
      "photoURL": "https://example.com/user-avatar.jpg",
      "joinedAt": "2024-11-13T10:30:00.000Z"
    }
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "message": "Failed to register user",
    "code": "REGISTRATION_FAILED"
  }
}
```

## Frontend Integration Example

### Google Sign-in Integration (Recommended)
```javascript
import { GoogleAuthProvider, signInWithPopup, getIdToken } from 'firebase/auth';
import { auth } from './firebase-config';

async function signInWithGoogle() {
  try {
    // 1. Sign in with Google
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // 2. Get the ID token
    const idToken = await getIdToken(result.user);
    
    // 3. Register user in your backend (minimal approach)
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: idToken
        // Optional: Add custom bio/location
        // bio: 'Custom user bio',
        // location: 'Custom location'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ User registered with Google profile:', result.data.user);
      // User profile automatically populated from Google
      window.location.href = '/dashboard';
    } else if (result.error.code === 'USER_ALREADY_EXISTS') {
      console.log('ℹ️ User already registered, logging in...');
      window.location.href = '/dashboard';
    } else {
      console.error('❌ Registration failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Google sign-in failed:', error);
  }
}
```

### Traditional Email/Password Registration
```javascript
import { createUserWithEmailAndPassword, getIdToken } from 'firebase/auth';
import { auth } from './firebase-config';

async function registerWithEmail(userData) {
  try {
    // 1. Create Firebase account
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      userData.email, 
      userData.password
    );
    
    // 2. Get the ID token
    const idToken = await getIdToken(userCredential.user);
    
    // 3. Send user data to your backend
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: idToken,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        bio: userData.bio,
        location: userData.location
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ User registered successfully:', result.data.user);
      window.location.href = '/dashboard';
    } else {
      console.error('❌ Registration failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Registration error:', error);
  }
}
```

### cURL Example
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "your-firebase-id-token",
    "displayName": "John Doe",
    "photoURL": "https://example.com/avatar.jpg",
    "bio": "Environmental enthusiast",
    "location": "San Francisco, CA"
  }'
```

## Flow Diagram

1. **Frontend**: User signs up/signs in with Firebase Auth
2. **Frontend**: Gets Firebase ID token
3. **Frontend**: Sends user data + ID token to `/api/auth/register`
4. **Backend**: Verifies Firebase token
5. **Backend**: Checks if user already exists in MongoDB
6. **Backend**: Creates user profile in MongoDB
7. **Backend**: Returns user profile data
8. **Frontend**: User is now registered and can use the app

## Notes

- Users are automatically created with default preferences and zero stats
- The `firebaseUid` is stored internally but not returned in API responses
- Email comes from the Firebase token, not the request body
- All fields except `idToken` and `displayName` are optional
- User roles default to "user"
- Privacy setting defaults to "public"