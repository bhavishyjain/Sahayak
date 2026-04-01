# Sahayak

Sahayak is a multi-role municipal grievance management platform with a Node/Express backend and an Expo React Native mobile app. Citizens raise civic complaints with text, photos, and location; workers execute field tasks; Heads of Department route and supervise work; and admins manage departments, special requests, deleted complaints, broadcasts, and platform health.

This README is written from the current backend implementation, not from a wishlist. It is meant to help with:

- local setup
- backend onboarding
- data model orientation
- role and workflow understanding
- seeding and test account usage
- route and service discovery

For backlog and product gaps, see [`FUTURE.md`](/Users/bhavishyjain/Documents/GitHub/Sahayak/FUTURE.md).

## What The System Does

At a high level, Sahayak manages the complaint lifecycle end to end:

1. A citizen submits a complaint with description, proof images, and location.
2. The backend stores AI analysis such as department suggestion, urgency, confidence, and priority hints.
3. A complaint enters departmental workflow.
4. HOD users assign one or more workers.
5. Workers move work forward, upload completion photos, and submit for approval.
6. HOD users approve, reject for rework, or otherwise update routing.
7. Citizens track updates, use complaint chat, upvote nearby complaints, submit feedback, and vote on satisfaction.
8. Admins supervise special requests, deleted complaints, departments, reports, and system-wide notification flows.

## Roles

### Citizen (`user`)

Citizens can:

- register, log in, refresh auth, reset password, and verify email
- create complaints with media and coordinates
- view their own complaints
- browse nearby complaints
- upvote complaints
- open complaint detail, history, feedback, assignment, and SLA views
- send complaint messages
- submit post-resolution feedback
- vote thumbs up/down on resolved complaints
- use the assistant/chat flow for complaint registration and complaint lookup

### Worker (`worker`)

Workers can:

- view assigned and completed complaint queues
- start work and update complaint status where policy allows
- upload completion photos
- participate in complaint chat
- view worker dashboard and analytics
- see ratings/performance metrics

Important workflow rule:

- when multiple workers are assigned, one worker is the leader
- only the leader is intended to drive shared status transitions

### Head Of Department (`head`)

HOD users can:

- review department complaints and analytics
- assign one or more workers
- update task descriptions
- approve completion
- send work back for rework
- cancel complaints where policy allows
- review AI suggestions
- manage worker invitations
- send special requests to admin
- export reports, email reports, and schedule recurring reports

### Admin (`admin`)

Admins can:

- manage users
- manage departments
- review special requests from HODs
- soft delete, restore, and purge complaints
- manage festival events
- broadcast notifications
- access admin dashboards, recycle bin flows, and reports

## Repository Layout

```text
Sahayak/
├── backend/
│   ├── app.js
│   ├── bin/www
│   ├── config/
│   ├── controllers/
│   ├── core/
│   ├── domain/
│   ├── middlewares/
│   ├── models/
│   ├── policies/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   └── seedData.js
├── mobile/
│   ├── app/
│   ├── assets/
│   ├── components/
│   ├── data/
│   ├── utils/
│   └── url.js
├── README.md
└── FUTURE.md
```

## Tech Stack

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- JWT auth with refresh-token rotation
- Cloudinary for media uploads
- Resend for email
- Gemini / AI-assisted analysis and assistant flows
- Expo push notifications
- WebSocket realtime with `ws`
- `node-cron` for background jobs
- Excel / PDF / CSV report generation

### Mobile

- Expo
- React Native
- Expo Router
- TanStack Query
- AsyncStorage
- Expo Notifications
- Expo Image Picker / camera flows
- i18n-backed localization

## Backend Boot Flow

### `backend/app.js`

The Express app is responsible for:

- security middleware via `helmet`
- CORS and allowed-origin handling
- cookie parsing
- JSON / URL-encoded body parsing
- Mongo query sanitization
- deep-link bridge routes for mobile app handoff
- API route mounting under `/api`
- not-found and centralized error middleware

It also supports:

- Render keepalive self-ping when `SELF_PING_URL` is configured
- Apple App Site Association and Android Asset Links endpoints

