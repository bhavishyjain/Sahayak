# Sahayak

Sahayak is a multi-role municipal grievance management platform with a Node/Express backend and an Expo React Native mobile app. Citizens create complaints with media and location, workers execute field tasks, Heads of Department coordinate operations, and administrators manage platform-wide data and user operations.

This README is intentionally deep. It is meant to work as:

- product documentation
- onboarding for new developers
- architecture reference
- feature reference
- API orientation guide
- roadmap entry point

For the audit backlog and future improvements, see [`FUTURE.md`](./FUTURE.md).

## 1. Product Purpose

Sahayak manages the end-to-end lifecycle of municipal complaints:

1. A citizen files a complaint with text, images, and location.
2. The backend enriches the complaint with AI-derived metadata such as suggested department, priority, urgency, and sentiment.
3. The complaint enters a departmental workflow.
4. HOD users review, assign workers, and supervise execution.
5. Workers update progress, upload completion photos, and submit work for approval.
6. Citizens track status, receive notifications, give feedback, and vote on satisfaction.
7. Departments and admins use analytics, reports, schedules, and escalation views to monitor system health.

At a product level, Sahayak is both:

- a citizen service platform
- an internal municipal operations system

## 2. Role Model

### 2.1 Citizen

Citizen users can:

- register, log in, reset password, and verify email
- submit complaints with text, media, and coordinates
- browse their complaints with filters and pagination
- view complaint detail, history, worker assignment state, SLA state, and escalation state
- chat inside complaint threads
- upvote nearby complaints
- submit feedback after resolution
- vote on satisfaction after a complaint is resolved
- receive push notifications and in-app notifications

### 2.2 Worker

Worker users can:

- accept an invitation or be provisioned by backend/admin flows
- access a dashboard summary and active assignment preview
- browse assigned complaints and completed complaints
- start work and move complaints through worker-allowed transitions
- upload completion photos
- submit work for HOD approval
- participate in complaint chat
- view leaderboard metrics
- view individual worker analytics

### 2.3 Head Of Department

HOD users can:

- access a department dashboard summary
- browse department complaint queues and resolved queues
- assign one or multiple workers
- update worker task descriptions
- approve completion
- send complaints for rework
- cancel complaints when policy allows
- review AI suggestions
- invite workers and manage invitations
- remove workers
- export reports
- email reports
- schedule recurring reports
- inspect report schedule health and run schedules manually

### 2.4 Admin

Admin users have backend support for:

- user CRUD
- deleted complaint recovery and purge
- festival event management
- report access
- worker creation and maintenance

The mobile app currently exposes only limited admin-grade UI. Several admin capabilities remain backend-only. Those are documented in [`FUTURE.md`](./FUTURE.md).

## 3. Repository Structure

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
│   └── validators/
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

## 4. Tech Stack

### 4.1 Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT access tokens plus refresh token rotation
- Cloudinary for media storage
- Resend for email delivery
- Gemini/OpenAI integrations for AI assistance
- Expo push notifications
- WebSocket realtime using `ws`
- `node-cron` for background scheduled work

### 4.2 Mobile

- Expo
- React Native
- Expo Router
- TanStack React Query
- NativeWind
- AsyncStorage
- Expo Notifications
- Expo Image Picker
- Expo Sharing
- Expo Print
- i18n-driven localization

## 5. Backend Architecture

### 5.1 Boot And Infrastructure

- `backend/app.js`: Express setup, middleware, routes, error handling
- `backend/bin/www`: HTTP server boot, database connection, realtime server setup, cron initialization
- `backend/core/*`: app errors, async wrappers, response helpers, error middleware

### 5.2 Routing Model

Major route groups:

- `backend/routes/authRoutes.js`
- `backend/routes/complaintRoutes.js`
- `backend/routes/workerRoutes.js`
- `backend/routes/hodRoutes.js`
- `backend/routes/reportRoutes.js`
- `backend/routes/notificationRoutes.js`
- `backend/routes/chatRoutes.js`
- `backend/routes/analyticsRoutes.js`
- `backend/routes/festivalEventRoutes.js`
- `backend/routes/users.js`

### 5.3 Domain Layers

The backend is partially service-oriented. Important layers are:

- controllers: HTTP boundary and role-level orchestration
- services: reusable business logic
- policies: access and complaint-management rules
- models: persistence schema and indexes
- utils: view mappers, schedulers, normalization, metrics helpers
- validators: input validation

### 5.4 Core Services

Key services currently in use:

