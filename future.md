# Sahayak Future Roadmap And Technical Audit

This document is the current deep audit backlog for Sahayak. It focuses on:

- backend duplication still present
- frontend duplication still present
- backend features already built but still missing or underused in frontend
- architectural risks
- scaling and security improvements
- high-impact product features worth adding next

It is intentionally practical. Each section is written as an engineering to-do, not a vague wishlist.

## 1. Current Audit Snapshot

Sahayak already has:

- multi-role complaint lifecycle
- complaint creation, tracking, chat, feedback, and satisfaction
- AI-assisted categorization and AI review queue
- worker and HOD workflow actions
- push notifications and WebSocket realtime
- exports, report scheduling, and schedule health
- dashboard analytics and heatmaps
- offline-aware complaint flows

The next quality jump is not “add random endpoints”. It is:

- reduce duplication in backend orchestration
- finish migrating frontend flows onto shared data hooks
- expose backend-only operational/admin features in frontend
- harden analytics/reporting for larger data volume
- improve observability and failure visibility

## 2. Backend Duplication Still Present

### 2.1 Analytics Filter And Bucket Semantics Are Still Split Across Endpoints

Files involved:

- `backend/controllers/analyticsController.js`
- `backend/controllers/worker/analyticsController.js`
- `backend/controllers/hod/analyticsController.js`
- `backend/services/analyticsMetricsService.js`
- `backend/services/complaintQueryService.js`

Current state:

- status buckets have been centralized more than before
- shared analytics/report filter normalization now exists for timeframe, date range, department, priority, bucket, scope, and schedule/report policy inputs
- citizen summary, heatmap, worker analytics, HOD dashboard summary, HOD overview, and reports now use that shared contract partially
- analytics endpoints still do not all share identical semantics yet

Why this matters:

- dashboards can disagree on what "active", "backlog", or "recent" means
- report totals and dashboard totals can drift under the same user-selected filters
- optimization work stays fragmented because query semantics are still endpoint-specific

Improvement plan:

1. Finish removing the remaining controller-specific semantics so every analytics/report path uses the same bucket/timeframe rules.
2. Publish one metric-definition table in README.
3. Add contract tests that compare citizen summary, HOD summary, worker analytics, and reports under equivalent filters.

### 2.2 Notification Emission Is Centralized, But Transport And Persistence Boundaries Are Still Mixed

Files involved:

- `backend/services/notificationDomainService.js`
- `backend/services/complaintAudienceService.js`
- `backend/controllers/notificationController.js`
- `backend/services/realtimeService.js`

Current state:

- notification creation is more disciplined than before
- some flows still combine persistence rules, audience selection, realtime emit, and title/body construction in the same path
- route payloads are standardized, but notification contract ownership is still distributed

Why this matters:

- new notification types are still easy to wire incorrectly
- delivery/persistence behavior is harder to audit end to end
- frontend contract drift is still possible without a single notification schema artifact

Improvement plan:

1. Promote notification payloads to a canonical domain contract.
2. Keep audience resolution separate from payload construction.
3. Keep persistence, push delivery, and realtime emission behind one delivery coordinator.
4. Add fixture-based tests for each supported notification route.

### 2.3 Report Filtering And Schedule Rules Still Need One Validation Layer

Files involved:

- `backend/controllers/reports/exportController.js`
- `backend/controllers/reports/scheduleController.js`
- `backend/services/reportService.js`
- `backend/services/reportSchedulerService.js`

Current state:

- reporting logic is much better structured than before
- report filters and schedule policy validation are now partially shared
- export, email, stats, department breakdown, and schedule execution still do not all use one fully unified contract
- schedule execution boundaries are still enforced partly in controllers and partly in scheduler service code

Why this matters:

- report filters can diverge subtly by endpoint
- scheduled reports and on-demand reports may not remain perfectly aligned
- authorization and safety checks are harder to reason about

