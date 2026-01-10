# EcoTrack Backend API

Express + MongoDB API for the EcoTrack app. It handles authentication, challenges, events, tips, user profiles, and admin moderation.

Live API: https://eco-track-backend-delta.vercel.app/api/
Frontend: https://eco-track-peach.vercel.app

## Features
- Firebase ID token verification for user endpoints
- CRUD for challenges, events, and tips
- User profiles, stats, and activity history
- Admin login with cookie-based JWT and moderation tools
- Validation, rate limiting, and security headers

## Tech stack
- Node.js 16+, Express 4
- MongoDB + Mongoose
- Firebase Admin SDK
- Joi + Express Validator
- Helmet, express-rate-limit, express-mongo-sanitize, xss, cors, morgan

## Local setup
1. `cd EcoTrack-Backend`
2. `npm install`
3. `cp .env.example .env`
4. Fill in the required values:
   - `MONGODB_URI`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `ADMIN_PASSWORD_HASH`

   Common config:
   - `PORT` (defaults to 5001)
   - `FRONTEND_URL` and `FRONTEND_PRODUCTION_URL` for CORS
   - `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_JWT_SECRET`, `ADMIN_JWT_EXPIRY_HOURS`
   - `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`
   - `COOKIE_DOMAIN`
5. `npm run dev`

## API overview
Base URL: `/api`

Resources:
- `/auth` (verify token, register, current user)
- `/challenges`
- `/events`
- `/tips` (includes `/trending` and `/:id/upvote`)
- `/users` (profiles, stats, activity)
- `/admin` (login, dashboard, moderation)
- `/site/content` (public site content)

### Authentication
Protected endpoints expect a Firebase ID token:
```
Authorization: Bearer <firebase_id_token>
```

Admin endpoints use an `admin_token` httpOnly cookie set by `/api/admin/login`.

## Utility scripts
- `node scripts/initChallengeIndexes.js`
- `node scripts/initEventIndexes.js`
- `node scripts/initTipIndexes.js`
- `node scripts/migrateChallenges.js`

## Scripts
- `npm run dev`
- `npm start`

## Author
Omar Faruk
- Portfolio: https://omarfaruk.dev
- LinkedIn: https://www.linkedin.com/in/omar-expert-webdeveloper/
