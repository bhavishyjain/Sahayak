# Sahayak

Sahayak is a multi-role municipal complaint management platform built as a Node.js/Express backend with an Expo React Native mobile application. It supports the full civic complaint lifecycle for citizens, municipal workers, Heads of Department, and administrators.

This README is based on the current implementation in this repository after a code-level scan of the backend, mobile app, routes, services, data models, scheduling jobs, notifications, and seed data.

## What The System Currently Does

- accepts civic complaints through manual forms and an assistant-guided chat flow
- supports multilingual voice and text complaint intake, including speech-to-text
- captures proof images, GPS coordinates, location names, department, and urgency context
- lets citizens browse public complaints separately from their own complaint history
- supports complaint details, timelines, complaint chat, assigned-worker visibility, upvotes, and post-resolution feedback
- gives workers assignment queues, completion flows, photo uploads, analytics, leaderboard views, trophies, and feedback history
- gives department heads complaint queues, worker management, AI review, assignment controls, approval/rework decisions, and reporting tools
- gives admins dashboards, department management, recycle-bin review, special-request review, broadcast notifications, and festival-event management
- delivers realtime events through WebSocket plus persisted in-app notifications
- supports Expo push token registration and role-based notification preferences
- exports complaint data as PDF, Excel, and CSV
- schedules recurring report emails with rolling time ranges such as past 24 hours, past 7 days, and past 30 days