- `authService.js`
- `complaintAssignmentService.js`
- `complaintAudienceService.js`
- `complaintWorkflowService.js`
- `complaintQueryService.js`
- `notificationDomainService.js`
- `realtimeService.js`
- `reportSchedulerService.js`
- `reportService.js`
- `mediaUploadService.js`
- `completionPhotoService.js`
- `accessService.js`
- `workerMetricsService.js`
- `geminiService.js`
- `chatAssistantService.js`

### 5.5 Data Model

Primary Mongo models:

- `User`
- `Complaint`
- `Notification`
- `ReportSchedule`
- `WorkerInvitation`
- `FestivalEvent`

Complaint data is split into sub-schemas for:

- assignments
- AI analysis
- history
- feedback
- SLA
- messages
- satisfaction votes

## 6. Mobile Architecture

### 6.1 Router Layout

The mobile app is route-first.

- `mobile/app/_layout.jsx`: root providers, React Query client, push setup, realtime bridge
- `mobile/app/(app)/_layout.jsx`: authenticated layout
- `mobile/app/(app)/(auth)`: authentication screens
- `mobile/app/(app)/(tabs)`: role dashboards and primary routes
- `mobile/app/(app)/complaints`: complaint detail and complaint chat
- `mobile/app/(app)/hod`: HOD-specific operational screens
- `mobile/app/(app)/more`: secondary screens such as profile, reports, notifications, resolved complaints

### 6.2 Shared Client Layers

Important utilities and hooks:

- `mobile/utils/api.js`
- `mobile/utils/queryKeys.js`
- `mobile/utils/hooks/useApiQuery.js`
- `mobile/utils/hooks/useApiMutation.js`
- `mobile/utils/hooks/useComplaintList.js`
- `mobile/utils/hooks/useComplaintDetail.js`
- `mobile/utils/hooks/useComplaintActions.js`
- `mobile/utils/hooks/useDashboardData.js`
- `mobile/utils/hooks/useNotifications.js`
- `mobile/utils/hooks/useReports.js`
- `mobile/utils/hooks/useProfileActions.js`
- `mobile/utils/hooks/useAiReviewActions.js`
- `mobile/utils/realtime/socket.js`
- `mobile/utils/notificationNavigation.js`
- `mobile/utils/invalidateComplaintQueries.js`
- `mobile/utils/offlineQueue.js`

Important shared components:

- `ComplaintCard.jsx`
- `ComplaintTimeline.jsx`
- `FilterPanel.jsx`
- `NotificationBellButton.jsx`
- `RealtimeBridge.jsx`
- `BackButtonHeader.jsx`
- `SlaStatusBadge.jsx`
- `MetricCard.jsx`

## 7. Major Features

## 7.1 Authentication And Account Lifecycle

Implemented by:

- `backend/controllers/authController.js`
- `backend/services/authService.js`
- `backend/validators/authValidators.js`
- auth screens in `mobile/app/(app)/(auth)`

Current behavior:

- citizen registration
- login/logout
- refresh rotation
- forgot password
- reset password
- email verification
- invite-based onboarding
- profile update
- account deletion

Important notes:

- refresh tokens are hashed server-side
- password policy is enforced in both backend and mobile auth UX
- invite-based onboarding supports workers joining via HOD-issued invites

## 7.2 Complaint Creation

Implemented by:

- `backend/controllers/complaints/createReadController.js`
- `backend/services/geminiService.js`
- `mobile/app/(app)/more/new-complaint.jsx`

What it does:

- captures complaint title/description
- uploads proof images
- stores location and address labels
- generates a ticket ID
- applies AI enrichment
- persists complaint history
- triggers notifications

## 7.3 Complaint Listing

Implemented by:

- `backend/services/complaintQueryService.js`
- `backend/controllers/complaints/createReadController.js`
- worker/HOD list endpoints
- `mobile/utils/hooks/useComplaintList.js`

Current behavior:

- citizen complaint lists
- worker assigned/completed lists
- HOD complaint queues
- pagination support on main list endpoints
- shared filtering for status, department, priority, search, and date ranges

## 7.4 Complaint Detail

Implemented by:

- `backend/utils/complaintView.js`
- `backend/controllers/complaints/createReadController.js`
- `mobile/utils/hooks/useComplaintDetail.js`
- `mobile/utils/complaintDetailViewModel.js`
- `mobile/app/(app)/complaints/complaint-details.jsx`

Current behavior:

- normalized complaint detail read path
- status, priority, department, timeline, location, and SLA rendering
- proof image and completion photo display
- upvote state
- feedback rendering
- satisfaction state
- worker assignment preview
- AI suggestion rendering

## 7.5 Complaint Workflow

Implemented by:

- `backend/services/complaintWorkflowService.js`
- `backend/controllers/worker/statusController.js`
- `backend/controllers/hod/workflowController.js`
- `backend/controllers/complaints/aiReviewController.js`

Worker transitions currently supported:

- `assigned -> in-progress`
- `assigned -> pending-approval`
- `needs-rework -> in-progress`
- `needs-rework -> pending-approval`
- `in-progress -> pending-approval`

HOD transitions currently supported:

- `pending-approval -> resolved`
- `pending-approval -> needs-rework`
- active states -> `cancelled` where policy allows

## 7.6 AI Review

Implemented by:

- `backend/controllers/complaints/aiReviewController.js`
- `backend/services/geminiService.js`
- `mobile/app/(app)/hod/ai-review.jsx`

What it does:

- compares current department/priority with AI suggestions
- filters for complaints with strong enough AI confidence
- lets HOD apply department and/or priority suggestions
- updates complaint history and realtime state

## 7.7 Assignment And Worker Coordination

Implemented by:

- `backend/services/complaintAssignmentService.js`
- `backend/controllers/hod/assignmentController.js`
- `mobile/app/(app)/hod/worker-assignment.jsx`
- `mobile/app/(app)/(tabs)/hod-workers.jsx`
- `mobile/app/(app)/hod/worker-details.jsx`

What it does:

- assign one or more workers
- update task descriptions
- fetch workers in department
- fetch complaint worker list
- view worker complaint drill-down

## 7.8 Chat

Implemented by:

- `backend/controllers/complaints/messageController.js`
- `backend/controllers/chat/chatController.js`
- `backend/services/chatAssistantService.js`
- `mobile/app/(app)/complaints/complaint-chat.jsx`
- `mobile/app/(app)/(tabs)/assistant.jsx`

There are two chat-related experiences:

- complaint chat between complaint participants
- assistant chat for status/help flows

Complaint chat supports realtime updates through WebSockets. Assistant chat supports message-based help flows and backend speech-to-text support exists, though voice capture UI is still missing on mobile.

## 7.9 Notifications

Implemented by:

- `backend/controllers/notificationController.js`
- `backend/services/notificationDomainService.js`
- `backend/services/pushNotificationService.js`
- `backend/services/realtimeService.js`
- `mobile/utils/hooks/useNotifications.js`
- `mobile/utils/notificationsCache.js`
- `mobile/utils/notificationNavigation.js`
- `mobile/app/(app)/more/notifications.jsx`
- `mobile/app/(app)/more/notification-history.jsx`

Current behavior:

- device push token registration
- notification preference storage
- persisted in-app notification history
- realtime notification updates
- unread count badge
- deep-link routing from notifications into complaint detail/chat and HOD action contexts

## 7.10 SLA And Escalation

Implemented by:

- complaint SLA schema
- `backend/utils/slaEscalation.js`
- complaint detail UI

Current behavior:

- due dates are derived from complaint priority
- overdue complaints are escalated by scheduled job
- escalation level is recorded
- priority can be increased when SLA is breached
- notifications are sent to HOD and citizen
- complaint detail shows due date, overdue state, and escalation history

## 7.11 Reports

Implemented by:

- `backend/services/reportService.js`
- `backend/services/reportSchedulerService.js`
- `backend/controllers/reports/exportController.js`
- `backend/controllers/reports/scheduleController.js`
- `mobile/app/(app)/more/hod-reports.jsx`
- `mobile/utils/hooks/useReports.js`

Current behavior:

- PDF/Excel/CSV export
- email report on demand
- dashboard report stats
- department breakdown analytics
- recurring schedules
- schedule health view
- schedule cancellation
- manual `run now`

## 7.12 Analytics And Heatmap

Implemented by:

- `backend/controllers/analyticsController.js`
- `backend/controllers/hod/analyticsController.js`
- `backend/controllers/worker/analyticsController.js`
- `mobile/app/(app)/(tabs)/heatmap.jsx`
- `mobile/utils/hooks/useDashboardData.js`
- `mobile/app/(app)/(tabs)/hod-overview.jsx`
- `mobile/app/(app)/(tabs)/worker-home.jsx`
- `mobile/app/(app)/(tabs)/home.jsx`

Current behavior:

- citizen analytics summary
- complaint heatmap
- HOD dashboard summary
- worker dashboard summary
- worker analytics and leaderboard

Metric semantics used across analytics and reports:

| Metric / Bucket | Meaning |
| --- | --- |
| `active` | complaints in active lifecycle states defined by `ACTIVE_COMPLAINT_STATUSES` |
| `backlog` | complaints waiting for department or field progress: `pending`, `assigned`, `in-progress`, `pending-approval`, `needs-rework` |
| `workerActionable` | complaints a worker can actively work on or respond to: `assigned`, `in-progress`, `needs-rework`, `pending-approval` |
| `workerOpen` | worker complaints still in execution flow: `assigned`, `in-progress`, `needs-rework` |
| `final` | complaints in terminal states: `resolved`, `cancelled` |
| `resolved` | complaints with final successful completion state |
| `pendingApproval` | complaints submitted by workers and waiting for HOD approval |
| `timeframe` | analytics/report date window when explicit `startDate` / `endDate` are not provided |
| explicit date range | overrides timeframe window when `startDate` and/or `endDate` are supplied |

Current analytics/report contract direction:

- shared analytics filters normalize `timeframe`, date range, department, priority, bucket, and scope
- shared report filters normalize department, status, priority, and date windows, and can fall back to analytics-style timeframe
- dashboard responses still preserve legacy fields for compatibility while the app completes contract cleanup

## 7.13 Offline Support

Implemented by:

- `mobile/utils/offlineQueue.js`
- complaint-related mobile screens

Current behavior:

- some mutation flows survive offline or poor network state
- cached complaint detail/list data can be used as fallback

Offline support exists, but it is not yet universal across all mutation domains.

## 8. Realtime Model

Sahayak now uses both push notifications and WebSockets.

Use WebSockets for:

- live complaint chat
- live complaint updates while app is open
- live notification cache updates

Use push notifications for:

- background and closed-app delivery
- operating-system notification banners
- deep-link entry into complaint or workflow screens

Current mobile notification routing supports:

- complaint detail
- complaint chat
- HOD AI review queue
- HOD worker assignment

## 9. API Overview

This is a high-level route map, not a full OpenAPI document.

### 9.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `DELETE /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `GET /api/auth/verify-email/:token`
- `POST /api/auth/resend-verification`
- `POST /api/auth/accept-invite`

### 9.2 Complaints

- `POST /api/complaints`
- `GET /api/complaints`
- `GET /api/complaints/nearby`
- `GET /api/complaints/:complaintId`
- `POST /api/complaints/:complaintId/upvote`
- `POST /api/complaints/:complaintId/feedback`
- `POST /api/complaints/:id/completion-photos`
- `POST /api/complaints/:id/satisfaction-vote`
- `GET /api/complaints/:id/satisfaction`
- `GET /api/complaints/:id/messages`
- `POST /api/complaints/:id/messages`
- `GET /api/complaints/ai-review/pending`
- `POST /api/complaints/:complaintId/apply-ai-suggestion`

Admin-only complaint operations:

- `GET /api/complaints/deleted`
- `DELETE /api/complaints/:complaintId`
- `POST /api/complaints/:complaintId/restore`
- `DELETE /api/complaints/:complaintId/purge`

### 9.3 Worker

- `GET /api/workers/dashboard-summary`
- `GET /api/workers/active-preview`
- `GET /api/workers/assigned-complaints`
- `GET /api/workers/completed-complaints`
- `GET /api/workers/leaderboard`
- `GET /api/workers/analytics`
- `PUT /api/workers/complaint/:complaintId/status`

Worker/admin management routes:

- `POST /api/workers/create`
- `PUT /api/workers/:workerId`
- `GET /api/workers`
- `GET /api/workers/available/:department`

### 9.4 HOD

- `GET /api/hod/dashboard-summary`
- `GET /api/hod/overview`
- `GET /api/hod/workers`
- `GET /api/hod/workers/:workerId`
- `GET /api/hod/workers/:workerId/complaints`
- `POST /api/hod/invite-worker`
- `GET /api/hod/invitations`
- `DELETE /api/hod/invitations/:invitationId`
- `DELETE /api/hod/workers/:workerId`
- `POST /api/hod/approve-completion/:complaintId`
- `POST /api/hod/needs-rework/:complaintId`
- `POST /api/hod/cancel-complaint/:complaintId`
- `POST /api/hod/complaints/:complaintId/assign-workers`
- `PUT /api/hod/complaints/:complaintId/workers/:workerId`
- `GET /api/hod/complaints/:complaintId/workers`