Improvement plan:

1. Reuse the shared report-filter validator for every report surface consistently.
2. Extend schedule-policy validation to cover:
   - timezone
   - duplicate schedules
   - run-now boundaries
3. Move run-now authorization and execution checks behind one schedule policy path.
4. Add report contract tests across all report surfaces.

### 2.4 Response Envelope Standardization Is Improved, But Still Partial

Files involved:

- `backend/services/responseViewService.js`
- complaint, worker, HOD, notification, report, and analytics controllers

Current state:

- the backend now has list/detail helpers
- many endpoints still preserve legacy response keys alongside standardized ones
- clients still need some endpoint-specific parsing knowledge

Why this matters:

- new mobile hooks remain more complex than necessary
- contract cleanup is incomplete until legacy aliases are retired
- future web/admin clients will repeat the same parsing burden

Improvement plan:

1. Finalize domain envelope rules for:
   - list
   - detail
   - summary
   - mutation result
2. Add deprecation notes for legacy keys.
3. Migrate the mobile app fully to standardized fields.
4. Remove legacy aliases in a planned breaking-change pass.

## 3. Frontend Duplication Still Present

### 3.1 Remaining List Screens Still Bypass Shared Domain Hooks

High-signal examples:

- `mobile/app/(app)/(tabs)/complaints.jsx`
- `mobile/app/(app)/(tabs)/hod-complaints.jsx`
- `mobile/app/(app)/(tabs)/heatmap.jsx`
- `mobile/app/(app)/more/hod-resolved.jsx`
- `mobile/app/(app)/more/worker-completed.jsx`
- `mobile/app/(app)/hod/worker-details.jsx`

Current state:

- several secondary/detail flows now use React Query hooks
- `home.jsx`, `worker-assigned.jsx`, and `hod-workers.jsx` have already been moved off their raw screen-local fetch flows
- these list and dashboard-adjacent screens still own direct `apiCall(...)` loading, refresh, and pagination logic
- cache invalidation has improved, but list freshness is still screen-managed in several places

Why this matters:

- stale list behavior differs by screen
- retry/loading UX is inconsistent
- list filters and pagination behavior remain harder to test

Improvement plan:

1. Create domain list hooks for:
   - citizen complaints
   - HOD complaints
   - worker completed lists
   - heatmap data
   - worker detail lists
2. Move pagination and filter serialization out of screens.
3. Reuse query keys and invalidation helpers by domain.

### 3.2 Auth And Utility Flows Still Use Screen-Local Async Handling

High-signal examples:

- `mobile/app/(app)/(auth)/login.jsx`
- `mobile/app/(app)/(auth)/register.jsx`
- `mobile/app/(app)/(auth)/forgot-password.jsx`
- `mobile/app/(app)/(auth)/reset-password.jsx`
- `mobile/app/(app)/(auth)/verify-email.jsx`
- `mobile/app/(app)/(auth)/accept-invite.jsx`
- `mobile/utils/pushToken.js`
- `mobile/utils/userAuth.js`

Current state:

- password validation is aligned better than before
- auth screens still own most request lifecycle, success messages, and side effects directly
- auth bootstrap, token registration, and realtime reconnect behavior are still spread across utility modules

Why this matters:

- auth UX consistency is harder to maintain
- side effects around login/logout/push/realtime remain distributed
- adding another client will require repeating the same flow rules

Improvement plan:

1. Introduce auth domain hooks for login, registration, password reset, invite acceptance, and email verification.
2. Centralize post-auth side effects:
   - push token registration
   - realtime reconnect
   - prefetch by role
3. Add one auth lifecycle diagram to README.

### 3.3 Reports And Analytics Still Mix Data Hooks With Screen-Level View Logic

High-signal examples:

- `mobile/app/(app)/more/hod-reports.jsx`
- `mobile/app/(app)/(tabs)/heatmap.jsx`
- `mobile/app/(app)/(tabs)/worker-home.jsx`
- `mobile/app/(app)/(tabs)/hod-overview.jsx`

