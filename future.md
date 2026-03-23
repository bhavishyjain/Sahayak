## 1. Executive Audit Snapshot

Sahayak is already a serious multi-role civic operations platform, not a prototype.

What is already strong:

- multi-role complaint lifecycle
- AI categorization and AI review queue
- worker/HOD execution workflow
- realtime complaint chat
- push plus in-app notifications
- SLA escalation
- reports, recurring schedules, and schedule health
- citizen, worker, and HOD analytics
- offline-aware citizen flows
- detailed seed data with realistic lifecycle coverage

What is still uneven:

- several backend domains still solve similar query/filter/notification problems in parallel
- several frontend screens still own fetch/pagination/filter state directly instead of using domain hooks
- backend admin and operations capabilities are ahead of the mobile UI
- some product surfaces exist in backend contracts but are still hidden, partial, or inconsistent in frontend

The highest-value work now is not random new endpoints. It is:

- contract consolidation
- hook/view-model consolidation
- admin/ops UI exposure
- stronger auditability and observability
- product polish around existing backend power

---

## 2. Backend Duplication Audit

Status update on March 17, 2026:

- shared complaint list execution now exists through `backend/services/complaintListService.js`
- shared complaint domain-event notification delivery now exists through `backend/services/complaintEventService.js`
- shared complaint analytics aggregation now exists through `backend/services/complaintAnalyticsService.js`
- capability-based complaint policy helpers now exist in `backend/policies/complaintPolicy.js`
- the biggest remaining items in this section are contract tests, broader response-envelope cleanup, and further seed modularization

This section now tracks only the backend duplication work that still remains after the March 17, 2026 refactor.

### 2.1 Complaint List Contract Tests And Final List Semantics Cleanup

Implemented already:

- role-aware complaint list building now exists in `backend/services/complaintListService.js`
- shared list execution now backs citizen, worker, HOD overview, and HOD worker-drilldown complaint endpoints
- population presets and shared pagination are now centralized

What remains:

- add contract tests that compare citizen, worker, and HOD list responses under equivalent filters
- add any still-missing declarative population presets such as feedback summary if frontend starts depending on them
- decide whether report-facing complaint export fetches should consume the same list semantics layer or stay export-specific

Why it still matters:

- this is now mostly a regression-risk problem, not a missing-architecture problem
- without tests, list behavior can still drift again when new filters are added

### 2.2 Complaint Event Delivery Tests And Edge-Case Consolidation

Implemented already:

- explicit complaint domain events now exist in `backend/services/complaintEventService.js`
- complaint creation, assignment, worker status changes, HOD workflow actions, and chat now emit through one event delivery path
- README now documents the complaint notification event contract

What remains:

- add fixture-based tests for route payload generation and notification preference behavior
- audit any future complaint-adjacent events, such as AI-review or admin-only actions, against the same domain-event pattern before they drift

Why it still matters:

- the architecture is centralized now, but the delivery contract still needs automated protection

### 2.3 Analytics And Reports Parity Testing And Contract Versioning

Implemented already:

- shared complaint analytics aggregation now exists in `backend/services/complaintAnalyticsService.js`
- citizen analytics, HOD analytics, worker analytics inputs, and report stats now reuse that shared aggregation layer in the main duplicated areas

What remains:

- version the analytics and report contract explicitly once frontend hooks are aligned
- add parity tests between dashboard stats and report stats under the same filter set
- keep an eye on any future visualization-only metrics so they are added to the shared aggregation layer first

Why it still matters:

- the shared computation exists now, but contract drift can still happen at the response-shape level

### 2.4 Policy Test Matrix And Access Helper Consolidation Follow-Through

Implemented already:

- capability-based helpers now exist in `backend/policies/complaintPolicy.js`
- shared helpers now cover complaint viewing, chat participation, department management, worker leader status updates, and satisfaction voting
- several controllers have already been thinned onto those helpers

What remains:

- add policy tests for every role against every complaint state
- continue moving any inline route-specific access branches toward capability checks as those files are touched
- keep `backend/services/accessService.js` focused on entity lookup and basic role retrieval rather than policy decisions

Why it still matters:

- this is now mostly about preventing future security drift rather than filling a missing policy layer

### 2.5 Response Standardization Is Improved But Not Finished

Primary files:

- `backend/services/responseViewService.js`
- `backend/services/reportViewService.js`
- complaint, worker, HOD, report, analytics, and notification controllers

What is happening today:

- standardized helpers exist for list/detail/summary flows
- legacy keys still remain for compatibility
- mobile code still sometimes knows about endpoint-specific shapes

Why this is duplication:

- the same data often appears in both canonical and legacy forms
- clients keep partial knowledge of multiple envelopes

Why it matters:

- React Query hooks stay more complex than necessary
- future clients will inherit old compatibility decisions

Improvement steps:

1. Publish canonical envelopes for:
   - list
   - detail
   - summary
   - mutation result
2. Mark legacy aliases in docs as deprecated.
3. Migrate mobile hooks fully to canonical fields.
4. Remove legacy aliases in a planned cleanup pass.

### 2.6 Seed Data Drift Is a Real Architectural Risk

Primary files:

- `backend/seedData.js`
- complaint/user/report/notification/message models

What is happening today:

- the seed file is rich and realistic
- but the product is moving fast
- new backend capabilities can become invisible if seed data does not keep up

Why this matters:

- realistic demo data is essential for analytics, reports, notifications, chat, and admin recovery flows
- if the dataset lags behind the product, important features look broken even when code is correct

Improvement steps:

1. Treat seed coverage as part of feature completion.
2. Add a checklist for every new backend feature:
   - model fields seeded?
   - lifecycle timestamps seeded?
   - notification types seeded?
   - admin-only data seeded?
3. Consider splitting the monolithic seeder into:
   - users
   - complaints
   - chat
   - notifications
   - reports
   - admin artifacts

---

## 3. Frontend Features Missing Or Underexposed Relative To Backend

These are backend capabilities that already exist and should be represented in frontend plans.

### 3.1 Speech-To-Text For Assistant And Complaint Drafting

Backend support:

- `POST /api/chat/speech-to-text`
- `backend/controllers/chat/chatController.js`

Frontend status:

- assistant screen exists
- complaint drafting exists
- there is no microphone capture or upload UX in mobile

Improvement steps:

1. Add microphone capture in assistant.
2. Add optional voice-to-text in complaint creation.
3. Show transcription preview before submit.
4. Keep text editability after transcription.

### 3.2 Admin User CRUD

Backend support:

- `/api/users`
- `backend/controllers/admin/usersController.js`

Frontend status:

- no admin mobile UI

Improvement steps:

1. Add admin-only user list.
2. Add create/update/deactivate flows.
3. Add role/department filters.
4. Add worker/HOD provisioning shortcuts.

### 3.3 Deleted Complaint Recycle Bin

Backend support:

- `GET /api/complaints/deleted`
- restore
- purge
- `backend/controllers/admin/complaintController.js`

Frontend status:

- no recycle-bin interface

Improvement steps:

1. Add admin recycle-bin screen.
2. Show deleted reason, deleted date, original status, and owner.
3. Add restore and irreversible purge actions with confirmations.

### 3.4 Festival Event Operations

Backend support:

- `/api/festival-events`
- `backend/controllers/admin/festivalEventController.js`

Frontend status:

- no event-management surface

Improvement steps:

1. Add event calendar/list screen.
2. Show active event windows and hotspot locations.
3. Connect event data into HOD planning views.

## 6. Future Feature Ideas

These are additive features that fit the current architecture well.

### Citizen-Facing

- duplicate complaint detection with “support existing issue”
- complaint subscription without ownership
- transparency page for department responsiveness and SLA adherence
- richer neighborhood issue feed with clustering and severity
- voice complaint drafting with translation support

### Worker-Facing

- daily task route optimization
- shift handoff notes
- richer rework checklist UX
- offline photo upload retry queue by complaint
- skill-tag based assignment suitability

### HOD-Facing

- workforce capacity planning
- pending-approval batching
- blocked-complaint watchlist
- event-aware operations planning
- department performance drill-down by zone or ward

### Admin-Facing

- system health console
- user lifecycle management
- recycle-bin and restore operations
- festival event control center
- policy tuning screen for SLA and escalation defaults

### Platform / AI

- complaint similarity scoring
- AI summarization of long complaint threads
- AI-generated HOD shift briefs
- anomaly detection for sudden location spikes
- AI-assisted report narratives

---