### 9.5 Reports

- `GET /api/reports/pdf`
- `GET /api/reports/excel`
- `GET /api/reports/csv`
- `GET /api/reports/stats`
- `GET /api/reports/department-breakdown`
- `POST /api/reports/email`
- `POST /api/reports/schedule`
- `GET /api/reports/schedule`
- `POST /api/reports/schedule/:id/run-now`
- `DELETE /api/reports/schedule/:id`

### 9.6 Notifications

- `POST /api/notifications/register-token`
- `GET /api/notifications/history`
- `PUT /api/notifications/read-all`
- `PUT /api/notifications/:id/read`
- `GET /api/notifications/preferences`
- `PUT /api/notifications/preferences`

### 9.7 Analytics And Assistant

- `GET /api/analytics/summary`
- `GET /api/analytics/heatmap`
- `POST /api/chat/message`
- `POST /api/chat/speech-to-text`

### 9.8 Admin-Only Domains

- admin user CRUD under `/api/users`
- festival event CRUD under `/api/festival-events`

## 10. Complaint List Filter Contract

The backend complaint list layer is increasingly standardized.

Supported shared query parameters:

- `page`: 1-based page
- `limit`: page size
- `status`: complaint status
- `excludeStatus`: comma-separated excluded statuses
- `priority`: `Low`, `Medium`, `High`
- `department`: `Road`, `Water`, `Electricity`, `Waste`, `Drainage`, `Other`
- `search`: text search
- `startDate`: lower date bound
- `endDate`: upper date bound
- `sort`: normalized sort preset

Public date contract:

- use `YYYY-MM-DD`

Role-aware behavior:

- citizen list defaults to authenticated user scope
- `scope=all` is blocked for citizen role
- worker and HOD endpoints add assignment or department constraints on top of common filters

## 11. Reports Filter Contract

Supported report filters:

- `department`
- `status`
- `priority`
- `startDate`
- `endDate`

Public date contract:

- use `YYYY-MM-DD`

Important semantics:

- HOD requests are automatically scoped to the HOD department
- admin requests may query across departments

Example `GET /api/reports/stats` response:

```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "total": 128,
    "byStatus": {
      "pending": 21,
      "assigned": 34,
      "in-progress": 18,
      "resolved": 49,
      "cancelled": 6
    },
    "byPriority": {
      "Low": 20,
      "Medium": 74,
      "High": 34
    },
    "byDepartment": {
      "Road": 42,
      "Water": 28,
      "Electricity": 18,
      "Waste": 23,
      "Drainage": 10,
      "Other": 7
    },
    "avgResolutionTime": 31
  }
}
```

Example `GET /api/reports/department-breakdown` response:

```json
{
  "success": true,
  "message": "Department breakdown retrieved successfully",
  "data": {
    "Road": {
      "total": 42,
      "pending": 7,
      "inProgress": 8,
      "resolved": 24,
      "cancelled": 3,
      "highPriority": 9,
      "mediumPriority": 22,
      "lowPriority": 11
    }
  }
}
```

## 12. Setup

### 12.1 Prerequisites

- Node.js 18+
- MongoDB
- Cloudinary account
- Expo development environment
- Resend account
- AI provider keys if AI functionality is enabled

### 12.2 Backend Setup

```bash
cd backend
npm install
npm run dev
```

Suggested environment variables:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=
JWT_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:5173

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GEMINI_API_KEY=
OPENAI_API_KEY=

RESEND_API_KEY=
EMAIL_FROM="Sahayak <noreply@example.com>"
APP_URL=http://localhost:8081