### `backend/bin/www`

The server bootstrap file:

- connects MongoDB
- starts the realtime WebSocket server
- starts event-priority background updates
- starts SLA escalation job
- initializes report schedules
- starts the HTTP server

## Environment Variables

The backend currently reads these environment variables:

### Required for core backend

- `MONGO_URI`
- `JWT_SECRET`

### Auth / tokens

- `JWT_ACCESS_EXPIRES_IN` (default `15m`)
- `REFRESH_TOKEN_DAYS` (default `30`)

### CORS / runtime

- `NODE_ENV`
- `PORT`
- `ALLOWED_ORIGINS`
- `SELF_PING_URL`

### Deep links / mobile linking

- `APP_LINK_BASE_URL`
- `IOS_APP_APPLE_ID`
- `ANDROID_APP_PACKAGE`
- `ANDROID_APP_SHA256_CERT_FINGERPRINTS`

### Email

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`

### Media

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### AI / assistant

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `STT_PROVIDER`

### Reports / scheduled jobs

- `REPORT_SCHEDULE_TIMEZONE`
- `REPORT_MAX_ROWS`
- `PDF_REPORT_MAX_ROWS`
- `EXCEL_REPORT_MAX_ROWS`
- `CSV_REPORT_MAX_ROWS`
- `REPORT_CACHE_TTL_MS`

### SLA / recurring jobs

- `ENABLE_SLA_ESCALATION_JOB`
- `SLA_ESCALATION_RUN_ON_STARTUP`
- `EVENT_TIMEZONE`

### Optional seed controls

The seed script now supports:

- `SEED_ADMIN_COUNT`
- `SEED_WORKERS_PER_DEPARTMENT`
- `SEED_CITIZEN_COUNT`
- `SEED_TOTAL_COMPLAINTS`

## Local Setup

### Backend

```bash
cd /Users/bhavishyjain/Documents/GitHub/Sahayak/backend
npm install
```

Create a `.env` file with at least:

```env
MONGO_URI=mongodb://127.0.0.1:27017/sahayak
JWT_SECRET=replace_me
NODE_ENV=development
PORT=3000
APP_LINK_BASE_URL=http://localhost:3000
REPORT_SCHEDULE_TIMEZONE=Asia/Kolkata
```

Run the backend:

```bash
npm run dev
```

### Mobile

The mobile app lives in [`mobile`](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile). It expects the backend URLs configured in the mobile project and Expo environment to point to your running API.

## Seeding The Database

The backend includes a large realism-oriented seed script at [`backend/seedData.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/seedData.js).

Run it with:

```bash
cd /Users/bhavishyjain/Documents/GitHub/Sahayak/backend
npm run seed
```

### What the seed creates

The seed currently creates:

- departments
- admins
- HODs
- workers with performance data and work locations
- citizens with varied preferred languages and notification preferences
- complaints across realistic statuses and departments
- AI complaint analysis metadata
- proof images and completion photos
- complaint history timelines
- feedback and satisfaction votes
- complaint chat threads
- soft-deleted complaints for recycle-bin flows
- special requests in pending / approved / rejected states
- worker invitations in pending / accepted / revoked / expired states
- festival events
- report schedules
- notification history
- admin broadcast history

### Default seed credentials

```text
Admin:    admin1         / password123
HOD:      hod_road       / password123
Worker:   worker_road_1  / password123
Citizen:  user1          / password123
```

### Optional seed scaling

Example:

```bash
SEED_TOTAL_COMPLAINTS=500 SEED_CITIZEN_COUNT=80 npm run seed
```

## Data Model Overview

### `User`

Key fields:

- auth identity: `username`, `email`, `password`
- role: `user`, `worker`, `head`, `admin`
- profile/contact: `fullName`, `phone`
- activation/auth control: `isActive`, `tokenValidFrom`
- email verification and password reset token hashes
- refresh tokens per device/session
- push tokens
- role-aware notification preferences
- `preferredLanguage`
- worker-specific metrics and work location

### `Complaint`

Key fields:

- `ticketId`
- `userId`
- `rawText`, `refinedText`
- `department`
- `coordinates`, `locationName`
- `priority`, `status`
- `assignedWorkers`, `assignedAt`, `assignedBy`
- `completionPhotos`, `proofImage`
- `upvotes`, `upvoteCount`
- `feedback`
- `satisfactionVotes`
- `sla`
- `history`
- `chatHistory`
- `messages`
- soft-delete flags: `deleted`, `deletedAt`

The complaint model also:

- auto-generates `ticketId`
- auto-computes initial SLA due date
- clears AI suggested priority once a complaint leaves pending state
- hides soft-deleted complaints from normal `find` and `aggregate` queries unless opted in

### Other Important Models

- [`Notification`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/Notification.js)
- [`AdminNotificationBroadcast`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/AdminNotificationBroadcast.js)
- [`ComplaintSpecialRequest`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/ComplaintSpecialRequest.js)
- [`ComplaintMessage`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/ComplaintMessage.js)
- [`ReportSchedule`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/ReportSchedule.js)
- [`WorkerInvitation`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/WorkerInvitation.js)
- [`Department`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/Department.js)
- [`FestivalEvent`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/FestivalEvent.js)

## Route Map

All backend routes are mounted under `/api`.

### Authentication

Mounted from [`backend/routes/authRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/authRoutes.js)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `DELETE /api/auth/me`
- `POST /api/auth/accept-invite`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `GET /api/auth/verify-email/:token`
- `POST /api/auth/resend-verification`

Includes rate limiting on login/refresh/reset-related endpoints.

### Complaints

Mounted from [`backend/routes/complaintRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/complaintRoutes.js)

- citizen complaint creation and self views
- nearby complaints
- complaint detail
- upvotes
- feedback
- AI review endpoints for HOD/admin
- worker completion photo upload
- satisfaction votes
- complaint message thread
- admin special request review endpoints
- admin delete / restore / purge / update routes

### Worker

Mounted from [`backend/routes/workerRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/workerRoutes.js)

Includes assignment lists, status changes, worker analytics, and worker-facing operations.

### HOD

Mounted from [`backend/routes/hodRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/hodRoutes.js)

Includes:

- department queue views
- worker assignment
- workflow changes
- analytics
- invitation management

### Notifications

Mounted from [`backend/routes/notificationRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/notificationRoutes.js)

- register Expo push token
- notification history
- mark read / mark all read
- role-aware notification preferences
- admin broadcast history
- admin custom broadcast send

### Reports

Mounted from [`backend/routes/reportRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/reportRoutes.js)

- Excel / PDF / CSV exports
- dashboard stats
- department breakdown
- email report send
- schedule create/list
- schedule run-now
- schedule cancel

### Chat / Assistant

Mounted from [`backend/routes/chatRoutes.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/chatRoutes.js)

Supports:

- assistant message handling
- multilingual complaint registration assistance
- speech transcription integration
- complaint lookup and status flows

### Other Route Groups

- [`/api/analytics`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/analyticsRoutes.js)
- [`/api/users`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/users.js)
- [`/api/departments`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/departments.js)
- [`/api/festival-events`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/festivalEventRoutes.js)

## Important Services

### Complaint workflow and list/query services

- [`complaintService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintService.js)
- [`complaintWorkflowService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintWorkflowService.js)
- [`complaintAssignmentService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintAssignmentService.js)
- [`complaintQueryService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintQueryService.js)
- [`complaintListService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintListService.js)
- [`complaintLookupService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintLookupService.js)
- [`complaintAnalyticsService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintAnalyticsService.js)
- [`complaintAudienceService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintAudienceService.js)
- [`complaintEventService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintEventService.js)

### Auth / access / provisioning

