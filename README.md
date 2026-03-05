# Sahayak

Sahayak is a municipal complaint management system with a Node.js backend and Expo React Native mobile app.

## Features
- Complaint creation with photos and location
- Role-based flows: `user`, `worker`, `head`, `admin`
- Worker assignment (single and multi-worker)
- Worker completion photos + HOD approval/rework
- AI-assisted categorization and review
- Upvotes, citizen feedback, and satisfaction voting
- Dashboard and heatmap analytics
- PDF/Excel/CSV report export and scheduled email reports
- Push notifications (Expo) and email notifications (Resend)
- Worker invitation flow with expiring tokens

## Tech Stack
- Backend: Express, Mongoose, JWT, Cloudinary, Gemini/OpenAI, Resend
- Mobile: Expo Router, React Query, NativeWind, i18n

## Project Structure
- `backend/` API server
- `mobile/` React Native app

## Quick Start
### Backend
```bash
cd backend
npm install
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Required Environment
### `backend/.env`
```env
PORT=6000
MONGO_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:8081

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GEMINI_API_KEY=
OPENAI_API_KEY=

RESEND_API_KEY=
EMAIL_FROM="Sahayak <onboarding@resend.dev>"
APP_URL=http://localhost:3000
```

### `mobile/.env`
```env
EXPO_PUBLIC_API_URL=http://localhost:6000/api
```

## Optional
Seed sample data:
```bash
cd backend
node seedData.js
```