Current state:

- shared hooks exist for schedules, reports, and dashboards
- `home.jsx` already uses shared dashboard and nearby-complaint hooks, but still has some screen-owned presentation orchestration
- some screens still reshape API payloads or coordinate several data sources locally
- heatmap remains a heavy screen-level orchestration surface

Why this matters:

- presentation contracts are not fully stable yet
- adding a web client or redesigning dashboard cards will still require re-reading screen-level logic
- heavy screens remain harder to unit test

Improvement plan:

1. Expand hook outputs into stable view models.
2. Keep filters, summary cards, and preview collections inside hook mappers.
3. Keep screens focused on rendering only.

## 4. Backend Features Missing Or Underused In Frontend

These capabilities already exist in backend code but are still absent or underexposed in frontend UX.

### 4.1 Speech-To-Text For Assistant And Complaint Drafting

Backend:

- `POST /api/chat/speech-to-text`

Frontend gap:

- no microphone capture in assistant flow
- no complaint voice-draft flow in new complaint form

Improvement plan:

1. Add recorder UI in `assistant.jsx`.
2. Add optional voice-to-text in `new-complaint.jsx`.
3. Allow transcript review before submission.

### 4.2 Festival Event Management

Backend:

- festival event CRUD exists

Frontend gap:

- no event calendar
- no event CRUD
- no event-aware staffing or analytics layer

Improvement plan:

1. Add admin/HOD event management screen.
2. Surface active event banners in dashboards.
3. Use events to annotate heatmap and reports.

### 4.3 Admin User CRUD

Backend:

- `/api/users` CRUD exists

Frontend gap:

- no admin user management surface

Improvement plan:

1. Build admin user list/search/edit views.
2. Add department and role edit forms.
3. Add deactivate/reactivate flows.

### 4.4 Deleted Complaint Recovery

Backend:

- deleted complaint list
- restore
- purge

Frontend gap:

- no recycle bin UI

Improvement plan:

1. Build admin recycle bin list.
2. Add restore and purge actions.
3. Show deletion metadata and audit reason.

### 4.5 Public-Or-Operations Event Overlay

Backend:

- festival events exist
- heatmap and reports exist

Frontend gap:

- no linkage between event data and operational analytics

Improvement plan:

1. Show event overlays on heatmap.
2. Compare complaint surge vs event window.
3. Recommend staffing adjustments during event periods.

## 5. Frontend Features That Need Stronger Backend Alignment

### 5.1 Complaint Chat Needs A More Scalable Backend Contract

Current state:

- frontend chat exists and realtime works
- backend now persists chat in a dedicated `ComplaintMessage` collection
- message reads are paginated from the message collection instead of slicing only the embedded complaint array
- complaint documents still carry legacy embedded-message compatibility paths during migration

Action:

1. Finish the migration by backfilling all historical complaint threads into `ComplaintMessage`.
2. Remove the fallback migration logic from `backend/controllers/complaints/messageController.js` once every complaint is migrated.
3. Add cursor pagination by `createdAt` + `_id` instead of page-number pagination.
4. Add retention / archival rules for very old chat history.
5. Add chat contract tests for:
   - initial page load
   - older-message pagination
   - realtime append de-duplication
   - migrated complaint thread reads

### 5.2 Notification Domain Is Functional But Not Yet Fully Typed Across Client And Server

Current state:

- notification route payloads are standardized
- event/type usage is still string-based rather than generated/shared

Action:

1. Create a shared notification contract artifact with:
   - notification event keys
   - notification category keys
   - route target names
   - required `data` payload fields per route
2. Mirror that contract into both backend and mobile through either:
   - a generated JSON file committed to both apps, or
   - a small shared package inside the monorepo