- [`authService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/authService.js)
- [`accessService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/accessService.js)
- [`userProvisionService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/userProvisionService.js)

### Media, reports, notifications, realtime

- [`mediaUploadService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/mediaUploadService.js)
- [`completionPhotoService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/completionPhotoService.js)
- [`reportService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportService.js)
- [`reportViewService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportViewService.js)
- [`reportPolicyService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportPolicyService.js)
- [`reportSchedulerService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportSchedulerService.js)
- [`notificationDomainService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/notificationDomainService.js)
- [`notificationDeliveryService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/notificationDeliveryService.js)
- [`pushNotificationService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/pushNotificationService.js)
- [`realtimeService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/realtimeService.js)

### AI / assistant / analytics

- [`geminiService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/geminiService.js)
- [`chatAssistantService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/chatAssistantService.js)
- [`analyticsMetricsService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/analyticsMetricsService.js)
- [`workerMetricsService.js`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/workerMetricsService.js)

## Workflow Notes

### Complaint statuses

The backend recognizes these main complaint statuses:

- `pending`
- `assigned`
- `in-progress`
- `pending-approval`
- `needs-rework`
- `resolved`
- `cancelled`

### Soft delete behavior

Admin deletes are soft deletes first. Soft-deleted complaints:

- are excluded by default from normal complaint queries
- can be restored by admin
- can be permanently purged
- can generate admin recycle-bin notifications

### Special requests

HOD users can raise special requests for admin review. These can ask to:

- update department/priority routing
- delete a complaint

Admin review outcomes are tracked and seeded in the database.

### AI review

Complaints store AI analysis, including:

- department suggestion
- confidence
- sentiment
- urgency
- keywords
- suggested priority while pending

There are dedicated HOD/admin review endpoints for AI-assisted routing correction.

## Notifications

The system supports:

- in-app persisted notification history
- realtime notification emission
- Expo push delivery
- role-scoped notification preferences
- admin broadcast notifications

Current preference model is role-aware:

- citizens, workers, heads: complaint updates / assignments / escalations / system alerts
- admins: special requests / deleted complaints

## Reports

Reports support:

- PDF / Excel / CSV generation
- dashboard stats
- department breakdowns
- direct email sending
- recurring schedules with health data
- rolling date-range presets such as past 24 hours / 7 days / 30 days

## Assistant / Chat

The assistant backend supports:

- multilingual user messages
- complaint registration guidance
- complaint status lookup
- complaint lookup by ticket ID
- speech transcription metadata
- in-progress complaint continuation through conversation history
- enforcement of complaint registration requirements such as location and proof images

## Background Jobs

The backend starts these recurring/background behaviors:

- SLA escalation job
- event priority updater
- report schedule initialization / execution
- optional self-ping keepalive cron

## Mobile Notes

The mobile app is route-first and role-aware.

Important mobile areas:

- [`mobile/app/(app)/(tabs)`](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/(tabs))
- [`mobile/app/(app)/complaints`](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/complaints)
- [`mobile/app/(app)/more`](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/more)
- [`mobile/components`](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/components)
- [`mobile/utils`](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/utils)

The mobile app includes:

- push token registration
- notification preference settings
- complaint feed and detail flows
- assistant screen
- worker, HOD, and admin dashboards
- export/report flows
- bilingual English/Hindi localization, with broader multilingual support in assistant/backend workflows

## Suggested Dev Workflow

For a fresh local setup:

1. Start MongoDB.
2. Configure backend `.env`.
3. Run `npm install` in [`backend`](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend).
4. Run `npm run seed`.
5. Run `npm run dev`.
6. Start the Expo mobile app and log in with one of the seeded accounts.

## Troubleshooting

### Seed fails immediately

Check:

- `MONGO_URI` exists
- MongoDB is running
- the database user has write access

### Push notifications do not arrive

Check:

- mobile Expo project ID is configured
- the device granted notification permission
- the backend received and stored push tokens
- Expo/FCM credentials are set correctly for Android builds

### Email features do not send

Check:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- optional `EMAIL_REPLY_TO`

### Media uploads fail

Check:

- Cloudinary environment variables
- network access from backend runtime
- payload file count and multipart form shape

## Current Documentation Boundaries

This README focuses on the implemented backend and the key mobile integration points. It does not attempt to document every controller function line by line, but it should give you enough to:

- boot the system
- seed realistic data
- understand the role model
- navigate the backend structure
- find the right file quickly when debugging or extending a feature