## Repository Structure

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
│   ├── app.json
│   └── package.json
└── README.md
```

## Technology Stack

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- JWT-based auth with refresh token rotation
- `ws` for realtime communication
- Cloudinary for media storage
- Resend for email delivery
- Google Gemini-backed assistant processing
- `node-cron` for report scheduling, self-ping, and escalation jobs
- PDFKit, ExcelJS, and CSV generation for exports

### Mobile

- Expo
- React Native
- Expo Router
- TanStack Query
- AsyncStorage
- Expo Notifications
- Expo Image Picker
- Expo Location
- Expo AV / recording flows used by speech features
- NativeWind
- i18n-driven English and Hindi UI localization, with assistant-side multilingual responses extending beyond those two UI languages

## User Roles

### Citizen (`user`)

Citizens can:

- register, verify email, log in, refresh sessions, and reset passwords
- create complaints manually or through the assistant
- attach proof images and location coordinates
- browse complaint feeds and heatmaps
- open complaint details and complaint chat
- upvote complaints
- track assigned workers and complaint progress
- submit satisfaction feedback after resolution

### Worker (`worker`)

Workers can:

- view active and completed assignment lists
- update complaint progress based on workflow rules
- upload completion photos
- participate in complaint chat
- monitor performance analytics, ratings, trophies, and leaderboard placement
- review received citizen feedback

### Head of Department (`head`)

Heads can:

- review department complaint queues and overview analytics
- assign one or more workers to a complaint
- edit worker task details
- approve work, send work back for rework, or cancel where allowed
- review AI suggestion queues
- manage invitations and worker lists
- export reports, email reports, and manage report schedules
- raise special requests for admin review

### Admin (`admin`)

Admins can:

- manage departments and users
- review deleted complaints through recycle-bin flows
- review and act on special requests
- send role-targeted notification broadcasts
- manage festival events
- monitor high-level dashboards and department metrics

## Backend Architecture

### Bootstrap Flow

[app.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/app.js) is responsible for:

- loading environment variables
- applying security middleware such as `helmet`
- configuring CORS, cookies, request logging, JSON parsing, and mongo sanitization
- serving deep-link bridge pages for mobile invite, password reset, email verification, home, and complaint detail routes
- exposing `.well-known` endpoints for platform app-link verification
- mounting all API routes under `/api`
- falling through to centralized not-found and error middleware

[bin/www](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/bin/www) performs startup orchestration:

- database connection
- HTTP server startup
- realtime WebSocket initialization
- event priority updater startup
- SLA escalation job startup
- report scheduler initialization

### API Route Map

All API routes are mounted through [backend/routes/index.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/index.js).

- `/api/auth` via [backend/routes/authRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/authRoutes.js)
- `/api/complaints` via [backend/routes/complaintRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/complaintRoutes.js)
- `/api/analytics` via [backend/routes/analyticsRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/analyticsRoutes.js)
- `/api/notifications` via [backend/routes/notificationRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/notificationRoutes.js)
- `/api/chat` via [backend/routes/chatRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/chatRoutes.js)
- `/api/workers` via [backend/routes/workerRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/workerRoutes.js)
- `/api/hod` via [backend/routes/hodRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/hodRoutes.js)
- `/api/users` via [backend/routes/users.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/users.js)
- `/api/departments` via [backend/routes/departments.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/departments.js)
- `/api/reports` via [backend/routes/reportRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/reportRoutes.js)
- `/api/festival-events` via [backend/routes/festivalEventRoutes.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/routes/festivalEventRoutes.js)

### Key Backend Modules

Complaint domain and workflow:

- [backend/controllers/complaints/createReadController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/complaints/createReadController.js)
- [backend/controllers/complaints/messageController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/complaints/messageController.js)
- [backend/controllers/complaints/specialRequestController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/complaints/specialRequestController.js)
- [backend/services/complaintService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintService.js)
- [backend/services/complaintWorkflowService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintWorkflowService.js)
- [backend/services/complaintAssignmentService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintAssignmentService.js)
- [backend/services/complaintQueryService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintQueryService.js)
- [backend/services/complaintListService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintListService.js)
- [backend/services/complaintLookupService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintLookupService.js)
- [backend/services/complaintAnalyticsService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/complaintAnalyticsService.js)

Auth and account flows:

- [backend/controllers/authController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/authController.js)
- [backend/services/authService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/authService.js)
- [backend/services/userProvisionService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/userProvisionService.js)
- [backend/services/accessService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/accessService.js)

Notifications and realtime:

- [backend/controllers/notificationController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/notificationController.js)
- [backend/services/notificationDomainService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/notificationDomainService.js)
- [backend/services/notificationDeliveryService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/notificationDeliveryService.js)
- [backend/services/pushNotificationService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/pushNotificationService.js)
- [backend/services/realtimeService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/realtimeService.js)

Reports and scheduling:

- [backend/controllers/reports/exportController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/reports/exportController.js)
- [backend/controllers/reports/scheduleController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/reports/scheduleController.js)
- [backend/services/reportService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportService.js)
- [backend/services/reportPolicyService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportPolicyService.js)
- [backend/services/reportSchedulerService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportSchedulerService.js)
- [backend/services/reportViewService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/reportViewService.js)

Assistant and multilingual intake:

- [backend/controllers/chat/chatController.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/controllers/chat/chatController.js)
- [backend/services/chatAssistantService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/chatAssistantService.js)
- [backend/services/geminiService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/geminiService.js)

Worker metrics and analytics support:

- [backend/services/workerMetricsService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/workerMetricsService.js)
- [backend/services/workerLeaderboardService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/workerLeaderboardService.js)
- [backend/services/workerStatsService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/workerStatsService.js)

## Core Data Model

### Users

[backend/models/User.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/User.js) stores:

- account identity and credentials
- role and department linkage
- activation state
- refresh tokens
- email verification and password reset token metadata
- preferred language
- Expo push tokens
- notification preferences
- worker rating and worker performance-related fields

### Complaints

[backend/models/Complaint.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/Complaint.js) stores:

- `ticketId`
- citizen ownership
- title and description fields
- department and priority
- status lifecycle
- location name and coordinates
- proof images and completion photos
- worker assignments
- complaint history
- feedback and satisfaction metadata
- soft-delete metadata
- AI review metadata

### Supporting Models

- [backend/models/ComplaintMessage.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/ComplaintMessage.js)
- [backend/models/ComplaintSpecialRequest.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/ComplaintSpecialRequest.js)
- [backend/models/Notification.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/Notification.js)
- [backend/models/AdminNotificationBroadcast.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/AdminNotificationBroadcast.js)
- [backend/models/ReportSchedule.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/ReportSchedule.js)
- [backend/models/Invitation.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/Invitation.js)
- [backend/models/Department.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/Department.js)
- [backend/models/FestivalEvent.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/models/FestivalEvent.js)

## Complaint Workflow

### Status Values

The current backend status model is defined in [backend/domain/constants.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/domain/constants.js):

- `pending`
- `assigned`
- `in-progress`
- `pending-approval`
- `needs-rework`
- `resolved`
- `cancelled`

### End-To-End Flow

1. A citizen creates a complaint manually or through the assistant.
2. The backend validates required data and stores the complaint.
3. AI metadata may be attached during intake or later AI review.
4. HOD users review queues and assign one or more workers.
5. Workers update the complaint through field-progress states and upload completion evidence.
6. The HOD either approves the work, requests rework, or cancels where policy allows.
7. The citizen sees updates, receives notifications, and can submit post-resolution feedback.

### Special Requests And Recycle Bin

- HOD users can raise special requests for complaint deletion, department correction, or priority correction.
- Admin users review and approve or reject those requests.
- Complaint deletion is soft first, then restorable or permanently purgeable through recycle-bin flows.

### Assistant Behavior

The implemented assistant supports:

- speech-to-text intake
- multilingual language detection
- complaint registration continuation through chat history
- complaint status lookup by latest complaint or ticket ID
- complaint registration requirements for location and proof images
- same-language responses driven by detected or inferred conversation language

## Notifications, Push, And Realtime

### Notification Types

The backend currently handles:

- complaint updates
- worker assignments
- escalations
- chat-message notifications
- system broadcasts
- special-request notifications
- deleted-complaint notifications
- test and generic notification types

### Delivery Channels

Notifications may be:

- saved into in-app notification history
- emitted over WebSocket for realtime delivery
- sent to Expo push tokens

### Role-Based Preferences

[backend/services/notificationDomainService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/notificationDomainService.js) currently scopes preferences as follows:

- citizen, worker, and head users: `complaintsUpdates`, `assignments`, `escalations`, `systemAlerts`
- admin users: `specialRequests`, `deletedComplaints`

### Realtime

[backend/services/realtimeService.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/services/realtimeService.js) manages:

- authenticated WebSocket sessions
- user rooms
- complaint rooms
- complaint message broadcasts
- complaint update broadcasts
- notification event delivery

## Reports And Scheduling

Reports currently support:

- PDF export
- Excel export
- CSV export
- report stats and department breakdown views
- direct email sending
- recurring schedules with success and failure tracking

Important implementation details:

- rolling presets such as `24h`, `7d`, and `30d` are recalculated at execution time
- schedules are reloaded on backend startup
- report generation uses cache-backed helpers and configurable row limits
- report mail flows depend on working Resend sender/domain configuration

## Mobile Application Overview

The mobile app lives in [mobile](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile) and uses Expo Router route groups under [mobile/app](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app).

### Main Route Areas

- auth flows in [mobile/app/(app)/(auth)](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/(auth))
- main tab layouts in [mobile/app/(app)/(tabs)](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/(tabs))
- complaint flows in [mobile/app/(app)/complaints](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/complaints)
- shared settings, reports, notification, and admin utility pages in [mobile/app/(app)/more](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app/(app)/more)

### Major Mobile Features

- authentication, email verification, invitation acceptance, and password reset
- citizen complaint feed, my complaints, new complaint form, complaint details, and complaint chat
- assistant screen with voice input, image capture, and location capture
- heatmap and nearby complaint browsing
- worker dashboard, assignments, completed work, analytics, leaderboard, trophies, and feedback
- HOD overview, worker management, complaint approval flows, AI review, and reports
- admin dashboard, departments, recycle bin, complaint edit, and send-notification flows
- notification preferences and notification history

### Shared Mobile Building Blocks

- reusable UI components in [mobile/components](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/components)
- complaint status metadata in [mobile/data/complaintStatus.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/data/complaintStatus.js)
- feature hooks in [mobile/utils/hooks](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/utils/hooks)
- Expo and EAS config in [mobile/app.json](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app.json)

## Environment Variables

### Core Backend

- `MONGO_URI`
- `JWT_SECRET`
- `NODE_ENV`
- `PORT`

### Auth And Session

- `JWT_ACCESS_EXPIRES_IN`
- `REFRESH_TOKEN_DAYS`

### CORS And Runtime

- `ALLOWED_ORIGINS`
- `SELF_PING_URL`

### Deep Links

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

### AI And Speech

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `STT_PROVIDER`

### Reports And Jobs

- `REPORT_SCHEDULE_TIMEZONE`
- `REPORT_MAX_ROWS`
- `PDF_REPORT_MAX_ROWS`
- `EXCEL_REPORT_MAX_ROWS`
- `CSV_REPORT_MAX_ROWS`
- `REPORT_CACHE_TTL_MS`
- `ENABLE_SLA_ESCALATION_JOB`
- `SLA_ESCALATION_RUN_ON_STARTUP`
- `EVENT_TIMEZONE`

### Seed Controls

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

Create `backend/.env` with at least:

```env
MONGO_URI=mongodb://127.0.0.1:27017/sahayak
JWT_SECRET=replace_me
NODE_ENV=development
PORT=3000
APP_LINK_BASE_URL=http://localhost:3000
REPORT_SCHEDULE_TIMEZONE=Asia/Kolkata
```

Then start the backend:

```bash
npm run dev
```

### Mobile

```bash
cd /Users/bhavishyjain/Documents/GitHub/Sahayak/mobile
npm install
npm start
```

Useful mobile scripts:

- `npm run android`
- `npm run ios`
- `npm run lint`
- `npm run debug:android`
- `npm run staging:android`
- `npm run release:android`

## Seeding The Database

The project includes a realism-oriented seed script in [backend/seedData.js](/Users/bhavishyjain/Documents/GitHub/Sahayak/backend/seedData.js).

Run it with:

```bash
cd /Users/bhavishyjain/Documents/GitHub/Sahayak/backend
npm run seed
```

The seed currently creates:

- departments and admins
- HODs and workers per department
- citizens with varied languages and preferences
- complaints spread across departments, priorities, statuses, and dates
- complaint histories, messages, feedback, satisfaction votes, and notifications
- AI review records and routing suggestions
- report schedules
- special requests
- deleted complaints for recycle-bin flows
- invitations and admin notification broadcasts
- festival events
- worker leaderboard, trophies, and performance-supporting data

### Seeded Credentials

```text
Admin:    admin1         / password123
HOD:      hod_road       / password123
Worker:   worker_road_1  / password123
Citizen:  user1          / password123
```

### Optional Seed Scaling

```bash
SEED_TOTAL_COMPLAINTS=500 SEED_CITIZEN_COUNT=80 npm run seed
```

## Operational Notes

### Email Delivery

Verification emails, invitation emails, password reset emails, and report emails are sent through the shared Resend-based email service. If email consistently reaches only one inbox or fails for other users, verify the sender/domain setup and the actual destination email values before assuming the controller path is wrong.

### Push Notifications

Push delivery requires:

- a valid Expo/EAS project ID in [mobile/app.json](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app.json)
- granted device notification permissions
- a stored Expo push token on the correct user record
- valid Expo/FCM/APNs credential setup for the installed build

### Deep Links

The backend serves mobile bridge pages for:

- `/home`
- `/accept-invite`
- `/verify-email`
- `/reset-password`
- `/complaints/complaint-details`

The mobile app registers the `sahayak://` scheme and associated-domain settings in [mobile/app.json](/Users/bhavishyjain/Documents/GitHub/Sahayak/mobile/app.json).

## Troubleshooting

### Seed Fails

Check:

- MongoDB is running
- `MONGO_URI` is correct
- the database user has write access

### Emails Do Not Reach Recipients

Check:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- sender domain verification in Resend
- the destination email stored for the affected user or schedule

### Push Notifications Do Not Appear

Check:

- Expo push token registration succeeded
- notification permissions were granted on the device
- the backend stored the token for the current account
- the build has working push credentials

### Media Uploads Fail

Check:

- Cloudinary credentials
- multipart request shape
- file count and file size limits
- backend network access