3. Replace free-form string literals in:
   - `backend/services/notificationDomainService.js`
   - `backend/services/complaintAudienceService.js`
   - `mobile/utils/notificationNavigation.js`
   - `mobile/components/RealtimeBridge.jsx`
4. Add contract tests that fail if backend emits a route target the mobile app does not know how to handle.
5. Add a notification fixture matrix in tests:
   - complaint detail
   - complaint chat
   - HOD AI review
   - worker assignment
   - generic inbox-only notification

### 5.3 Analytics Contracts Need Explicit Versioning Or Schema Discipline

Current state:

- dashboards are working
- multiple summaries still use role-specific naming and shapes

Action:

1. Define response schemas for:
   - citizen analytics summary
   - worker dashboard summary
   - worker active preview
   - HOD dashboard summary
   - report statistics summary
2. Store those schemas in one backend contract module and mirror them in README.
3. Add a `schemaVersion` or `contractVersion` field to summary payloads that are consumed by mobile dashboards.
4. Add smoke tests that validate required keys and numeric field types for each summary endpoint.
5. Make mobile dashboard hooks map only from those stable contract fields, not ad hoc controller-specific aliases.

## 6. Security And Reliability Backlog

### 6.1 Stronger Validation Coverage

Already improved:

- auth and complaint creation have better validation than before

Still needed:

- stricter validation for analytics filters
- stricter validation for report filters
- stricter validation for schedule fields and schedule execution boundaries

Implementation steps:

1. Add request validators for analytics endpoints:
   - allowed date windows
   - allowed departments
   - allowed status buckets
   - limit bounds
2. Add request validators for report endpoints:
   - ISO date format only
   - `startDate <= endDate`
   - allowed status values
   - department allow-list
3. Add request validators for report schedules:
   - frequency enum
   - timezone allow-list or ICU validation
   - hour bounds
   - email validation
   - max number of active schedules per user
4. Reject manual `run-now` calls when:
   - the schedule is inactive
   - the caller is not the schedule owner or admin
   - another execution is already in flight
5. Log validation failures with route + actor + normalized cause for ops visibility.

### 6.2 Delivery Observability

Still needed:

- push delivery logs
- email delivery result logging
- realtime connection metrics
- admin visibility into failed deliveries

Implementation steps:

1. Persist outbound push attempts with:
   - notification id
   - user id
   - Expo token hash
   - send status
   - provider receipt id
   - failure reason
2. Persist email delivery attempts for:
   - report schedules
   - invites
   - password reset
3. Add realtime metrics for:
   - active socket connections
   - reconnect count
   - auth failures
   - per-event fan-out counts
4. Build an admin delivery-health screen with:
   - recent failures
   - top failure reasons
   - provider outage banner
   - retry guidance

### 6.3 Background Job Safety

Still needed:

- idempotency for all scheduled/background jobs
- structured logs for scheduler runs
- admin surface for cron health and failures

Implementation steps:

1. Add idempotency keys or execution locks for:
   - SLA escalation runs
   - scheduled report execution
   - event-priority updates
2. Persist job execution rows with:
   - job name
   - startedAt
   - finishedAt
   - status
   - items processed
   - error summary
3. Emit structured logs instead of console-only logs for job lifecycle events.
4. Add stale-job detection if a job starts but never completes.
5. Build an admin cron-health page with last run, duration, and failure history.

## 7. Performance And Scalability Roadmap

### 7.1 Database

1. Move nearby complaint logic to GeoJSON plus `2dsphere`.
2. Add explain-plan review for:
   - complaint lists
   - worker analytics
   - leaderboard
   - reports
3. Add retention or archival strategy for large notification and chat history.

Recommended order:

1. Convert stored complaint coordinates into GeoJSON.
2. Add the `2dsphere` index and verify nearby query behavior against real seed data.
3. Capture `explain()` output for the top 10 heaviest list/report queries.
4. Add archival collections or cold-storage exports for notifications and messages older than policy thresholds.