REPORT_SCHEDULE_TIMEZONE=Asia/Kolkata
REPORT_CACHE_TTL_MS=60000
ENABLE_SLA_ESCALATION_JOB=true
SLA_ESCALATION_RUN_ON_STARTUP=false
```

### 12.3 Mobile Setup

```bash
cd mobile
npm install
npx expo start
```

Expected public env variables:

```env
EXPO_PUBLIC_API_URL_DEV=http://localhost:3000/api
EXPO_PUBLIC_API_URL_PROD=
```

### 12.4 Push Notifications

To receive background or closed-app notifications:

- configure Expo notifications correctly
- configure Android FCM credentials
- configure iOS APNs if building for iOS
- ensure the device grants notification permission
- ensure the app successfully registers the Expo push token

Foreground notification presentation is also configured in mobile code.

### 12.5 Realtime

Realtime requires:

- backend WebSocket server boot from `backend/bin/www`
- valid authenticated token on mobile socket connection
- complaint room subscriptions for complaint chat/detail flows

## 13. Current Known Gaps

The following are intentionally not presented as hidden problems. They are current realities of the codebase:

- some backend admin capabilities are still backend-only
- speech-to-text exists in backend but has no mobile voice capture UI
- festival event CRUD exists but has no mobile event-management surface
- recycle-bin flows exist but have no admin mobile UI
- several mobile screens still use raw `apiCall(...)` flows instead of shared query/mutation hooks
- some backend analytics/reporting paths are still more controller-heavy than ideal

These are broken down in detail in [`FUTURE.md`](./FUTURE.md).

### 13.1 Backend Capabilities Still Ahead Of Frontend

Backend functionality already exists for:

- speech-to-text complaint or assistant inputs
- festival event CRUD
- admin user CRUD
- deleted complaint restore and purge
- deeper operational telemetry for scheduled work and delivery surfaces

That means the system is functionally richer on the server than what the mobile UI currently exposes.

### 13.2 Remaining Frontend Duplication Hotspots

The highest-signal mobile screens still needing deeper hook extraction are:

- `mobile/app/(app)/(tabs)/complaints.jsx`
- `mobile/app/(app)/(tabs)/home.jsx`
- `mobile/app/(app)/(tabs)/hod-complaints.jsx`
- `mobile/app/(app)/(tabs)/worker-assigned.jsx`
- `mobile/app/(app)/(tabs)/heatmap.jsx`
- `mobile/app/(app)/(tabs)/hod-workers.jsx`
- `mobile/app/(app)/more/hod-resolved.jsx`
- `mobile/app/(app)/more/worker-completed.jsx`

These screens still carry some mix of:

- raw `apiCall(...)` usage
- screen-local pagination/refresh logic
- screen-owned filter serialization
- heavier-than-ideal data orchestration

### 13.3 Remaining Backend Duplication Hotspots

The backend is significantly cleaner than earlier revisions, but duplication still exists around:

- analytics filter normalization across analytics, heatmap, and report paths
- report filter/schedule validation rules
- response envelopes where legacy aliases still coexist with standardized shapes
- notification typing and route contract ownership

## 14. Feature Coverage Matrix

### 14.1 Citizen

- registration, login, password reset, email verification: complete
- complaint creation with text, media, and coordinates: complete
- complaint tracking, history, and detail: complete
- complaint chat: complete
- feedback and satisfaction: complete
- nearby complaint voting: complete
- push and in-app notifications: complete
- voice complaint drafting: backend-only

### 14.2 Worker

- invitation acceptance: complete
- dashboard summary and active preview: complete
- assigned and completed complaint flows: complete
- worker status updates and completion proof upload: complete
- worker analytics and leaderboard: complete
- complaint chat and notifications: complete

### 14.3 HOD

- dashboard summary: complete
- department complaint queues and resolved queues: complete
- worker assignment and task editing: complete
- AI review queue: complete
- worker invitation management: complete
- report exports, email, schedules, schedule health, and run-now: complete
- festival-event operations: backend-only

### 14.4 Admin

- user CRUD: backend-only
- deleted complaint recycle bin: backend-only
- festival event CRUD: backend-only
- delivery-health operations UI: not yet exposed in mobile

## 15. Suggested Next Features

The current architecture is ready for higher-value product features without a full rewrite. Best fits are:

- duplicate complaint detection with "join existing issue"
- reopened complaint workflow with policy bounds and audit trail
- event-aware staffing suggestions on HOD dashboards
- admin operations console for push/email/realtime/cron health
- microphone-assisted complaint drafting and assistant input
- citizen transparency pages for SLA, escalation history, and department responsiveness
- worker route grouping or route planning for multi-assignment days

## 16. Contributor Guidance

When extending the system:

- prefer adding backend logic to services before growing controllers
- keep complaint list/filter behavior aligned with `complaintQueryService.js`
- keep notification payloads aligned with `notificationDomainService.js`
- keep complaint transition logic aligned with `complaintWorkflowService.js`
- favor React Query-based hooks over screen-local request state
- keep mobile route deep links aligned with `notificationNavigation.js`

## 17. Documentation Scope

This README is intentionally broad and deep, but it is still not a generated API spec. If the project grows further, the next documentation step should be:

- generated endpoint reference
- sequence diagrams for complaint workflow
- role-by-role frontend/backend coverage matrix
- deployment runbook