### 7.2 Backend

1. Cache expensive analytics summaries where safe.
2. Move heavier export work to asynchronous jobs if report volume rises.
3. Separate message persistence from complaint document growth.

Recommended order:

1. Cache worker/HOD/citizen dashboard summaries with short TTLs.
2. Add cache invalidation on workflow mutations that materially change summaries.
3. Move export generation to queued jobs if synchronous latency becomes user-visible.
4. Remove remaining legacy complaint-message compatibility paths after migration is done.

### 7.3 Frontend

1. Migrate remaining manual screens to React Query domain hooks.
2. Replace more full-screen spinners with skeleton states.
3. Add prefetch-by-role after login.
4. Add more optimistic updates where correctness risk is low.

Recommended order:

1. Finish list-screen hook migration for complaints, HOD complaints, worker assigned, and citizen home.
2. Introduce skeleton loaders for dashboard cards, complaints list rows, and report cards.
3. Prefetch role-critical queries immediately after auth bootstrap.
4. Add optimistic updates for low-risk actions:
   - mark notification as read
   - toggle notification preferences
   - send chat message
   - update feedback / satisfaction where rollback is straightforward

## 8. Documentation And DX Roadmap

### 8.1 Docs

Still needed:

- full endpoint reference with request/response examples
- role-by-role feature matrix
- deployment runbook
- operational troubleshooting guide
- notification and realtime sequence diagrams

### 8.2 Developer Experience

Still needed:

- backend integration tests for workflow transitions
- contract tests for major mobile-consumed endpoints
- seed profiles for each role
- local scripts for notification and scheduler testing

## 9. Recommended Execution Order

### Phase 1: Architecture Hygiene

1. Standardize response envelopes.
2. Extract remaining mobile domain hooks.
3. Consolidate analytics status/date semantics.

### Phase 2: Operational Features

1. Admin user management UI.
2. Recycle bin UI.
3. Festival event management UI.

### Phase 3: Scale Hardening

1. Finish complaint message migration and move to cursor pagination.
2. Geo-indexed nearby complaints.
3. report/export job hardening.

### Phase 4: Product Expansion

1. voice complaint drafting
2. duplicate complaint detection
3. reopened complaint workflow
4. admin operations console

## 10. High-Impact Feature Ideas

### 10.1 Duplicate Complaint Detection

Why it matters:

- reduces spam
- consolidates citizen signal
- makes upvotes more meaningful

How to build:

1. compare text similarity
2. compare location proximity
3. compare recency
4. suggest joining an existing complaint instead of opening a new one

### 10.2 Reopen Resolved Complaint

Why it matters:

- resolved does not always mean fixed in real life

What it needs:

- reopened state
- reopen reason
- citizen-triggered or HOD-triggered reopen path
- history and notification support

### 10.3 Worker Route Planning

Why it matters:

- reduces travel time
- improves SLA compliance

What it needs:

- assignment clustering
- coordinate-aware route ordering
- travel-aware worker dashboard

### 10.4 Admin Operations Console

Why it matters:

- the backend already contains multiple admin-grade capabilities
- they are not unified operationally

What it should show:

- user management
- schedule health
- notification failures
- escalation backlog
- stale complaints
- worker utilization by department

### 10.5 Complaint Knowledge Base

Why it matters:

- repeated civic issues often have repeated fixes

What it could do:

- mine resolved complaints
- build suggested remediation patterns
- improve AI reasoning
- help workers resolve common issue types faster

### 10.6 Event-Aware Resource Planning

Why it matters:

- festivals, civic events, and seasonal spikes influence complaint volume

What it could do:

- correlate event windows with complaint spikes
- recommend temporary staffing
- forecast surge departments

### 10.7 Citizen Transparency View

Future possibility:

- anonymized public status dashboard
- ward/department service transparency
- crowd trust and visibility
